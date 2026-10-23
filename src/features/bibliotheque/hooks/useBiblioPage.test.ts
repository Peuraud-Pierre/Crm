// ── useBiblioPage.test.ts ─────────────────────────────────────────────────────
// Tests unitaires de l'orchestrateur de page (useBiblioPage.ts) — jusqu'ici à
// 0% de couverture directe (les tests de ThematiqueFormDialog mockent
// entièrement useBiblioContext, donc ce hook n'est jamais réellement monté).
//
// Ce sont pourtant SES handlers qui décident : ferme-t-on le dialog ou affiche-
// t-on un toast d'erreur ? Nettoie-t-on bien detailQRId/activeId quand l'élément
// affiché vient d'être supprimé ? C'est aussi ici que vivait l'incohérence
// dialogRef/dialog corrigée en revue (un seul handler sur cinq lisait la valeur
// fraîche via la ref, les quatre autres une closure potentiellement obsolète).
//
// Frontière de mock : SEUL useBibli est mocké (c'est la vraie frontière I/O —
// Supabase). useDialog et useSearch sont utilisés RÉELS : ce sont de simples
// machines à états sans dépendance externe, et les tester en vrai exerce
// exactement le chemin dialogRef.current / dialog qu'on veut vérifier — un mock
// de useDialog masquerait la classe de bug qu'on cherche à couvrir.

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { act, renderHook } from "@testing-library/react"
import type { Thematique, QR, QRContent, FormatMap } from "../types"

const mocks = rstest.hoisted(() => {
    const toastError = rstest.fn()
    const makeUseBibliReturn = () => ({
        thematiques: [] as Thematique[],
        questionsReponses: [] as QR[],
        formatReponses: {} as Record<string, FormatMap>,
        brief: { brief: "", briefEn: "", chiffres: "", chiffresEn: "" },
        loading: false,
        loadError: false,
        refetch: rstest.fn(),
        createThematique: rstest.fn(),
        updateThematique: rstest.fn(),
        uploadThematiqueImage: rstest.fn(),
        uploadThematiqueIcon: rstest.fn(),
        discardUnsavedThematiqueMedia: rstest.fn(),
        replaceThematiqueImage: rstest.fn(),
        resolveThematiqueMediaUrl: rstest.fn((v: string) => v),
        updateBrief: rstest.fn(),
        updateChiffres: rstest.fn(),
        deleteThematique: rstest.fn(),
        createQR: rstest.fn(),
        updateQR: rstest.fn(),
        deleteQR: rstest.fn(),
        upsertFormat: rstest.fn(),
    })
    return {
        toastError,
        useBibliReturn: { current: makeUseBibliReturn() },
        makeUseBibliReturn,
        // Permissions accordées : pilotées par test pour couvrir canManage.
        granted: { current: ["bibliotheque.view", "bibliotheque.manage"] as string[] },
    }
})

rstest.mock("sonner", () => ({
    toast: { error: mocks.toastError, success: rstest.fn() },
}))

// useAuth est l'autre frontière à mocker (comme useBibli pour Supabase) : le hook
// lit hasPermission pour dériver canManage, et le vrai provider n'est pas monté.
rstest.mock("@/features/auth/hooks/useAuth", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix
    useAuth: () => ({
        hasPermission: (code: string) => mocks.granted.current.includes(code),
    }),
}))

rstest.mock("./data/useBibli", () => ({
    // eslint-disable-next-line react-x/no-unnecessary-use-prefix
    useBibli: () => mocks.useBibliReturn.current,
}))

import { useBiblioPage } from "./useBiblioPage"

const mkThematique = (overrides: Partial<Thematique> = {}): Thematique => ({
    id: "t1", label: "Livraison", labelEn: "Delivery", imageUrl: "", iconUrl: "",
    ...overrides,
})

