// ── useBibli.test.ts ──────────────────────────────────────────────────────────
// Tests unitaires du hook de données central (useBibli.ts) — jusqu'ici à 0% de
// couverture malgré une criticité élevée : c'est ici que vivent les mises à
// jour optimistes, le rollback de position en cas d'échec (voir le bug corrigé
// de collision de position sur créations concurrentes), et le nettoyage local
// en cascade lors d'une suppression de thématique.
//
// Dépendances mockées :
//   - @/features/auth/hooks/useAuth/AuthProvider → utilisateur authentifié fixe
//   - services/bibliothequeService (svc.*)        → toutes les opérations Supabase
//   - ./useBiblioRealtime                          → no-op : ce hook est testé
//     séparément (useBiblioRealtime.test.ts). Le mocker ici évite d'ouvrir un
//     vrai canal Supabase Realtime pendant les tests de useBibli, ET signifie
//     que fetchAll() n'est PAS appelé automatiquement au montage (c'est
//     useBiblioRealtime, pas useBibli, qui déclenche fetchAll — voir son
//     useEffect). Chaque test appelle donc `refetch()` explicitement s'il a
//     besoin de données initiales.

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { act, renderHook } from "@testing-library/react"
import type { ThematiqueRow, QRRow, FormatRow, BriefRow } from "../../services/mappers"

const mocks = rstest.hoisted(() => ({
    fetchAllBiblioData: rstest.fn(),
    insertThematique: rstest.fn(),
    patchThematique: rstest.fn(),
    removeThematique: rstest.fn(),
    insertThematiqueWithMediaRetry: rstest.fn(),
    patchThematiqueWithMediaRetry: rstest.fn(),
    // Classe réelle (pas un mock) : useBibli.ts fait `err instanceof
    // svc.ThematiqueMediaWriteError` — un rstest.fn() ne passerait jamais ce
    // test `instanceof`, il faut la vraie implémentation pour ce mock.
    ThematiqueMediaWriteError: class ThematiqueMediaWriteError extends Error {
        constructor(public cause: unknown, public lastImageUrl: string, public lastIconUrl: string) { super() }
    },
    uploadThematiqueImage: rstest.fn(),
    uploadThematiqueIcon: rstest.fn(),
    discardUnsavedThematiqueMedia: rstest.fn(),
    replaceThematiqueImage: rstest.fn(),
    deleteThematiqueMedia: rstest.fn(),
    resolveThematiqueMediaUrl: rstest.fn(),
    syncThematiqueMediaNaming: rstest.fn(),
    revertMediaMove: rstest.fn(),
    upsertBrief: rstest.fn(),
    upsertChiffres: rstest.fn(),
    insertQR: rstest.fn(),
    patchQR: rstest.fn(),
    removeQR: rstest.fn(),
    upsertFormatMap: rstest.fn(),
    // Conteneur mutable : le test "utilisateur non authentifié" le remplace
    // avant de monter le hook (useAuth() lit `.current` au moment du RENDU).
    authValue: { current: { user: { user_id: "user-1", id: "user-1" } } as { user: { user_id: string; id: string } | null } },
}))

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix
    useAuth: () => mocks.authValue.current,
}))

rstest.mock("@/features/bibliotheque/services/bibliothequeService", () => mocks)

rstest.mock("./useBiblioRealtime", () => ({
    useBiblioRealtime: () => { /* no-op — testé séparément */ },
}))

import { useBibli } from "./useBibli"
import { silenceExpectedLogs } from "@/shared/lib/testing"

// Ces tests provoquent volontairement des erreurs pour vérifier leur gestion :
// le log applicatif qui en résulte est attendu, pas un symptôme.
silenceExpectedLogs("[useBibli]", "[useBiblioQR]")

const mkThematiqueRow = (overrides: Partial<ThematiqueRow> = {}): ThematiqueRow => ({
    id: "t1", label: "Livraison", label_en: "Delivery",
    image_url: "", icon_url: "", position: 0,
    created_by: "user-1", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
})

