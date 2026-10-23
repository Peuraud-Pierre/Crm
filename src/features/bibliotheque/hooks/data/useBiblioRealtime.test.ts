// ── useBiblioRealtime.test.ts ─────────────────────────────────────────────────
// Tests unitaires des souscriptions Supabase Realtime (useBiblioRealtime.ts) —
// jusqu'ici à 0% de couverture, alors que c'est exactement là que vivaient les
// deux bugs les plus graves relevés en revue :
//   1. Aucune table n'était ajoutée à la publication `supabase_realtime` (corrigé
//      par la migration 20260716120000_bibliotheque_realtime.sql — hors de portée
//      d'un test unitaire, qui ne peut pas vérifier l'état d'une base réelle).
//   2. Le DELETE sur bibliotheque_format_reponses lisait `quest_rep_id` sur
//      `payload.old`, un champ absent sans REPLICA IDENTITY FULL — CE bug-là est
//      testable ici : on vérifie que le handler ne plante pas et ne corrompt pas
//      l'état si `quest_rep_id` est absent, et qu'il nettoie bien la bonne entrée
//      quand il est présent (cas nominal après la migration).
//
// Stratégie de mock : le hook ne parle plus directement à `db` (voir la
// correction "couche service obligatoire" — l'ouverture du canal vit désormais
// dans services/bibliothequeService.ts, subscribeBiblioRealtime/
// unsubscribeBiblioRealtime). On mocke donc CE module : subscribeBiblioRealtime
// capture l'objet de handlers passé par le hook, pour que les tests puissent les
// invoquer directement avec un payload Postgres simulé, sans jamais ouvrir de
// vraie connexion réseau. Le nom du canal et le câblage table/événement → handler
// sont désormais couverts par bibliothequeService.test.ts, pas ici.

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { renderHook, act } from "@testing-library/react"
import type { Dispatch, SetStateAction } from "react"
import type { Thematique, QR, FormatMap, Brief } from "../../types"
import type { BiblioRealtimeHandlers } from "../../services/bibliothequeService"

const mocks = rstest.hoisted(() => {
    const capturedHandlers = { current: null as BiblioRealtimeHandlers | null }
    const fakeChannel = { current: {} as object }
    const unsubscribeBiblioRealtime = rstest.fn()
    const subscribeBiblioRealtime = rstest.fn((_userId: string, handlers: BiblioRealtimeHandlers) => {
        capturedHandlers.current = handlers
        return fakeChannel.current
    })
    return { capturedHandlers, fakeChannel, unsubscribeBiblioRealtime, subscribeBiblioRealtime }
})

rstest.mock("../../services/bibliothequeService", () => ({
    subscribeBiblioRealtime: mocks.subscribeBiblioRealtime,
    unsubscribeBiblioRealtime: mocks.unsubscribeBiblioRealtime,
}))

import { useBiblioRealtime } from "./useBiblioRealtime"

// Pas de valeur par défaut pour userId : un paramètre par défaut se déclenche
// aussi quand l'appelant passe explicitement `undefined` (renderRealtime(undefined),
// utilisé ci-dessous pour tester CE cas précis), ce qui masquerait silencieusement
// le scénario "utilisateur non authentifié" qu'on veut justement exercer.
function renderRealtime(userId: string | undefined) {
    const fetchAll = rstest.fn().mockResolvedValue(undefined)
    const setThematiques = rstest.fn() as unknown as Dispatch<SetStateAction<Thematique[]>>
    const setQRs = rstest.fn() as unknown as Dispatch<SetStateAction<QR[]>>
    const setFormatReponses = rstest.fn() as unknown as Dispatch<SetStateAction<Record<string, FormatMap>>>
    const setBrief = rstest.fn() as unknown as Dispatch<SetStateAction<Brief>>
    const maxThematiquePos = { current: -1 }
    const maxQRPosByThematique = { current: {} as Record<string, number> }

    const hook = renderHook(() => useBiblioRealtime({
        userId, fetchAll, setThematiques, setQRs, setFormatReponses, setBrief,
        maxThematiquePos, maxQRPosByThematique,
    }))

    return { ...hook, fetchAll, setThematiques, setQRs, setFormatReponses, setBrief, maxThematiquePos, maxQRPosByThematique }
}

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.capturedHandlers.current = null
})

// ── Montage / démontage ────────────────────────────────────────────────────────

