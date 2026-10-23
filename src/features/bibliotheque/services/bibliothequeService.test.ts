// ── bibliothequeService.test.ts ───────────────────────────────────────────────
// Tests unitaires de la couche service CRUD (services/bibliothequeService.ts).
//
// Avant ces tests, cette couche — le seul point d'accès autorisé à Supabase pour
// la feature (voir CLAUDE.md "Couche service obligatoire") — n'avait AUCUN test.
// C'est pourtant là que vivent des invariants sensibles : la gestion spéciale du
// code d'erreur Supabase PGRST116 (brief absent), qui pouvait par le passé faire
// planter TOUT le chargement initial de la page si un futur refactor la traitait
// comme une erreur normale, et — depuis la migration
// 20260720130000_bibliotheque_thematiques_media_unique.sql — la boucle de retry
// atomique sur conflit média (insertThematiqueWithMediaRetry /
// patchThematiqueWithMediaRetry).
//
// Les tests Storage (upload/renommage/suppression de médias, anti-collision de
// chemin) vivent désormais dans bibliothequeMediaService.test.ts — extraits en
// même temps que le code qu'ils couvrent, quand bibliothequeService.ts a été
// scindé pour repasser sous le seuil de 400 lignes (Architecture_Feature.pdf §15).
//
// Stratégie de mock : `db` (services/db.ts) est littéralement le même objet que
// `supabase` (juste re-typé — voir db.ts), donc mocker le module
// "@/integrations/supabase/client" mocke les deux d'un coup. `chainable(result)`
// simule le query-builder Supabase : chaque méthode (.select/.eq/.neq/.order/...)
// retourne le même objet, qui se résout en `result` quand on l'attend (await) —
// exactement comme le vrai PostgrestFilterBuilder, qui est lui-même "thenable".
// bibliothequeMediaConflict (utilisée par insertThematiqueWithMediaRetry /
// patchThematiqueWithMediaRetry pour détecter/relocaliser un média en conflit)
// est mockée séparément : ces tests d'orchestration n'ont pas à rejouer la
// logique de slug déjà couverte par bibliothequeMediaConflict.test.ts.

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"

const mocks = rstest.hoisted(() => {
    const fromResults: unknown[] = []
    const from = rstest.fn(() => {
        const result = fromResults.shift() ?? { data: null, error: null }
        return chainable(result)
    })

    function chainable(result: unknown): PromiseLike<unknown> & Record<string, unknown> {
        const obj: Record<string, unknown> = {
            then: (resolve: (v: unknown) => unknown) => resolve(result),
        }
        const handler = () => obj
        for (const method of ["select", "eq", "neq", "order", "limit", "single", "insert", "update", "delete", "upsert"]) {
            obj[method] = handler
        }
        return obj as PromiseLike<unknown> & Record<string, unknown>
    }

    // ── Mock du canal Realtime (subscribeBiblioRealtime / unsubscribeBiblioRealtime) ──
    // Capture chaque callback .on(event, filter, cb) dans une Map indexée par
    // "event:table", pour vérifier que chaque handler fourni par l'appelant est
    // bien branché sur la bonne combinaison table/événement.
    const registeredHandlers = new Map<string, unknown>()
    const removeChannel = rstest.fn()
    const channelObj = {
        on: (_event: string, filter: { event: string; table: string }, cb: unknown) => {
            registeredHandlers.set(`${filter.event}:${filter.table}`, cb)
            return channelObj
        },
        subscribe: () => channelObj,
    }
    const channel = rstest.fn(() => channelObj)

    return { from, fromResults, chainable, channel, channelObj, registeredHandlers, removeChannel }
})

rstest.mock("@/integrations/supabase/client", () => ({
    supabase: { from: mocks.from, storage: { from: rstest.fn() }, channel: mocks.channel, removeChannel: mocks.removeChannel },
}))

const mediaMocks = rstest.hoisted(() => ({
    detectMediaConflict: rstest.fn(),
    relocateThematiqueMedia: rstest.fn(),
}))

rstest.mock("./bibliothequeMediaConflict", () => mediaMocks)

import * as svc from "./bibliothequeService"
import { BibliothequeServiceError } from "./errors"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.fromResults.length = 0
    mocks.registeredHandlers.clear()
    mediaMocks.detectMediaConflict.mockReturnValue(null)
})

// ── fetchAllBiblioData ────────────────────────────────────────────────────────