const mkQRRow = (overrides: Partial<QRRow> = {}): QRRow => ({
    id: "qr1", thematique_id: "t1", question: "Q", question_en: "Q-en",
    brief_qr: "R", brief_qr_en: "R-en", position: 0,
    created_by: "user-1", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
})

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.authValue.current = { user: { user_id: "user-1", id: "user-1" } }
    mocks.fetchAllBiblioData.mockResolvedValue({
        thematiques: [], questionsReponses: [], formatReponses: [], brief: null,
    } satisfies { thematiques: ThematiqueRow[]; questionsReponses: QRRow[]; formatReponses: FormatRow[]; brief: BriefRow | null })
    mocks.discardUnsavedThematiqueMedia.mockResolvedValue(undefined)
    mocks.deleteThematiqueMedia.mockResolvedValue(undefined)
    mocks.resolveThematiqueMediaUrl.mockImplementation((v: string) => v)
    mocks.revertMediaMove.mockResolvedValue(undefined)
})

// ── Chargement initial (fetchAll / refetch) ────────────────────────────────────

describe("useBibli — fetchAll (refetch)", () => {
    test("loading passe à false et les données sont peuplées après un fetch réussi", async () => {
        mocks.fetchAllBiblioData.mockResolvedValue({
            thematiques: [mkThematiqueRow()],
            questionsReponses: [mkQRRow()],
            formatReponses: [],
            brief: null,
        })
        const { result } = renderHook(() => useBibli())
        expect(result.current.loading).toBe(true)

        await act(async () => { await result.current.refetch() })

        expect(result.current.loading).toBe(false)
        expect(result.current.loadError).toBe(false)
        expect(result.current.thematiques).toHaveLength(1)
        expect(result.current.thematiques[0].id).toBe("t1")
        expect(result.current.questionsReponses).toHaveLength(1)
    })

    test("loadError passe à true si fetchAllBiblioData rejette, sans laisser loading bloqué", async () => {
        mocks.fetchAllBiblioData.mockRejectedValue(new Error("network down"))
        const { result } = renderHook(() => useBibli())

        await act(async () => { await result.current.refetch() })

        expect(result.current.loadError).toBe(true)
        expect(result.current.loading).toBe(false)
    })
})

// ── createThematique : succès, échec simple, rollback concurrent ─────────────