const mkQR = (overrides: Partial<QR> = {}): QR => ({
    id: "qr1", thematiqueId: "t1", question: "Q", questionEn: "Q-en", briefQr: "R", briefQrEn: "R-en",
    ...overrides,
})

const mkQRContent = (): QRContent => ({ question: "Q", questionEn: "Q-en", briefQr: "R", briefQrEn: "R-en" })

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.useBibliReturn.current = mocks.makeUseBibliReturn()
    mocks.granted.current = ["bibliotheque.view", "bibliotheque.manage"]
})

// ── perms ───────────────────────────────────────────────────────────────────────

describe("useBiblioPage — perms.canManage", () => {
    test("vrai quand bibliotheque.manage est accordée", () => {
        const { result } = renderHook(() => useBiblioPage())
        expect(result.current.perms.canManage).toBe(true)
    })

    test("faux avec bibliotheque.view seule — la page reste consultable", () => {
        mocks.granted.current = ["bibliotheque.view"]
        const { result } = renderHook(() => useBiblioPage())
        expect(result.current.perms.canManage).toBe(false)
        // Les données et la navigation restent exposées : lecture seule, pas de blocage.
        expect(result.current.data.thematiques).toEqual([])
        expect(result.current.nav.lang).toBe("fr")
    })
})

// ── handleSaveQR ────────────────────────────────────────────────────────────────

describe("useBiblioPage — handleSaveQR", () => {
    test("mode création : succès → ferme le dialog", async () => {
        mocks.useBibliReturn.current.createQR.mockResolvedValue(mkQR())
        const { result } = renderHook(() => useBiblioPage())
        act(() => result.current.dialogs.openCreateQR())

        await act(async () => {
            await result.current.handlers.handleSaveQR("Q", "R", "Q-en", "R-en", "t1")
        })

        expect(mocks.useBibliReturn.current.createQR).toHaveBeenCalledWith("t1", mkQRContent())
        expect(result.current.dialogs.dialog).toBeNull()
        expect(mocks.toastError).not.toHaveBeenCalled()
    })

    test("mode création : échec → toast d'erreur, le dialog reste ouvert", async () => {
        mocks.useBibliReturn.current.createQR.mockResolvedValue(null)
        const { result } = renderHook(() => useBiblioPage())
        act(() => result.current.dialogs.openCreateQR())

        await act(async () => {
            await result.current.handlers.handleSaveQR("Q", "R", "Q-en", "R-en", "t1")
        })

        expect(mocks.toastError).toHaveBeenCalledTimes(1)
        expect(result.current.dialogs.dialog).toEqual({ mode: "create-qr" })
    })

    test("mode édition : succès → appelle updateQR avec l'id de la QR éditée et ferme le dialog", async () => {
        mocks.useBibliReturn.current.updateQR.mockResolvedValue(true)
        const qr = mkQR({ id: "qr-edit" })
        const { result } = renderHook(() => useBiblioPage())
        act(() => result.current.dialogs.openEditQR(qr))

        await act(async () => {
            await result.current.handlers.handleSaveQR("Q2", "R2", "Q2-en", "R2-en", "t1")
        })

        expect(mocks.useBibliReturn.current.updateQR).toHaveBeenCalledWith(
            "qr-edit", { question: "Q2", briefQr: "R2", questionEn: "Q2-en", briefQrEn: "R2-en" }, "t1"
        )
        expect(result.current.dialogs.dialog).toBeNull()
    })
})

// ── handleDeleteQR ────────────────────────────────────────────────────────────

