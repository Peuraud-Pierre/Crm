// ── useBiblioQR.test.ts ───────────────────────────────────────────────────────
// Tests unitaires dédiés au hook useBiblioQR.ts (extrait de useBibli.ts — voir
// son en-tête). Contrairement aux tests d'intégration de useBibli.test.ts (qui
// vérifient le CÂBLAGE createQR/updateQR/deleteQR/upsertFormat à travers
// useBibli), ceux-ci montent useBiblioQR() directement, en isolation, avec ses
// propres setters/ref — ils couvrent la logique du fichier lui-même (y compris
// les chemins d'erreur de patchQR/removeQR/upsertFormatMap, non testés ailleurs).
//
// Dépendances mockées :
//   - services/bibliothequeService (svc.insertQR/patchQR/removeQR/upsertFormatMap)
// mapQR (services/mappers.ts) est une fonction pure, réutilisée telle quelle.

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { act, renderHook } from "@testing-library/react"
import { useState, useRef } from "react"
import type { QRRow } from "../../services/mappers"
import type { QR, FormatMap } from "../../types"

const mocks = rstest.hoisted(() => ({
    insertQR: rstest.fn(),
    patchQR: rstest.fn(),
    removeQR: rstest.fn(),
    upsertFormatMap: rstest.fn(),
}))

rstest.mock("@/features/bibliotheque/services/bibliothequeService", () => mocks)

import { useBiblioQR } from "./useBiblioQR"
import { silenceExpectedLogs } from "@/shared/lib/testing"

// Ces tests provoquent volontairement des erreurs pour vérifier leur gestion :
// le log applicatif qui en résulte est attendu, pas un symptôme.
silenceExpectedLogs("[useBiblioQR]")

const mkQRRow = (overrides: Partial<QRRow> = {}): QRRow => ({
    id: "qr1", thematique_id: "t1", question: "Q", question_en: "Q-en",
    brief_qr: "R", brief_qr_en: "R-en", position: 0,
    created_by: "user-1", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
})

// Harnais : reproduit la façon dont useBibli.ts consomme useBiblioQR — état
// React réel (pas de simples rstest.fn()) pour pouvoir observer les mises à
// jour optimistes, plus une ref pour la position max par thématique.
// Pas de valeur par défaut sur userId : un paramètre par défaut se déclenche
// aussi quand `undefined` est passé EXPLICITEMENT, ce qui masquerait le test
// "utilisateur non authentifié" (useHarness(undefined) redeviendrait "user-1").
function useHarness(userId: string | undefined) {
    const [questionsReponses, setQuestionsReponses] = useState<QR[]>([])
    const [formatReponses, setFormatReponses] = useState<Record<string, FormatMap>>({})
    const maxQRPosByThematiqueRef = useRef<Record<string, number>>({})
    const qr = useBiblioQR({
        userId, setQuestionsReponses, setFormatReponses,
        maxQRPosByThematique: maxQRPosByThematiqueRef,
    })
    return { questionsReponses, formatReponses, maxQRPosByThematique: maxQRPosByThematiqueRef, ...qr }
}

const content = { question: "Q", questionEn: "Q-en", briefQr: "R", briefQrEn: "R-en" }

beforeEach(() => {
    rstest.clearAllMocks()
})

describe("useBiblioQR — createQR", () => {
    test("ne fait rien et retourne null si userId est absent", async () => {
        const { result } = renderHook(() => useHarness(undefined))

        let created
        await act(async () => { created = await result.current.createQR("t1", content) })

        expect(created).toBeNull()
        expect(mocks.insertQR).not.toHaveBeenCalled()
    })

    test("insère à la position 0 pour la première Q&R d'une thématique, l'ajoute à l'état de façon optimiste", async () => {
        mocks.insertQR.mockResolvedValue(mkQRRow({ id: "new-qr" }))
        const { result } = renderHook(() => useHarness("user-1"))

        let created
        await act(async () => { created = await result.current.createQR("t1", content) })

        expect(mocks.insertQR).toHaveBeenCalledWith("t1", content, 0, "user-1")
        expect(created).toMatchObject({ id: "new-qr" })
        expect(result.current.questionsReponses.some((qr) => qr.id === "new-qr")).toBe(true)
    })

    test("échec : retourne null, n'ajoute rien à l'état, et fait reculer le compteur de position", async () => {
        mocks.insertQR.mockRejectedValue(new Error("insert failed"))
        const { result } = renderHook(() => useHarness("user-1"))

        let created
        await act(async () => { created = await result.current.createQR("t1", content) })

        expect(created).toBeNull()
        expect(result.current.questionsReponses).toHaveLength(0)
        expect(result.current.maxQRPosByThematique.current["t1"]).toBe(-1)
    })

    test("le rollback de position ne recule pas si une autre création sur la MÊME thématique a déjà avancé le compteur", async () => {
        let rejectA!: (err: Error) => void
        const pendingA = new Promise<QRRow>((_resolve, reject) => { rejectA = reject })
        let resolveB!: (row: QRRow) => void
        const pendingB = new Promise<QRRow>((resolve) => { resolveB = resolve })

        mocks.insertQR
            .mockImplementationOnce(() => pendingA)
            .mockImplementationOnce(() => pendingB)
            .mockImplementationOnce(() => Promise.resolve(mkQRRow({ id: "c" })))

        const { result } = renderHook(() => useHarness("user-1"))

        let promiseA!: Promise<unknown>
        let promiseB!: Promise<unknown>
        act(() => {
            promiseA = result.current.createQR("t1", content)
            promiseB = result.current.createQR("t1", content)
        })

        await act(async () => {
            resolveB(mkQRRow({ id: "b", position: 1 }))
            await promiseB
            rejectA(new Error("insert A failed"))
            await promiseA
        })

        await act(async () => { await result.current.createQR("t1", content) })

        const positionsRequested = mocks.insertQR.mock.calls.map((call: unknown[]) => call[2])
        expect(positionsRequested).toEqual([0, 1, 2])
    })

    test("les positions par thématique sont indépendantes les unes des autres", async () => {
        mocks.insertQR
            .mockResolvedValueOnce(mkQRRow({ id: "t1-a", thematique_id: "t1" }))
            .mockResolvedValueOnce(mkQRRow({ id: "t2-a", thematique_id: "t2" }))

        const { result } = renderHook(() => useHarness("user-1"))

        await act(async () => { await result.current.createQR("t1", content) })
        await act(async () => { await result.current.createQR("t2", content) })

        const positionsRequested = mocks.insertQR.mock.calls.map((call: unknown[]) => call[2])
        expect(positionsRequested).toEqual([0, 0])
    })
})

