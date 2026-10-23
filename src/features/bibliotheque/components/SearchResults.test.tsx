// ── SearchResults.test.tsx ────────────────────────────────────────────────────
// Tests unitaires de SearchResults — corps de la colonne gauche de la vue
// recherche (liste des résultats groupés par thématique). Couvre trois
// interactions : naviguer vers une thématique (quitte la recherche),
// sélectionner une Q&R (reste dans la recherche, notifie le parent via
// setDetailQRId) et revenir en arrière (efface la recherche).
// QRDetailPanel (colonne droite, montée séparément par routes/Bibliotheque.tsx)
// a ses propres tests dans QRDetailPanel.test.tsx.

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"
import type { QR, Thematique, SearchGroup, Lang } from "../types"

const mocks = rstest.hoisted(() => ({
    lang: "fr" as Lang,
    searchGroups: [] as SearchGroup[],
    debouncedQuery: "",
    handleNavigate: rstest.fn(),
    clearSearch: rstest.fn(),
    setDetailQRId: rstest.fn(),
    detailQRId: null as string | null,
}))

function mockBiblioContextValue() {
    return {
        nav: {
            searchGroups: mocks.searchGroups, debouncedQuery: mocks.debouncedQuery, lang: mocks.lang, ui: UI_TEXT[mocks.lang as Lang],
            handleNavigate: mocks.handleNavigate, clearSearch: mocks.clearSearch,
            setDetailQRId: mocks.setDetailQRId, detailQRId: mocks.detailQRId,
        },
    }
}

rstest.mock("@/features/bibliotheque/context/BiblioContext", () => ({
    useBiblioContext: mockBiblioContextValue,
}))

import { SearchResults } from "./SearchResults"

const mkThematique = (overrides: Partial<Thematique> = {}): Thematique => ({
    id: "t1", label: "Livraison", labelEn: "Delivery", imageUrl: "", iconUrl: "",
    ...overrides,
})

const mkQR = (overrides: Partial<QR> = {}): QR => ({
    id: "qr1", thematiqueId: "t1", question: "Quel est le délai ?", questionEn: "", briefQr: "3 jours", briefQrEn: "",
    ...overrides,
})

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.lang = "fr"
    mocks.searchGroups = []
    mocks.debouncedQuery = ""
    mocks.detailQRId = null
})

describe("SearchResults — aucun résultat", () => {
    test("affiche le message 'aucun résultat' avec le terme cherché quand searchGroups est vide", () => {
        mocks.debouncedQuery = "xyz"
        render(<SearchResults />)
        expect(screen.getByText(UI_TEXT.fr.noResults("xyz"))).toBeInTheDocument()
    })
})

describe("SearchResults — résultats groupés", () => {
    test("affiche le compteur total de résultats toutes thématiques confondues", () => {
        mocks.searchGroups = [
            { thematique: mkThematique({ id: "t1" }), questionsReponses: [mkQR({ id: "qr1" }), mkQR({ id: "qr2" })], isThematiqueMatch: false },
            { thematique: mkThematique({ id: "t2", label: "Retours" }), questionsReponses: [mkQR({ id: "qr3", thematiqueId: "t2" })], isThematiqueMatch: false },
        ]
        render(<SearchResults />)
        expect(screen.getByText(UI_TEXT.fr.results(3))).toBeInTheDocument()
    })

    test("clic sur le titre d'une thématique appelle handleNavigate avec son id", async () => {
        const user = userEvent.setup()
        mocks.searchGroups = [{ thematique: mkThematique({ id: "t1", label: "Livraison" }), questionsReponses: [mkQR()], isThematiqueMatch: true }]
        render(<SearchResults />)
        await user.click(screen.getByText("Livraison"))
        expect(mocks.handleNavigate).toHaveBeenCalledWith("t1")
    })

    test("clic sur une Q&R appelle setDetailQRId avec son id (reste dans la recherche)", async () => {
        const user = userEvent.setup()
        mocks.searchGroups = [{ thematique: mkThematique(), questionsReponses: [mkQR({ id: "qr1", question: "Quel est le délai ?" })], isThematiqueMatch: false }]
        render(<SearchResults />)
        await user.click(screen.getByText("Quel est le délai ?"))
        expect(mocks.setDetailQRId).toHaveBeenCalledWith("qr1")
        expect(mocks.handleNavigate).not.toHaveBeenCalled()
    })

    test("le bouton Retour appelle clearSearch", async () => {
        const user = userEvent.setup()
        render(<SearchResults />)
        await user.click(screen.getByRole("button", { name: new RegExp(UI_TEXT.fr.back, "i") }))
        expect(mocks.clearSearch).toHaveBeenCalledTimes(1)
    })

    test("le titre d'une thématique dont le libellé ne matche pas (isThematiqueMatch=false) n'est pas cliquable", async () => {
        const user = userEvent.setup()
        mocks.searchGroups = [{ thematique: mkThematique({ id: "t1", label: "Livraison" }), questionsReponses: [mkQR()], isThematiqueMatch: false }]
        render(<SearchResults />)
        expect(screen.queryByRole("button", { name: /Livraison/i })).not.toBeInTheDocument()
        await user.click(screen.getByText("Livraison"))
        expect(mocks.handleNavigate).not.toHaveBeenCalled()
    })
})