describe("useBiblioPage — handleDeleteQR", () => {
    test("succès : ferme le dialog et nettoie detailQRId si la QR supprimée était affichée", async () => {
        const qr = mkQR({ id: "qr-del", thematiqueId: "t1" })
        mocks.useBibliReturn.current.thematiques = [mkThematique({ id: "t1" })]
        mocks.useBibliReturn.current.questionsReponses = [qr]
        mocks.useBibliReturn.current.deleteQR.mockResolvedValue(true)

        const { result } = renderHook(() => useBiblioPage())
        act(() => result.current.nav.setDetailQRId("qr-del"))
        act(() => result.current.dialogs.openDeleteQR(qr))

        await act(async () => { await result.current.handlers.handleDeleteQR() })

        expect(mocks.useBibliReturn.current.deleteQR).toHaveBeenCalledWith("qr-del")
        expect(result.current.nav.detailQRId).toBeNull()
        expect(result.current.dialogs.dialog).toBeNull()
    })

    test("échec : toast d'erreur, detailQRId et dialog inchangés", async () => {
        const qr = mkQR({ id: "qr-del" })
        mocks.useBibliReturn.current.deleteQR.mockResolvedValue(false)

        const { result } = renderHook(() => useBiblioPage())
        act(() => result.current.dialogs.openDeleteQR(qr))

        await act(async () => { await result.current.handlers.handleDeleteQR() })

        expect(mocks.toastError).toHaveBeenCalledTimes(1)
        expect(result.current.dialogs.dialog).toEqual({ mode: "delete-qr", qr })
    })
})

// ── handleSaveThematique ──────────────────────────────────────────────────────

describe("useBiblioPage — handleSaveThematique", () => {
    test("mode création : succès → sélectionne automatiquement la thématique créée et ferme le dialog", async () => {
        const created = mkThematique({ id: "t-new" })
        mocks.useBibliReturn.current.createThematique.mockResolvedValue(created)
        const { result } = renderHook(() => useBiblioPage())
        act(() => result.current.dialogs.openCreateThematique())

        await act(async () => {
            await result.current.handlers.handleSaveThematique("Nouveau", "New", "", "")
        })

        expect(result.current.nav.activeId).toBe("t-new")
        expect(result.current.dialogs.dialog).toBeNull()
    })

    test("mode création : échec → toast d'erreur, activeId inchangé", async () => {
        mocks.useBibliReturn.current.createThematique.mockResolvedValue(null)
        const { result } = renderHook(() => useBiblioPage())
        act(() => result.current.dialogs.openCreateThematique())

        await act(async () => {
            await result.current.handlers.handleSaveThematique("X", "X", "", "")
        })

        expect(mocks.toastError).toHaveBeenCalledTimes(1)
        expect(result.current.nav.activeId).toBe("")
    })

    test("mode renommage : succès → ferme le dialog sans changer activeId", async () => {
        mocks.useBibliReturn.current.updateThematique.mockResolvedValue(true)
        const t = mkThematique({ id: "t1", label: "Ancien" })
        const { result } = renderHook(() => useBiblioPage())
        act(() => result.current.dialogs.openRenameThematique(t))

        await act(async () => {
            await result.current.handlers.handleSaveThematique("Nouveau", "New", "", "")
        })

        expect(mocks.useBibliReturn.current.updateThematique).toHaveBeenCalledWith(
            "t1", "Nouveau", "New", "", "", "Ancien", "", ""
        )
        expect(result.current.dialogs.dialog).toBeNull()
    })
})

// ── handleDeleteThematique ────────────────────────────────────────────────────

