// ── Bibliotheque.test.tsx ─────────────────────────────────────────────────────
// Tests unitaires du composant de page (routes/Bibliotheque.tsx) — jusqu'ici
// sans aucun test malgré 4 branches de rendu distinctes (chargement / erreur /
// base vide / interface complète) qui déterminent CE QUE l'utilisateur voit au
// tout premier chargement de la feature. Une régression ici (ex: mauvaise
// condition entre loading/loadError) casserait silencieusement l'écran
// d'accueil sans qu'aucun test de hook ou de service ne le détecte.
//
// Stratégie de mock : @/features/bibliotheque/context/BiblioContext est mocké
// dans son ensemble — BiblioProvider devient un simple passe-plat (ne monte
// pas le vrai useBiblioPage, qui appellerait Supabase), et useBiblioContext
// renvoie un objet de contexte construit ici avec des valeurs par défaut
// couvrant tout ce que consomment les composants enfants réels (BiblioToolbar,
// BiblioSidebar, BriefPanel, tous les dialogs...) — ils ne sont PAS mockés
// individuellement, pour tester l'assemblage réel de la page.

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"
import type { Thematique, QR, FormatMap, Brief, SearchGroup, Lang } from "../types"

const mocks = rstest.hoisted(() => ({
    loading: false,
    loadError: false,
    refetch: rstest.fn(),
    thematiques: [] as Thematique[],
    questionsReponses: [] as QR[],
    formatReponses: {} as Record<string, FormatMap>,
    brief: { brief: "", briefEn: "", chiffres: "", chiffresEn: "" } as Brief,
    countByThematique: {} as Record<string, number>,
    activeThematique: undefined as Thematique | undefined,
    activeQRs: [] as QR[],
    lang: "fr" as Lang,
    activeId: "",
    searchQuery: "",
    dialog: null as null | { mode: string },
    openCreateThematique: rstest.fn(),
    canManage: true,
}))

function noop() { /* handler non exercé par ces tests de composition de page */ }

function mockContextValue() {
    return {
        perms: { canManage: mocks.canManage },
        data: {
            thematiques: mocks.thematiques, questionsReponses: mocks.questionsReponses,
            formatReponses: mocks.formatReponses, brief: mocks.brief,
            countByThematique: mocks.countByThematique, activeThematique: mocks.activeThematique, activeQRs: mocks.activeQRs,
            loading: mocks.loading, loadError: mocks.loadError, refetch: mocks.refetch,
        },
        nav: {
            lang: mocks.lang, setLang: noop, ui: UI_TEXT[mocks.lang as Lang],
            activeId: mocks.activeId, setActiveId: noop,
            searchQuery: mocks.searchQuery, setSearchQuery: noop, debouncedQuery: mocks.searchQuery,
            searchGroups: [] as SearchGroup[],
            detailQRId: null, setDetailQRId: noop, detailQR: undefined, detailThematique: undefined,
            handleNavigate: noop, clearSearch: noop,
        },
        dialogs: {
            dialog: mocks.dialog, closeDialog: noop,
            openCreateThematique: mocks.openCreateThematique, openRenameThematique: noop, openDeleteThematique: noop,
            openEditBrief: noop, openEditChiffres: noop,
            openCreateQR: noop, openEditQR: noop, openDeleteQR: noop, openEditFormat: noop,
        },
        handlers: {
            handleSaveQR: noop, handleDeleteQR: noop, handleSaveThematique: noop, handleDeleteThematique: noop,
            handleSaveBrief: noop, handleSaveChiffres: noop, handleSaveFormat: noop,
            uploadThematiqueImage: noop, uploadThematiqueIcon: noop, discardUnsavedThematiqueMedia: noop,
            resolveThematiqueMediaUrl: (v: string | undefined) => v ?? "",
        },
    }
}

rstest.mock("@/features/bibliotheque/context/BiblioContext", () => ({
    BiblioProvider: ({ children }: { children: ReactNode }) => children,
    useBiblioContext: mockContextValue,
}))

import Bibliotheque from "./Bibliotheque"