describe("fetchAllBiblioData", () => {
    test("charge les 4 tables en parallèle et retourne les données", async () => {
        mocks.fromResults.push(
            { data: [{ id: "t1" }], error: null },   // thematiques
            { data: [{ id: "qr1" }], error: null },  // questionsReponses
            { data: [{ id: "f1" }], error: null },   // formatReponses
            { data: { id: 1, brief: "x" }, error: null }, // brief
        )
        const result = await svc.fetchAllBiblioData()
        expect(result.thematiques).toEqual([{ id: "t1" }])
        expect(result.questionsReponses).toEqual([{ id: "qr1" }])
        expect(result.formatReponses).toEqual([{ id: "f1" }])
        expect(result.brief).toEqual({ id: 1, brief: "x" })
        expect(mocks.from).toHaveBeenCalledTimes(4)
    })

    test("propage l'erreur si la requête thématiques échoue", async () => {
        mocks.fromResults.push(
            { data: null, error: new Error("boom-thematiques") },
            { data: [], error: null },
            { data: [], error: null },
            { data: null, error: null },
        )
        await expect(svc.fetchAllBiblioData()).rejects.toThrow("boom-thematiques")
    })

    test("PGRST116 sur le brief (aucune ligne trouvée) n'est PAS une erreur — brief devient null", async () => {
        mocks.fromResults.push(
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
            { data: null, error: { code: "PGRST116", message: "no rows" } },
        )
        const result = await svc.fetchAllBiblioData()
        expect(result.brief).toBeNull()
    })

    test("une erreur brief AUTRE que PGRST116 est bien propagée (enveloppée dans BibliothequeServiceError, cause conservée)", async () => {
        const rawError = { code: "500", message: "server error" }
        mocks.fromResults.push(
            { data: [], error: null },
            { data: [], error: null },
            { data: [], error: null },
            { data: null, error: rawError },
        )
        let caught: unknown
        await svc.fetchAllBiblioData().catch((err) => { caught = err })
        expect(caught).toBeInstanceOf(BibliothequeServiceError)
        expect((caught as BibliothequeServiceError).message).toBe("server error")
        expect((caught as BibliothequeServiceError).cause).toBe(rawError)
    })
})

// ── CRUD simple (thématiques, brief/chiffres, Q&R, formats) ──────────────────

describe("insertThematique", () => {
    test("insère la ligne et retourne la thématique créée", async () => {
        mocks.fromResults.push({ data: { id: "t1", label: "Livraison" }, error: null })
        const row = await svc.insertThematique("Livraison", "Delivery", "img.png", "icons/i.svg", 0, "user-1")
        expect(row).toEqual({ id: "t1", label: "Livraison" })
    })

    test("propage l'erreur si l'insertion échoue", async () => {
        mocks.fromResults.push({ data: null, error: new Error("insert failed") })
        await expect(svc.insertThematique("X", "X", "", "", 0, "user-1")).rejects.toThrow("insert failed")
    })
})

describe("patchThematique", () => {
    test("ne lève pas d'erreur en cas de succès", async () => {
        mocks.fromResults.push({ data: null, error: null })
        await expect(svc.patchThematique("t1", "L", "L-en", "img.png", "")).resolves.toBeUndefined()
    })

    test("propage l'erreur si l'update échoue", async () => {
        mocks.fromResults.push({ data: null, error: new Error("update failed") })
        await expect(svc.patchThematique("t1", "L", "L-en", "img.png", "")).rejects.toThrow("update failed")
    })
})

describe("removeThematique", () => {
    test("ne lève pas d'erreur en cas de succès", async () => {
        mocks.fromResults.push({ data: null, error: null })
        await expect(svc.removeThematique("t1")).resolves.toBeUndefined()
    })

    test("propage l'erreur si la suppression échoue", async () => {
        mocks.fromResults.push({ data: null, error: new Error("delete failed") })
        await expect(svc.removeThematique("t1")).rejects.toThrow("delete failed")
    })
})

// ── insertThematiqueWithMediaRetry / patchThematiqueWithMediaRetry ───────────
// Garde-fou d'atomicité (voir 20260720130000_bibliotheque_thematiques_media_
// unique.sql) : quand insertThematique/patchThematique échouent avec une
// violation d'unicité sur image_url/icon_url, ces fonctions relocalisent le
// média déjà téléversé puis retentent — au lieu de simplement faire échouer
// l'opération pour l'utilisateur qui a perdu la course de renommage.