describe("useBiblioQR — updateQR", () => {
    test("succès : retourne true et met à jour la Q&R dans l'état local", async () => {
        mocks.insertQR.mockResolvedValue(mkQRRow({ id: "qr1", question: "Ancienne" }))
        mocks.patchQR.mockResolvedValue(undefined)
        const { result } = renderHook(() => useHarness("user-1"))
        await act(async () => { await result.current.createQR("t1", content) })

        let ok
        await act(async () => {
            ok = await result.current.updateQR("qr1", { ...content, question: "Nouvelle" }, "t1")
        })

        expect(ok).toBe(true)
        expect(mocks.patchQR).toHaveBeenCalledWith("qr1", { ...content, question: "Nouvelle" }, "t1")
        expect(result.current.questionsReponses.find((qr) => qr.id === "qr1")?.question).toBe("Nouvelle")
    })

    test("échec : retourne false et laisse l'état local inchangé", async () => {
        mocks.insertQR.mockResolvedValue(mkQRRow({ id: "qr1", question: "Ancienne" }))
        mocks.patchQR.mockRejectedValue(new Error("update failed"))
        const { result } = renderHook(() => useHarness("user-1"))
        await act(async () => { await result.current.createQR("t1", content) })

        let ok
        await act(async () => {
            ok = await result.current.updateQR("qr1", { ...content, question: "Nouvelle" }, "t1")
        })

        expect(ok).toBe(false)
        expect(result.current.questionsReponses.find((qr) => qr.id === "qr1")?.question).toBe("Ancienne")
    })
})

describe("useBiblioQR — deleteQR", () => {
    test("succès : retire la Q&R ET son entrée dans formatReponses", async () => {
        mocks.insertQR.mockResolvedValue(mkQRRow({ id: "qr1" }))
        mocks.upsertFormatMap.mockResolvedValue(undefined)
        mocks.removeQR.mockResolvedValue(undefined)
        const { result } = renderHook(() => useHarness("user-1"))
        await act(async () => { await result.current.createQR("t1", content) })
        const map = { email: "e", emailEn: "e-en", instagram: "i", instagramEn: "i-en", whatsapp: "w", whatsappEn: "w-en" }
        await act(async () => { await result.current.upsertFormat("qr1", map) })
        expect(result.current.formatReponses["qr1"]).toEqual(map)

        let ok
        await act(async () => { ok = await result.current.deleteQR("qr1") })

        expect(ok).toBe(true)
        expect(result.current.questionsReponses.some((qr) => qr.id === "qr1")).toBe(false)
        expect(result.current.formatReponses["qr1"]).toBeUndefined()
    })

    test("échec : retourne false et ne modifie rien", async () => {
        mocks.insertQR.mockResolvedValue(mkQRRow({ id: "qr1" }))
        mocks.removeQR.mockRejectedValue(new Error("delete failed"))
        const { result } = renderHook(() => useHarness("user-1"))
        await act(async () => { await result.current.createQR("t1", content) })

        let ok
        await act(async () => { ok = await result.current.deleteQR("qr1") })

        expect(ok).toBe(false)
        expect(result.current.questionsReponses.some((qr) => qr.id === "qr1")).toBe(true)
    })
})

describe("useBiblioQR — upsertFormat", () => {
    test("succès : retourne true et peuple formatReponses[qrId]", async () => {
        mocks.upsertFormatMap.mockResolvedValue(undefined)
        const { result } = renderHook(() => useHarness("user-1"))
        const map = { email: "e", emailEn: "e-en", instagram: "i", instagramEn: "i-en", whatsapp: "w", whatsappEn: "w-en" }

        let ok
        await act(async () => { ok = await result.current.upsertFormat("qr1", map) })

        expect(ok).toBe(true)
        expect(mocks.upsertFormatMap).toHaveBeenCalledWith("qr1", map)
        expect(result.current.formatReponses["qr1"]).toEqual(map)
    })

    test("échec : retourne false et ne modifie pas formatReponses", async () => {
        mocks.upsertFormatMap.mockRejectedValue(new Error("upsert failed"))
        const { result } = renderHook(() => useHarness("user-1"))
        const map = { email: "e", emailEn: "e-en", instagram: "i", instagramEn: "i-en", whatsapp: "w", whatsappEn: "w-en" }

        let ok
        await act(async () => { ok = await result.current.upsertFormat("qr1", map) })

        expect(ok).toBe(false)
        expect(result.current.formatReponses["qr1"]).toBeUndefined()
    })
})