describe("useBiblioRealtime — montage", () => {
    test("ne souscrit à rien et n'appelle pas fetchAll si userId est undefined", () => {
        const { fetchAll } = renderRealtime(undefined)
        expect(mocks.subscribeBiblioRealtime).not.toHaveBeenCalled()
        expect(fetchAll).not.toHaveBeenCalled()
    })

    test("appelle subscribeBiblioRealtime avec userId et fetchAll au montage", () => {
        const { fetchAll } = renderRealtime("user-42")
        expect(mocks.subscribeBiblioRealtime).toHaveBeenCalledWith("user-42", expect.any(Object))
        expect(fetchAll).toHaveBeenCalledTimes(1)
    })

    test("unsubscribeBiblioRealtime est appelé au démontage avec le canal renvoyé par subscribeBiblioRealtime", () => {
        const { unmount } = renderRealtime("user-1")
        expect(mocks.unsubscribeBiblioRealtime).not.toHaveBeenCalled()
        unmount()
        expect(mocks.unsubscribeBiblioRealtime).toHaveBeenCalledTimes(1)
        expect(mocks.unsubscribeBiblioRealtime).toHaveBeenCalledWith(mocks.fakeChannel.current)
    })
})

// ── Thématiques ────────────────────────────────────────────────────────────────

describe("useBiblioRealtime — événements thématiques", () => {
    test("INSERT ajoute l'item s'il n'est pas déjà présent (dédup avec l'update optimiste)", () => {
        const { setThematiques } = renderRealtime("user-1")
        act(() => mocks.capturedHandlers.current!.onThematiqueInsert({
            new: { id: "t1", label: "Livraison", label_en: "Delivery", image_url: "", icon_url: "", position: 3 },
        } as never))

        const updater = (setThematiques as unknown as ReturnType<typeof rstest.fn>).mock.calls[0][0] as (prev: Thematique[]) => Thematique[]
        expect(updater([])).toHaveLength(1)
        // Déjà présent (créé en optimiste par useBibli avant l'écho Realtime) → pas de doublon
        expect(updater([{ id: "t1", label: "x", labelEn: "", imageUrl: "", iconUrl: "" }])).toHaveLength(1)
    })

    test("INSERT met à jour maxThematiquePos avec Math.max(position actuelle, nouvelle)", () => {
        const { maxThematiquePos } = renderRealtime("user-1")
        act(() => mocks.capturedHandlers.current!.onThematiqueInsert({
            new: { id: "t1", label: "L", label_en: "", image_url: "", icon_url: "", position: 5 },
        } as never))
        expect(maxThematiquePos.current).toBe(5)
    })

    test("UPDATE remplace l'item correspondant par son id", () => {
        const { setThematiques } = renderRealtime("user-1")
        act(() => mocks.capturedHandlers.current!.onThematiqueUpdate({
            new: { id: "t1", label: "Nouveau nom", label_en: "New name", image_url: "", icon_url: "", position: 0 },
        } as never))

        const updater = (setThematiques as unknown as ReturnType<typeof rstest.fn>).mock.calls[0][0] as (prev: Thematique[]) => Thematique[]
        const result = updater([{ id: "t1", label: "Ancien", labelEn: "Old", imageUrl: "", iconUrl: "" }])
        expect(result[0].label).toBe("Nouveau nom")
    })

    test("DELETE retire l'item correspondant à payload.old.id", () => {
        const { setThematiques } = renderRealtime("user-1")
        act(() => mocks.capturedHandlers.current!.onThematiqueDelete({ old: { id: "t1" } } as never))

        const updater = (setThematiques as unknown as ReturnType<typeof rstest.fn>).mock.calls[0][0] as (prev: Thematique[]) => Thematique[]
        const result = updater([
            { id: "t1", label: "A", labelEn: "", imageUrl: "", iconUrl: "" },
            { id: "t2", label: "B", labelEn: "", imageUrl: "", iconUrl: "" },
        ])
        expect(result).toHaveLength(1)
        expect(result[0].id).toBe("t2")
    })
})

// ── Questions / Réponses ───────────────────────────────────────────────────────