describe("insertThematiqueWithMediaRetry", () => {
    test("insère directement si aucun conflit — pas d'appel à relocateThematiqueMedia", async () => {
        mocks.fromResults.push({ data: { id: "t1", image_url: "livraison.png" }, error: null })
        const row = await svc.insertThematiqueWithMediaRetry("Livraison", "Delivery", "livraison.png", "", 0, "user-1")
        expect(row).toEqual({ id: "t1", image_url: "livraison.png" })
        expect(mediaMocks.relocateThematiqueMedia).not.toHaveBeenCalled()
    })

    test("sur conflit image_url, relocalise le fichier et retente l'insertion avec le nouveau chemin", async () => {
        mocks.fromResults.push(
            { data: null, error: { code: "23505", details: "Key (image_url)=(livraison.png) already exists." } },
            { data: { id: "t1", image_url: "livraison-2.png" }, error: null },
        )
        mediaMocks.detectMediaConflict.mockReturnValueOnce({ field: "image" })
        mediaMocks.relocateThematiqueMedia.mockResolvedValueOnce("livraison-2.png")

        const row = await svc.insertThematiqueWithMediaRetry("Livraison", "Delivery", "livraison.png", "", 0, "user-1")

        expect(mediaMocks.relocateThematiqueMedia).toHaveBeenCalledWith("livraison.png", "Livraison", undefined, "image", 2)
        expect(row).toEqual({ id: "t1", image_url: "livraison-2.png" })
    })

    test("propage l'erreur d'origine si ce n'est pas un conflit média (pas de retry)", async () => {
        mocks.fromResults.push({ data: null, error: new Error("network down") })
        mediaMocks.detectMediaConflict.mockReturnValueOnce(null)

        await expect(
            svc.insertThematiqueWithMediaRetry("Livraison", "Delivery", "livraison.png", "", 0, "user-1")
        ).rejects.toThrow("network down")
        expect(mediaMocks.relocateThematiqueMedia).not.toHaveBeenCalled()
    })

    test("propage l'erreur d'origine (enveloppée) si le conflit porte sur un champ vide (rien à relocaliser)", async () => {
        // Conflit signalé sur icon_url alors qu'aucune icône n'a été fournie —
        // cas impossible en pratique mais garde-fou défensif : pas de relocate
        // "à l'aveugle" sur une valeur vide.
        const conflictErr = { code: "23505", details: "Key (icon_url)=(x) already exists." }
        mocks.fromResults.push({ data: null, error: conflictErr })
        mediaMocks.detectMediaConflict.mockReturnValueOnce({ field: "icon" })

        let caught: unknown
        await svc.insertThematiqueWithMediaRetry("Livraison", "Delivery", "livraison.png", "", 0, "user-1")
            .catch((err) => { caught = err })
        expect(caught).toBeInstanceOf(BibliothequeServiceError)
        expect((caught as BibliothequeServiceError).cause).toBe(conflictErr)
        expect(mediaMocks.relocateThematiqueMedia).not.toHaveBeenCalled()
    })
})

describe("patchThematiqueWithMediaRetry", () => {
    test("met à jour directement si aucun conflit et renvoie les chemins inchangés", async () => {
        mocks.fromResults.push({ data: null, error: null })
        const result = await svc.patchThematiqueWithMediaRetry("t1", "Livraison", "Delivery", "livraison.png", "")
        expect(result).toEqual({ imageUrl: "livraison.png", iconUrl: "" })
        expect(mediaMocks.relocateThematiqueMedia).not.toHaveBeenCalled()
    })

    test("sur conflit icon_url, relocalise puis retente avec le nouveau chemin, et renvoie ce chemin", async () => {
        mocks.fromResults.push(
            { data: null, error: { code: "23505", details: "Key (icon_url)=(icons/livraison.svg) already exists." } },
            { data: null, error: null },
        )
        mediaMocks.detectMediaConflict.mockReturnValueOnce({ field: "icon" })
        mediaMocks.relocateThematiqueMedia.mockResolvedValueOnce("icons/livraison-2.svg")

        const result = await svc.patchThematiqueWithMediaRetry("t1", "Livraison", "Delivery", "", "icons/livraison.svg")

        expect(mediaMocks.relocateThematiqueMedia).toHaveBeenCalledWith("icons/livraison.svg", "Livraison", "t1", "icon", 2)
        expect(result).toEqual({ imageUrl: "", iconUrl: "icons/livraison-2.svg" })
    })

    test("lève ThematiqueMediaWriteError (avec les derniers chemins tentés) si ce n'est pas un conflit média", async () => {
        mocks.fromResults.push({ data: null, error: new Error("network down") })
        mediaMocks.detectMediaConflict.mockReturnValueOnce(null)

        let caught: unknown
        await svc.patchThematiqueWithMediaRetry("t1", "Livraison", "Delivery", "livraison.png", "icons/i.svg")
            .catch((err) => { caught = err })

        expect(caught).toBeInstanceOf(svc.ThematiqueMediaWriteError)
        expect((caught as InstanceType<typeof svc.ThematiqueMediaWriteError>).lastImageUrl).toBe("livraison.png")
        expect((caught as InstanceType<typeof svc.ThematiqueMediaWriteError>).lastIconUrl).toBe("icons/i.svg")
    })

    test("ThematiqueMediaWriteError porte le DERNIER chemin relocalisé (pas le premier) si le conflit persiste après une relocalisation", async () => {
        // 1er essai : conflit image_url. Relocalisation → livraison-2.png.
        // 2e essai : échoue pour une autre raison (pas un conflit) → abandon.
        // Le chemin restauré par l'appelant (useBibli.updateThematique) doit
        // être livraison-2.png (le dernier réellement écrit en Storage), pas
        // livraison.png (le tout premier).
        mocks.fromResults.push(
            { data: null, error: { code: "23505", details: "Key (image_url)=(livraison.png) already exists." } },
            { data: null, error: new Error("db down") },
        )
        mediaMocks.detectMediaConflict
            .mockReturnValueOnce({ field: "image" })
            .mockReturnValueOnce(null)
        mediaMocks.relocateThematiqueMedia.mockResolvedValueOnce("livraison-2.png")

        let caught: unknown
        await svc.patchThematiqueWithMediaRetry("t1", "Livraison", "Delivery", "livraison.png", "").catch((err) => { caught = err })

        expect(caught).toBeInstanceOf(svc.ThematiqueMediaWriteError)
        expect((caught as InstanceType<typeof svc.ThematiqueMediaWriteError>).lastImageUrl).toBe("livraison-2.png")
    })
})