describe("useBiblioPage — handleDeleteThematique", () => {
    test("succès : désélectionne la thématique active ET nettoie detailQRId si son détail était affiché", async () => {
        const t1 = mkThematique({ id: "t1" })
        const qr = mkQR({ id: "qr1", thematiqueId: "t1" })
        mocks.useBibliReturn.current.thematiques = [t1]
        mocks.useBibliReturn.current.questionsReponses = [qr]
        mocks.useBibliReturn.current.deleteThematique.mockResolvedValue(true)

        const { result } = renderHook(() => useBiblioPage())
        act(() => result.current.nav.setActiveId("t1"))
        act(() => result.current.nav.setDetailQRId("qr1")) // detailThematique sera t1
        act(() => result.current.dialogs.openDeleteThematique(t1))

        await act(async () => { await result.current.handlers.handleDeleteThematique() })

        expect(mocks.useBibliReturn.current.deleteThematique).toHaveBeenCalledWith("t1", "", "")
        expect(result.current.nav.activeId).toBe("")
        expect(result.current.nav.detailQRId).toBeNull()
        expect(result.current.dialogs.dialog).toBeNull()
    })

    test("échec : toast d'erreur, activeId et dialog inchangés", async () => {
        const t1 = mkThematique({ id: "t1" })
        mocks.useBibliReturn.current.thematiques = [t1]
        mocks.useBibliReturn.current.deleteThematique.mockResolvedValue(false)

        const { result } = renderHook(() => useBiblioPage())
        act(() => result.current.nav.setActiveId("t1"))
        act(() => result.current.dialogs.openDeleteThematique(t1))

        await act(async () => { await result.current.handlers.handleDeleteThematique() })

        expect(mocks.toastError).toHaveBeenCalledTimes(1)
        expect(result.current.nav.activeId).toBe("t1")
        expect(result.current.dialogs.dialog).toEqual({ mode: "delete-thematique", thematique: t1 })
    })

    test("utilise l'image_url/icon_url À JOUR de la thématique, pas l'instantané pris à l'ouverture du dialog de confirmation", async () => {
        // Reproduit le bug corrigé : le dialog de confirmation est ouvert avec un
        // instantané de t1 (media "ancien.png"/"ancienne-icone.svg"). Avant que
        // l'utilisateur confirme, un renommage ailleurs déplace le média en
        // Storage (syncThematiqueMediaNaming) — la liste `thematiques` reflète
        // désormais "nouveau.png"/"nouvelle-icone.svg". La suppression doit
        // cibler le chemin ACTUEL, pas l'instantané, sous peine de supprimer le
        // mauvais fichier et laisser le vrai fichier actuel orphelin.
        const t1AtOpen = mkThematique({ id: "t1", imageUrl: "ancien.png", iconUrl: "ancienne-icone.svg" })
        mocks.useBibliReturn.current.thematiques = [t1AtOpen]
        mocks.useBibliReturn.current.deleteThematique.mockResolvedValue(true)

        const { result, rerender } = renderHook(() => useBiblioPage())
        act(() => result.current.dialogs.openDeleteThematique(t1AtOpen))

        // La thématique est renommée ailleurs pendant que la confirmation est affichée
        mocks.useBibliReturn.current.thematiques = [
            mkThematique({ id: "t1", imageUrl: "nouveau.png", iconUrl: "nouvelle-icone.svg" }),
        ]
        rerender()

        await act(async () => { await result.current.handlers.handleDeleteThematique() })

        expect(mocks.useBibliReturn.current.deleteThematique).toHaveBeenCalledWith("t1", "nouveau.png", "nouvelle-icone.svg")
    })

    test("retombe sur l'instantané du dialog si la thématique n'est plus dans la liste locale", async () => {
        const t1 = mkThematique({ id: "t1", imageUrl: "image.png", iconUrl: "icon.svg" })
        mocks.useBibliReturn.current.thematiques = [t1]
        mocks.useBibliReturn.current.deleteThematique.mockResolvedValue(true)

        const { result, rerender } = renderHook(() => useBiblioPage())
        act(() => result.current.dialogs.openDeleteThematique(t1))

        // Plus aucune trace de t1 dans la liste locale (cas limite)
        mocks.useBibliReturn.current.thematiques = []
        rerender()

        await act(async () => { await result.current.handlers.handleDeleteThematique() })

        expect(mocks.useBibliReturn.current.deleteThematique).toHaveBeenCalledWith("t1", "image.png", "icon.svg")
    })

    test("ne désélectionne PAS si la thématique supprimée n'est pas l'active", async () => {
        const t1 = mkThematique({ id: "t1" })
        const t2 = mkThematique({ id: "t2" })
        mocks.useBibliReturn.current.thematiques = [t1, t2]
        mocks.useBibliReturn.current.deleteThematique.mockResolvedValue(true)

        const { result } = renderHook(() => useBiblioPage())
        act(() => result.current.nav.setActiveId("t2"))
        act(() => result.current.dialogs.openDeleteThematique(t1))

        await act(async () => { await result.current.handlers.handleDeleteThematique() })

        expect(result.current.nav.activeId).toBe("t2")
    })
})