describe("useBibli — createThematique", () => {
    test("ne fait rien et retourne null si aucun utilisateur n'est authentifié", async () => {
        mocks.authValue.current = { user: null }
        const { result } = renderHook(() => useBibli())

        let created
        await act(async () => {
            created = await result.current.createThematique("X", "X", "", "")
        })

        expect(created).toBeNull()
        expect(mocks.insertThematiqueWithMediaRetry).not.toHaveBeenCalled()
    })

    test("ajoute la thématique de façon optimiste et retourne l'item créé", async () => {
        mocks.insertThematiqueWithMediaRetry.mockResolvedValue(mkThematiqueRow({ id: "new-t", label: "Nouveau" }))
        const { result } = renderHook(() => useBibli())

        let created
        await act(async () => {
            created = await result.current.createThematique("Nouveau", "New", "", "")
        })

        expect(created).toMatchObject({ id: "new-t", label: "Nouveau" })
        expect(result.current.thematiques.some((t) => t.id === "new-t")).toBe(true)
    })

    test("échec simple : retourne null et n'ajoute rien à l'état local", async () => {
        mocks.insertThematiqueWithMediaRetry.mockRejectedValue(new Error("insert failed"))
        const { result } = renderHook(() => useBibli())

        let created
        await act(async () => {
            created = await result.current.createThematique("X", "X", "", "")
        })

        expect(created).toBeNull()
        expect(result.current.thematiques).toHaveLength(0)
    })

    test("rollback de position : un échec APRÈS qu'une création concurrente a réussi ne fait pas reculer le compteur sous la position déjà prise (pas de collision future)", async () => {
        // Reproduit exactement le scénario du bug corrigé : A réserve la position 0,
        // B réserve la position 1 et réussit AVANT que A échoue. Sans le correctif,
        // le rollback de A remettrait le compteur à -1, et une création C suivante
        // obtiendrait la position 0 puis une D obtiendrait la position 1 — collision
        // avec B, déjà en base à la position 1. Avec le correctif, le rollback de A
        // est ignoré (le compteur a déjà avancé au-delà de la position de A), donc
        // les créations suivantes ne réutilisent jamais une position occupée.
        let rejectA!: (err: Error) => void
        const pendingA = new Promise<ThematiqueRow>((_resolve, reject) => { rejectA = reject })
        let resolveB!: (row: ThematiqueRow) => void
        const pendingB = new Promise<ThematiqueRow>((resolve) => { resolveB = resolve })

        mocks.insertThematiqueWithMediaRetry
            .mockImplementationOnce(() => pendingA)
            .mockImplementationOnce(() => pendingB)
            .mockImplementationOnce((label: string) => Promise.resolve(mkThematiqueRow({ id: "c", label })))

        const { result } = renderHook(() => useBibli())

        // A et B sont lancées "en même temps" (aucun await entre les deux appels) :
        // leurs préfixes synchrones (incrémentation du ref + appel insertThematique)
        // s'exécutent l'un après l'autre AVANT que l'une ou l'autre ne se résolve.
        let promiseA!: Promise<unknown>
        let promiseB!: Promise<unknown>
        act(() => {
            promiseA = result.current.createThematique("A", "A", "", "")
            promiseB = result.current.createThematique("B", "B", "", "")
        })

        // B réussit d'abord, puis A échoue
        await act(async () => {
            resolveB(mkThematiqueRow({ id: "b", label: "B", position: 1 }))
            await promiseB
            rejectA(new Error("insert A failed"))
            await promiseA
        })

        // C est créée après coup : sa position ne doit PAS collisionner avec B (1)
        await act(async () => { await result.current.createThematique("C", "C", "", "") })

        const positionsRequested = mocks.insertThematiqueWithMediaRetry.mock.calls.map((call: unknown[]) => call[4])
        // A a demandé la position 0, B la position 1 ; C ne doit pas redemander 0 ou 1
        expect(positionsRequested[0]).toBe(0)
        expect(positionsRequested[1]).toBe(1)
        expect(positionsRequested[2]).toBe(2)
    })
})

// ── createQR : même garde-fou de rollback, côté par-thématique ───────────────

describe("useBibli — createQR", () => {
    test("ajoute la Q&R de façon optimiste et retourne l'item créé", async () => {
        mocks.insertQR.mockResolvedValue(mkQRRow({ id: "new-qr" }))
        const { result } = renderHook(() => useBibli())

        let created
        await act(async () => {
            created = await result.current.createQR("t1", {
                question: "Q", questionEn: "Q-en", briefQr: "R", briefQrEn: "R-en",
            })
        })

        expect(created).toMatchObject({ id: "new-qr" })
        expect(result.current.questionsReponses.some((qr) => qr.id === "new-qr")).toBe(true)
    })

    test("le rollback après échec ne recule pas si une autre création sur la MÊME thématique a déjà avancé la position", async () => {
        let rejectA!: (err: Error) => void
        const pendingA = new Promise<QRRow>((_resolve, reject) => { rejectA = reject })
        let resolveB!: (row: QRRow) => void
        const pendingB = new Promise<QRRow>((resolve) => { resolveB = resolve })

        mocks.insertQR
            .mockImplementationOnce(() => pendingA)
            .mockImplementationOnce(() => pendingB)
            .mockImplementationOnce(() => Promise.resolve(mkQRRow({ id: "c" })))

        const { result } = renderHook(() => useBibli())
        const content = { question: "Q", questionEn: "Q-en", briefQr: "R", briefQrEn: "R-en" }

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
        expect(positionsRequested[0]).toBe(0)
        expect(positionsRequested[1]).toBe(1)
        expect(positionsRequested[2]).toBe(2)
    })
})

// ── deleteThematique : nettoyage local en cascade ──────────────────────────────