describe("upsertBrief / upsertChiffres", () => {
    test("upsertBrief ne lève pas d'erreur en cas de succès", async () => {
        mocks.fromResults.push({ data: null, error: null })
        await expect(svc.upsertBrief("brief fr", "brief en")).resolves.toBeUndefined()
    })

    test("upsertBrief propage l'erreur", async () => {
        mocks.fromResults.push({ data: null, error: new Error("upsert failed") })
        await expect(svc.upsertBrief("x", "y")).rejects.toThrow("upsert failed")
    })

    test("upsertChiffres ne lève pas d'erreur en cas de succès", async () => {
        mocks.fromResults.push({ data: null, error: null })
        await expect(svc.upsertChiffres("100", "100")).resolves.toBeUndefined()
    })

    test("upsertChiffres propage l'erreur", async () => {
        mocks.fromResults.push({ data: null, error: new Error("upsert failed") })
        await expect(svc.upsertChiffres("x", "y")).rejects.toThrow("upsert failed")
    })
})

describe("insertQR / patchQR / removeQR", () => {
    test("insertQR insère la ligne et retourne la Q&R créée", async () => {
        mocks.fromResults.push({ data: { id: "qr1", question: "Q" }, error: null })
        const row = await svc.insertQR("t1", { question: "Q", questionEn: "Q-en", briefQr: "R", briefQrEn: "R-en" }, 0, "user-1")
        expect(row).toEqual({ id: "qr1", question: "Q" })
    })

    test("insertQR propage l'erreur", async () => {
        mocks.fromResults.push({ data: null, error: new Error("insert failed") })
        await expect(
            svc.insertQR("t1", { question: "Q", questionEn: "", briefQr: "", briefQrEn: "" }, 0, "user-1")
        ).rejects.toThrow("insert failed")
    })

    test("patchQR ne lève pas d'erreur en cas de succès", async () => {
        mocks.fromResults.push({ data: null, error: null })
        await expect(
            svc.patchQR("qr1", { question: "Q", questionEn: "", briefQr: "", briefQrEn: "" }, "t1")
        ).resolves.toBeUndefined()
    })

    test("patchQR propage l'erreur", async () => {
        mocks.fromResults.push({ data: null, error: new Error("update failed") })
        await expect(
            svc.patchQR("qr1", { question: "Q", questionEn: "", briefQr: "", briefQrEn: "" }, "t1")
        ).rejects.toThrow("update failed")
    })

    test("removeQR ne lève pas d'erreur en cas de succès", async () => {
        mocks.fromResults.push({ data: null, error: null })
        await expect(svc.removeQR("qr1")).resolves.toBeUndefined()
    })

    test("removeQR propage l'erreur", async () => {
        mocks.fromResults.push({ data: null, error: new Error("delete failed") })
        await expect(svc.removeQR("qr1")).rejects.toThrow("delete failed")
    })
})