// ── handleSaveFormat ──────────────────────────────────────────────────────────

describe("useBiblioPage — handleSaveFormat", () => {
    test("succès : ferme le dialog", async () => {
        mocks.useBibliReturn.current.upsertFormat.mockResolvedValue(true)
        const qr = mkQR({ id: "qr1" })
        const { result } = renderHook(() => useBiblioPage())
        act(() => result.current.dialogs.openEditFormat(qr))

        const map: FormatMap = { email: "e", emailEn: "", instagram: "i", instagramEn: "", whatsapp: "w", whatsappEn: "" }
        await act(async () => { await result.current.handlers.handleSaveFormat(map) })

        expect(mocks.useBibliReturn.current.upsertFormat).toHaveBeenCalledWith("qr1", map)
        expect(result.current.dialogs.dialog).toBeNull()
    })

    test("échec : toast d'erreur, dialog reste ouvert", async () => {
        mocks.useBibliReturn.current.upsertFormat.mockResolvedValue(false)
        const qr = mkQR({ id: "qr1" })
        const { result } = renderHook(() => useBiblioPage())
        act(() => result.current.dialogs.openEditFormat(qr))

        const map: FormatMap = { email: "", emailEn: "", instagram: "", instagramEn: "", whatsapp: "", whatsappEn: "" }
        await act(async () => { await result.current.handlers.handleSaveFormat(map) })

        expect(mocks.toastError).toHaveBeenCalledTimes(1)
        expect(result.current.dialogs.dialog).not.toBeNull()
    })
})

// ── État dérivé ────────────────────────────────────────────────────────────────

describe("useBiblioPage — état dérivé", () => {
    test("countByThematique compte les Q&R par thématique", () => {
        mocks.useBibliReturn.current.questionsReponses = [
            mkQR({ id: "qr1", thematiqueId: "t1" }),
            mkQR({ id: "qr2", thematiqueId: "t1" }),
            mkQR({ id: "qr3", thematiqueId: "t2" }),
        ]
        const { result } = renderHook(() => useBiblioPage())
        expect(result.current.data.countByThematique).toEqual({ t1: 2, t2: 1 })
    })

    test("activeThematique et activeQRs reflètent activeId", () => {
        const t1 = mkThematique({ id: "t1" })
        mocks.useBibliReturn.current.thematiques = [t1, mkThematique({ id: "t2" })]
        mocks.useBibliReturn.current.questionsReponses = [
            mkQR({ id: "qr1", thematiqueId: "t1" }),
            mkQR({ id: "qr2", thematiqueId: "t2" }),
        ]
        const { result } = renderHook(() => useBiblioPage())

        act(() => result.current.nav.setActiveId("t1"))

        expect(result.current.data.activeThematique?.id).toBe("t1")
        expect(result.current.data.activeQRs).toHaveLength(1)
        expect(result.current.data.activeQRs[0].id).toBe("qr1")
    })

    test("activeThematique est undefined et activeQRs est vide quand activeId est vide (vue Brief général)", () => {
        mocks.useBibliReturn.current.thematiques = [mkThematique({ id: "t1" })]
        const { result } = renderHook(() => useBiblioPage())
        expect(result.current.data.activeThematique).toBeUndefined()
        expect(result.current.data.activeQRs).toHaveLength(0)
    })
})