describe("useBibli — deleteThematique", () => {
    test("supprime la thématique ET ses Q&R associées ET leurs formats, localement", async () => {
        mocks.fetchAllBiblioData.mockResolvedValue({
            thematiques: [mkThematiqueRow({ id: "t1" })],
            questionsReponses: [
                mkQRRow({ id: "qr1", thematique_id: "t1" }),
                mkQRRow({ id: "qr2", thematique_id: "t1" }),
                mkQRRow({ id: "qr-other", thematique_id: "t-other" }),
            ],
            formatReponses: [],
            brief: null,
        })
        mocks.removeThematique.mockResolvedValue(undefined)

        const { result } = renderHook(() => useBibli())
        await act(async () => { await result.current.refetch() })
        expect(result.current.questionsReponses).toHaveLength(3)

        let ok
        await act(async () => {
            ok = await result.current.deleteThematique("t1", "image.png", "icons/icon.svg")
        })

        expect(ok).toBe(true)
        expect(result.current.thematiques.some((t) => t.id === "t1")).toBe(false)
        // Les Q&R de t1 disparaissent, celle de t-other reste
        expect(result.current.questionsReponses).toHaveLength(1)
        expect(result.current.questionsReponses[0].id).toBe("qr-other")
        // Le nettoyage Storage best-effort est déclenché avec les bons chemins
        expect(mocks.deleteThematiqueMedia).toHaveBeenCalledWith("image.png", "icons/icon.svg")
    })

    test("retourne false et ne modifie pas l'état local si la suppression échoue en base", async () => {
        mocks.fetchAllBiblioData.mockResolvedValue({
            thematiques: [mkThematiqueRow({ id: "t1" })],
            questionsReponses: [],
            formatReponses: [],
            brief: null,
        })
        mocks.removeThematique.mockRejectedValue(new Error("delete failed"))

        const { result } = renderHook(() => useBibli())
        await act(async () => { await result.current.refetch() })

        let ok
        await act(async () => {
            ok = await result.current.deleteThematique("t1", "", "")
        })

        expect(ok).toBe(false)
        expect(result.current.thematiques.some((t) => t.id === "t1")).toBe(true)
    })
})

// ── updateThematique : renommage Storage conditionnel ─────────────────────────