describe("upsertFormatMap", () => {
    test("ne lève pas d'erreur en cas de succès", async () => {
        mocks.fromResults.push({ data: null, error: null })
        const map = { email: "e", emailEn: "", instagram: "i", instagramEn: "", whatsapp: "w", whatsappEn: "" }
        await expect(svc.upsertFormatMap("qr1", map)).resolves.toBeUndefined()
    })

    test("propage l'erreur si l'upsert échoue", async () => {
        mocks.fromResults.push({ data: null, error: new Error("upsert failed") })
        const map = { email: "", emailEn: "", instagram: "", instagramEn: "", whatsapp: "", whatsappEn: "" }
        await expect(svc.upsertFormatMap("qr1", map)).rejects.toThrow("upsert failed")
    })
})

// ── subscribeBiblioRealtime / unsubscribeBiblioRealtime ───────────────────────
// Ces deux fonctions ont été déplacées ici depuis useBiblioRealtime.ts (qui
// parlait directement à `db`, en violation de la règle "couche service
// obligatoire" — voir CLAUDE.md). Le nom du canal et le câblage table/événement
// → handler sont couverts ici ; le contenu métier des handlers eux-mêmes
// (mapping, mises à jour de state) reste testé dans useBiblioRealtime.test.ts.

function noopHandlers(): svc.BiblioRealtimeHandlers {
    return {
        onThematiqueInsert: rstest.fn(), onThematiqueUpdate: rstest.fn(), onThematiqueDelete: rstest.fn(),
        onQRInsert: rstest.fn(), onQRUpdate: rstest.fn(), onQRDelete: rstest.fn(),
        onFormatInsert: rstest.fn(), onFormatUpdate: rstest.fn(), onFormatDelete: rstest.fn(),
        onBriefInsert: rstest.fn(), onBriefUpdate: rstest.fn(),
    }
}

describe("subscribeBiblioRealtime", () => {
    test("ouvre un canal nommé d'après userId", () => {
        svc.subscribeBiblioRealtime("user-42", noopHandlers())
        expect(mocks.channel).toHaveBeenCalledWith("bibliotheque_realtime_user-42")
    })

    test("branche chaque handler sur la bonne combinaison table/événement", () => {
        const handlers = noopHandlers()
        svc.subscribeBiblioRealtime("user-1", handlers)

        expect(mocks.registeredHandlers.get("INSERT:bibliotheque_thematiques")).toBe(handlers.onThematiqueInsert)
        expect(mocks.registeredHandlers.get("UPDATE:bibliotheque_thematiques")).toBe(handlers.onThematiqueUpdate)
        expect(mocks.registeredHandlers.get("DELETE:bibliotheque_thematiques")).toBe(handlers.onThematiqueDelete)
        expect(mocks.registeredHandlers.get("INSERT:bibliotheque_questions_reponses")).toBe(handlers.onQRInsert)
        expect(mocks.registeredHandlers.get("UPDATE:bibliotheque_questions_reponses")).toBe(handlers.onQRUpdate)
        expect(mocks.registeredHandlers.get("DELETE:bibliotheque_questions_reponses")).toBe(handlers.onQRDelete)
        expect(mocks.registeredHandlers.get("INSERT:bibliotheque_format_reponses")).toBe(handlers.onFormatInsert)
        expect(mocks.registeredHandlers.get("UPDATE:bibliotheque_format_reponses")).toBe(handlers.onFormatUpdate)
        expect(mocks.registeredHandlers.get("DELETE:bibliotheque_format_reponses")).toBe(handlers.onFormatDelete)
        expect(mocks.registeredHandlers.get("INSERT:bibliotheque_brief")).toBe(handlers.onBriefInsert)
        expect(mocks.registeredHandlers.get("UPDATE:bibliotheque_brief")).toBe(handlers.onBriefUpdate)
        // Le brief est un singleton, jamais supprimé : pas de handler DELETE.
        expect(mocks.registeredHandlers.has("DELETE:bibliotheque_brief")).toBe(false)
    })

    test("retourne le canal (chaînable, résultat de .subscribe())", () => {
        const result = svc.subscribeBiblioRealtime("user-1", noopHandlers())
        expect(result).toBe(mocks.channelObj)
    })
})

describe("unsubscribeBiblioRealtime", () => {
    test("appelle db.removeChannel avec le canal fourni", () => {
        const channel = svc.subscribeBiblioRealtime("user-1", noopHandlers())
        svc.unsubscribeBiblioRealtime(channel)
        expect(mocks.removeChannel).toHaveBeenCalledWith(channel)
    })
})