const mkThematique = (overrides: Partial<Thematique> = {}): Thematique => ({
    id: "t1", label: "Livraison", labelEn: "Delivery", imageUrl: "", iconUrl: "",
    ...overrides,
})

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.loading = false
    mocks.loadError = false
    mocks.thematiques = []
    mocks.questionsReponses = []
    mocks.formatReponses = {}
    mocks.brief = { brief: "", briefEn: "", chiffres: "", chiffresEn: "" }
    mocks.countByThematique = {}
    mocks.activeThematique = undefined
    mocks.activeQRs = []
    mocks.lang = "fr"
    mocks.activeId = ""
    mocks.searchQuery = ""
    mocks.dialog = null
})

describe("Bibliotheque — état chargement", () => {
    test("affiche le texte de chargement et rien d'autre", () => {
        mocks.loading = true
        render(<Bibliotheque />)
        expect(screen.getByText(UI_TEXT.fr.loadingText)).toBeInTheDocument()
        expect(screen.queryByRole("button", { name: UI_TEXT.fr.newTopic })).not.toBeInTheDocument()
    })
})

describe("Bibliotheque — état erreur", () => {
    test("affiche le message d'erreur et un bouton Réessayer qui appelle refetch", async () => {
        const user = userEvent.setup()
        mocks.loading = false
        mocks.loadError = true
        render(<Bibliotheque />)
        expect(screen.getByText(UI_TEXT.fr.loadErrorTitle)).toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.retry }))
        expect(mocks.refetch).toHaveBeenCalledTimes(1)
    })

    test("l'état erreur prime sur l'état vide (loadError=true, thematiques=[])", () => {
        mocks.loadError = true
        mocks.thematiques = []
        render(<Bibliotheque />)
        expect(screen.getByText(UI_TEXT.fr.loadErrorTitle)).toBeInTheDocument()
        expect(screen.queryByText(UI_TEXT.fr.noTopics)).not.toBeInTheDocument()
    })
})

describe("Bibliotheque — état base vide", () => {
    test("affiche l'invite de création et le bouton ouvre openCreateThematique", async () => {
        const user = userEvent.setup()
        mocks.thematiques = []
        render(<Bibliotheque />)
        expect(screen.getByText(UI_TEXT.fr.noTopics)).toBeInTheDocument()
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.newTopic }))
        expect(mocks.openCreateThematique).toHaveBeenCalledTimes(1)
    })
})

describe("Bibliotheque — interface complète", () => {
    test("affiche la toolbar et la sidebar quand des thématiques existent", () => {
        mocks.thematiques = [mkThematique()]
        render(<Bibliotheque />)
        expect(screen.getByRole("textbox", { name: UI_TEXT.fr.searchPlaceholder })).toBeInTheDocument()
        expect(screen.getByText(UI_TEXT.fr.topics)).toBeInTheDocument()
    })

    test("affiche BriefPanel quand activeId est vide", () => {
        mocks.thematiques = [mkThematique()]
        mocks.activeId = ""
        render(<Bibliotheque />)
        expect(screen.getByText(UI_TEXT.fr.briefTitle)).toBeInTheDocument()
    })

    test("affiche BiblioMainColumn (pas BriefPanel) quand une thématique est active", () => {
        const t = mkThematique({ id: "t1", label: "Livraison" })
        mocks.thematiques = [t]
        mocks.activeId = "t1"
        mocks.activeThematique = t
        render(<Bibliotheque />)
        expect(screen.queryByText(UI_TEXT.fr.briefTitle)).not.toBeInTheDocument()
        expect(screen.getByRole("heading", { name: "Livraison" })).toBeInTheDocument()
    })

    test("affiche SearchResults au lieu de la vue normale quand searchQuery est non vide", () => {
        mocks.thematiques = [mkThematique()]
        mocks.searchQuery = "livraison"
        render(<Bibliotheque />)
        expect(screen.getByRole("button", { name: new RegExp(UI_TEXT.fr.back, "i") })).toBeInTheDocument()
        expect(screen.queryByText(UI_TEXT.fr.topics)).not.toBeInTheDocument()
    })
})