describe("useBibli — updateThematique", () => {
    test("appelle syncThematiqueMediaNaming quand previousLabel diffère du nouveau label", async () => {
        mocks.syncThematiqueMediaNaming.mockResolvedValue({ imageUrl: "nouveau.png", iconUrl: "" })
        mocks.patchThematiqueWithMediaRetry.mockResolvedValue({ imageUrl: "nouveau.png", iconUrl: "" })
        const { result } = renderHook(() => useBibli())

        await act(async () => {
            await result.current.updateThematique("t1", "Nouveau nom", "New name", "ancien.png", "", "Ancien nom")
        })

        expect(mocks.syncThematiqueMediaNaming).toHaveBeenCalledWith("t1", "Nouveau nom", "ancien.png", "")
        // La valeur persistée est celle renvoyée par le renommage, pas l'ancienne
        expect(mocks.patchThematiqueWithMediaRetry).toHaveBeenCalledWith("t1", "Nouveau nom", "New name", "nouveau.png", "")
    })

    test("n'appelle PAS syncThematiqueMediaNaming quand le label ne change pas (previousLabel === label)", async () => {
        mocks.patchThematiqueWithMediaRetry.mockResolvedValue({ imageUrl: "image.png", iconUrl: "" })
        const { result } = renderHook(() => useBibli())

        await act(async () => {
            await result.current.updateThematique("t1", "Même nom", "Same name", "image.png", "", "Même nom")
        })

        expect(mocks.syncThematiqueMediaNaming).not.toHaveBeenCalled()
    })

    test("n'appelle PAS syncThematiqueMediaNaming quand previousLabel est omis (pas de renommage en cours)", async () => {
        mocks.patchThematiqueWithMediaRetry.mockResolvedValue({ imageUrl: "image.png", iconUrl: "" })
        const { result } = renderHook(() => useBibli())

        await act(async () => {
            await result.current.updateThematique("t1", "Nom", "Name", "image.png", "")
        })

        expect(mocks.syncThematiqueMediaNaming).not.toHaveBeenCalled()
    })

    test("un échec de renommage Storage (best-effort) n'empêche pas la sauvegarde du reste", async () => {
        mocks.syncThematiqueMediaNaming.mockRejectedValue(new Error("storage move failed"))
        mocks.patchThematiqueWithMediaRetry.mockResolvedValue({ imageUrl: "image.png", iconUrl: "" })
        const { result } = renderHook(() => useBibli())

        let ok
        await act(async () => {
            ok = await result.current.updateThematique("t1", "Nouveau", "New", "image.png", "", "Ancien")
        })

        expect(ok).toBe(true)
        // Les valeurs d'origine (non renommées) sont utilisées puisque le renommage a échoué
        expect(mocks.patchThematiqueWithMediaRetry).toHaveBeenCalledWith("t1", "Nouveau", "New", "image.png", "")
    })

    test("si patchThematiqueWithMediaRetry échoue APRÈS un renommage Storage réussi, le fichier est ramené à son ancien chemin (rollback)", async () => {
        // Storage a déjà déplacé le fichier vers "nouveau.png" (renommage réussi),
        // mais l'écriture DB qui devait suivre échoue (sans conflit média, donc
        // sans relocalisation supplémentaire — lastImageUrl reste "nouveau.png") :
        // sans rollback, la base référencerait encore "ancien.png" alors que le
        // fichier vit désormais à "nouveau.png" — l'image casserait partout
        // jusqu'à la prochaine sauvegarde.
        mocks.syncThematiqueMediaNaming.mockResolvedValue({ imageUrl: "nouveau.png", iconUrl: "" })
        mocks.patchThematiqueWithMediaRetry.mockRejectedValue(
            new mocks.ThematiqueMediaWriteError(new Error("db write failed"), "nouveau.png", "")
        )

        const { result } = renderHook(() => useBibli())

        let ok
        await act(async () => {
            ok = await result.current.updateThematique("t1", "Nouveau nom", "New name", "ancien.png", "", "Ancien nom")
        })

        expect(ok).toBe(false)
        expect(mocks.revertMediaMove).toHaveBeenCalledWith("nouveau.png", "ancien.png")
    })

    test("un échec du rollback (revertMediaMove) lui-même est journalisé plutôt qu'avalé en silence", async () => {
        // Le rollback est best-effort (ne doit pas faire planter updateThematique
        // si le Storage est déjà indisponible), mais une erreur totalement
        // silencieuse rendrait impossible tout diagnostic d'un fichier resté à un
        // chemin incohérent avec la base — voir le catch dans useBibli.ts.
        mocks.syncThematiqueMediaNaming.mockResolvedValue({ imageUrl: "nouveau.png", iconUrl: "" })
        mocks.patchThematiqueWithMediaRetry.mockRejectedValue(
            new mocks.ThematiqueMediaWriteError(new Error("db write failed"), "nouveau.png", "")
        )
        mocks.revertMediaMove.mockRejectedValue(new Error("storage unavailable"))
        const errSpy = rstest.spyOn(console, "error").mockImplementation(() => {})

        const { result } = renderHook(() => useBibli())
        let ok
        await act(async () => {
            ok = await result.current.updateThematique("t1", "Nouveau nom", "New name", "ancien.png", "", "Ancien nom")
        })
        // Laisse le microtask du .catch() du rollback s'exécuter
        await act(async () => { await Promise.resolve() })

        expect(ok).toBe(false)
        expect(errSpy).toHaveBeenCalledWith(
            expect.stringContaining("revertMediaMove"),
            expect.any(Error)
        )
        errSpy.mockRestore()
    })

    test("le rollback utilise le DERNIER chemin relocalisé (lastImageUrl), pas la valeur d'origine, quand une retry a eu lieu avant l'échec définitif", async () => {
        // syncThematiqueMediaNaming a déplacé le fichier vers "nouveau.png", mais
        // patchThematiqueWithMediaRetry a lui-même dû relocaliser une deuxième
        // fois (conflit détecté en base) vers "nouveau-2.png" avant d'abandonner.
        // Le rollback doit cibler ce DERNIER emplacement physique, pas "nouveau.png".
        mocks.syncThematiqueMediaNaming.mockResolvedValue({ imageUrl: "nouveau.png", iconUrl: "" })
        mocks.patchThematiqueWithMediaRetry.mockRejectedValue(
            new mocks.ThematiqueMediaWriteError(new Error("db write failed"), "nouveau-2.png", "")
        )

        const { result } = renderHook(() => useBibli())

        await act(async () => {
            await result.current.updateThematique("t1", "Nouveau nom", "New name", "ancien.png", "", "Ancien nom")
        })

        expect(mocks.revertMediaMove).toHaveBeenCalledWith("nouveau-2.png", "ancien.png")
    })

    test("ne tente aucun rollback si le renommage Storage n'a rien changé (échec DB sans média déplacé)", async () => {
        mocks.patchThematiqueWithMediaRetry.mockRejectedValue(
            new mocks.ThematiqueMediaWriteError(new Error("db write failed"), "image.png", "")
        )
        const { result } = renderHook(() => useBibli())

        await act(async () => {
            await result.current.updateThematique("t1", "Nom", "Name", "image.png", "")
        })

        expect(mocks.revertMediaMove).not.toHaveBeenCalled()
    })

    // ── Nettoyage de l'ancien média quand il est REMPLACÉ par un nouveau fichier ──
    // Bug corrigé : jusqu'ici, seul le cas "même fichier, juste renommé" était
    // couvert par syncThematiqueMediaNaming (Storage.move). Si l'utilisateur
    // choisit un NOUVEAU fichier pendant l'édition (avec ou sans renommage du
    // label), l'ancien fichier restait orphelin dans le bucket pour toujours.

    test("supprime l'ancienne image quand une NOUVELLE image a été téléversée pendant un renommage", async () => {
        // Le nouveau fichier a déjà été téléversé sous le nouveau nom avant l'appel
        // (comportement de ThematiqueFormDialog) : syncThematiqueMediaNaming ne
        // fait rien (targetPath === currentPath, déjà synchronisé), donc l'ancien
        // chemin ne serait jamais nettoyé sans le paramètre previousImageUrl.
        mocks.syncThematiqueMediaNaming.mockResolvedValue({ imageUrl: "nouveau-nom.png", iconUrl: "" })
        mocks.patchThematiqueWithMediaRetry.mockResolvedValue({ imageUrl: "nouveau-nom.png", iconUrl: "" })
        const { result } = renderHook(() => useBibli())

        await act(async () => {
            await result.current.updateThematique(
                "t1", "Nouveau nom", "New name", "nouveau-nom.png", "", "Ancien nom",
                "ancien-nom.png", "",
            )
        })

        expect(mocks.deleteThematiqueMedia).toHaveBeenCalledWith("ancien-nom.png", "")
    })

    test("supprime l'ancienne icône quand une NOUVELLE icône a été téléversée, SANS renommage du label", async () => {
        // previousLabel omis : pas de renommage, syncThematiqueMediaNaming n'est
        // même pas appelé — mais un nouveau fichier a quand même été choisi.
        mocks.patchThematiqueWithMediaRetry.mockResolvedValue({ imageUrl: "", iconUrl: "icons/livraison-2.svg" })
        const { result } = renderHook(() => useBibli())

        await act(async () => {
            await result.current.updateThematique(
                "t1", "Livraison", "Delivery", "", "icons/livraison-2.svg", undefined,
                "", "icons/livraison.svg",
            )
        })

        expect(mocks.syncThematiqueMediaNaming).not.toHaveBeenCalled()
        expect(mocks.deleteThematiqueMedia).toHaveBeenCalledWith("", "icons/livraison.svg")
    })

    test("ne supprime rien si l'image/icône n'a pas changé (previousImageUrl/previousIconUrl identiques au résultat final)", async () => {
        mocks.patchThematiqueWithMediaRetry.mockResolvedValue({ imageUrl: "image.png", iconUrl: "icon.svg" })
        const { result } = renderHook(() => useBibli())

        await act(async () => {
            await result.current.updateThematique(
                "t1", "Nom", "Name", "image.png", "icon.svg", undefined,
                "image.png", "icon.svg",
            )
        })

        expect(mocks.deleteThematiqueMedia).not.toHaveBeenCalled()
    })

    test("le nettoyage compare au chemin RÉELLEMENT écrit en base (après relocalisation), pas à la valeur envoyée avant retry", async () => {
        // patchThematiqueWithMediaRetry a dû relocaliser vers un chemin différent
        // de celui initialement proposé (conflit détecté en base) — le nettoyage
        // de l'ancien média ne doit pas se déclencher à tort sur cette différence
        // intermédiaire, seulement comparer previousImageUrl au résultat FINAL.
        mocks.patchThematiqueWithMediaRetry.mockResolvedValue({ imageUrl: "nouveau-nom-2.png", iconUrl: "" })
        const { result } = renderHook(() => useBibli())

        await act(async () => {
            await result.current.updateThematique(
                "t1", "Nouveau nom", "New name", "nouveau-nom.png", "", undefined,
                "ancien-nom.png", "",
            )
        })

        expect(mocks.deleteThematiqueMedia).toHaveBeenCalledWith("ancien-nom.png", "")
    })

    test("le nettoyage est best-effort : une erreur ne fait pas échouer la sauvegarde déjà réussie", async () => {
        mocks.patchThematiqueWithMediaRetry.mockResolvedValue({ imageUrl: "nouveau.png", iconUrl: "" })
        mocks.deleteThematiqueMedia.mockRejectedValue(new Error("remove failed"))
        const { result } = renderHook(() => useBibli())

        let ok
        await act(async () => {
            ok = await result.current.updateThematique(
                "t1", "Nom", "Name", "nouveau.png", "", undefined, "ancien.png", "",
            )
        })

        expect(ok).toBe(true)
    })
})