describe("useBiblioRealtime — événements Q&R", () => {
    test("INSERT met à jour maxQRPosByThematique pour la bonne thématique uniquement", () => {
        const { maxQRPosByThematique } = renderRealtime("user-1")
        act(() => mocks.capturedHandlers.current!.onQRInsert({
            new: { id: "qr1", thematique_id: "t1", question: "Q", question_en: "", brief_qr: "R", brief_qr_en: "", position: 2 },
        } as never))
        expect(maxQRPosByThematique.current["t1"]).toBe(2)
        expect(maxQRPosByThematique.current["t2"]).toBeUndefined()
    })

    test("UPDATE remplace la Q&R correspondante par son id", () => {
        const { setQRs } = renderRealtime("user-1")
        act(() => mocks.capturedHandlers.current!.onQRUpdate({
            new: { id: "qr1", thematique_id: "t1", question: "Nouvelle question", question_en: "New question", brief_qr: "Nouvelle réponse", brief_qr_en: "New answer", position: 0 },
        } as never))

        const updater = (setQRs as unknown as ReturnType<typeof rstest.fn>).mock.calls[0][0] as (prev: QR[]) => QR[]
        const result = updater([
            { id: "qr1", thematiqueId: "t1", question: "Ancienne question", questionEn: "Old question", briefQr: "Ancienne réponse", briefQrEn: "Old answer" },
            { id: "qr2", thematiqueId: "t1", question: "Autre", questionEn: "Other", briefQr: "R", briefQrEn: "R-en" },
        ])
        expect(result).toHaveLength(2)
        expect(result[0]).toMatchObject({ id: "qr1", question: "Nouvelle question" })
        // La Q&R non concernée reste inchangée
        expect(result[1]).toMatchObject({ id: "qr2", question: "Autre" })
    })

    test("DELETE retire la Q&R correspondant à payload.old.id", () => {
        const { setQRs } = renderRealtime("user-1")
        act(() => mocks.capturedHandlers.current!.onQRDelete({ old: { id: "qr1" } } as never))

        const updater = (setQRs as unknown as ReturnType<typeof rstest.fn>).mock.calls[0][0] as (prev: QR[]) => QR[]
        const result = updater([
            { id: "qr1", thematiqueId: "t1", question: "", questionEn: "", briefQr: "", briefQrEn: "" },
        ])
        expect(result).toHaveLength(0)
    })
})

// ── Formats de réponse (le bug corrigé : quest_rep_id sur DELETE) ────────────

describe("useBiblioRealtime — événements formats de réponse", () => {
    test("INSERT/UPDATE indexent le format par quest_rep_id (pas par id de la ligne)", () => {
        const { setFormatReponses } = renderRealtime("user-1")
        act(() => mocks.capturedHandlers.current!.onFormatInsert({
            new: {
                id: "fmt-row-id", quest_rep_id: "qr1",
                email: "e", email_en: "", instagram: "i", instagram_en: "", whatsapp: "w", whatsapp_en: "",
            },
        } as never))
        const updater = (setFormatReponses as unknown as ReturnType<typeof rstest.fn>).mock.calls[0][0] as (prev: Record<string, FormatMap>) => Record<string, FormatMap>
        const result = updater({})
        expect(Object.keys(result)).toEqual(["qr1"])
        expect(result["qr1"].email).toBe("e")
    })

    test("DELETE avec quest_rep_id présent (REPLICA IDENTITY FULL) retire la bonne entrée", () => {
        const { setFormatReponses } = renderRealtime("user-1")
        act(() => mocks.capturedHandlers.current!.onFormatDelete({ old: { id: "fmt-row-id", quest_rep_id: "qr1" } } as never))

        expect(setFormatReponses).toHaveBeenCalledTimes(1)
        const updater = (setFormatReponses as unknown as ReturnType<typeof rstest.fn>).mock.calls[0][0] as (prev: Record<string, FormatMap>) => Record<string, FormatMap>
        const emptyMap: FormatMap = { email: "", emailEn: "", instagram: "", instagramEn: "", whatsapp: "", whatsappEn: "" }
        const result = updater({ qr1: emptyMap, qr2: emptyMap })
        expect(Object.keys(result)).toEqual(["qr2"])
    })

    test("DELETE sans quest_rep_id (REPLICA IDENTITY DEFAULT, régression du bug corrigé) ne plante pas et ne touche pas l'état", () => {
        // Avant le correctif, ce cas produisait qrId = undefined et
        // `delete next[undefined]` — silencieux mais inutile. Le correctif fait
        // un bail-out explicite : setFormatReponses ne doit MÊME PAS être appelé.
        const { setFormatReponses } = renderRealtime("user-1")
        expect(() => act(() => mocks.capturedHandlers.current!.onFormatDelete({ old: { id: "fmt-row-id" } } as never))).not.toThrow()
        expect(setFormatReponses).not.toHaveBeenCalled()
    })
})

// ── Brief ──────────────────────────────────────────────────────────────────────

describe("useBiblioRealtime — événements brief", () => {
    test("INSERT et UPDATE remplacent l'état local du brief", () => {
        const { setBrief } = renderRealtime("user-1")
        act(() => mocks.capturedHandlers.current!.onBriefUpdate({
            new: { id: 1, brief: "Nouveau brief", brief_en: "New brief", chiffres: "", chiffres_en: "" },
        } as never))
        expect(setBrief).toHaveBeenCalledWith({ brief: "Nouveau brief", briefEn: "New brief", chiffres: "", chiffresEn: "" })
    })

    test("aucun handler onBriefDelete n'est fourni (singleton, jamais supprimé)", () => {
        renderRealtime("user-1")
        expect((mocks.capturedHandlers.current as unknown as Record<string, unknown>).onBriefDelete).toBeUndefined()
    })
})