// ── updateQR / deleteQR / upsertFormat : succès et échec ──────────────────────

describe("useBibli — updateQR, deleteQR, upsertFormat", () => {
    test("updateQR retourne true et met à jour l'état local en cas de succès", async () => {
        mocks.fetchAllBiblioData.mockResolvedValue({
            thematiques: [], questionsReponses: [mkQRRow({ id: "qr1", question: "Ancienne" })],
            formatReponses: [], brief: null,
        })
        mocks.patchQR.mockResolvedValue(undefined)
        const { result } = renderHook(() => useBibli())
        await act(async () => { await result.current.refetch() })

        let ok
        await act(async () => {
            ok = await result.current.updateQR("qr1", { question: "Nouvelle", questionEn: "New", briefQr: "R", briefQrEn: "R-en" }, "t1")
        })

        expect(ok).toBe(true)
        expect(result.current.questionsReponses[0].question).toBe("Nouvelle")
    })

    test("deleteQR retourne false et ne modifie rien si la suppression échoue", async () => {
        mocks.fetchAllBiblioData.mockResolvedValue({
            thematiques: [], questionsReponses: [mkQRRow({ id: "qr1" })],
            formatReponses: [], brief: null,
        })
        mocks.removeQR.mockRejectedValue(new Error("delete failed"))
        const { result } = renderHook(() => useBibli())
        await act(async () => { await result.current.refetch() })

        let ok
        await act(async () => { ok = await result.current.deleteQR("qr1") })

        expect(ok).toBe(false)
        expect(result.current.questionsReponses).toHaveLength(1)
    })

    test("upsertFormat met à jour formatReponses en cas de succès", async () => {
        mocks.upsertFormatMap.mockResolvedValue(undefined)
        const { result } = renderHook(() => useBibli())
        const map = { email: "e", emailEn: "e-en", instagram: "i", instagramEn: "i-en", whatsapp: "w", whatsappEn: "w-en" }

        let ok
        await act(async () => { ok = await result.current.upsertFormat("qr1", map) })

        expect(ok).toBe(true)
        expect(result.current.formatReponses["qr1"]).toEqual(map)
    })
})
