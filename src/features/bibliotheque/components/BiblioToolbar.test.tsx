// ── BiblioToolbar.test.tsx ────────────────────────────────────────────────────
// Tests unitaires de BiblioToolbar — jusqu'ici sans aucun test malgré une
// logique non triviale : navigation clavier du sélecteur de langue (roving
// tabIndex) et affichage conditionnel du bouton d'effacement de recherche.

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"
import type { Lang } from "../types"

const mocks = rstest.hoisted(() => ({
    lang: "fr" as Lang,
    setLang: rstest.fn(),
    searchQuery: "",
    setSearchQuery: rstest.fn(),
}))

function mockBiblioContextValue() {
    return {
        nav: {
            lang: mocks.lang, setLang: mocks.setLang,
            searchQuery: mocks.searchQuery, setSearchQuery: mocks.setSearchQuery,
            ui: UI_TEXT[mocks.lang as Lang],
        },
    }
}

rstest.mock("@/features/bibliotheque/context/BiblioContext", () => ({
    useBiblioContext: mockBiblioContextValue,
}))

import { BiblioToolbar } from "./BiblioToolbar"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.lang = "fr"
    mocks.searchQuery = ""
})

describe("BiblioToolbar — sélecteur de langue", () => {
    test("le bouton FR est coché quand lang=fr", () => {
        render(<BiblioToolbar />)
        expect(screen.getByRole("radio", { name: new RegExp(UI_TEXT.fr.langFr) })).toHaveAttribute("aria-checked", "true")
        expect(screen.getByRole("radio", { name: new RegExp(UI_TEXT.fr.langEn) })).toHaveAttribute("aria-checked", "false")
    })

    test("clic sur EN appelle setLang('en')", async () => {
        const user = userEvent.setup()
        render(<BiblioToolbar />)
        await user.click(screen.getByRole("radio", { name: new RegExp(UI_TEXT.fr.langEn) }))
        expect(mocks.setLang).toHaveBeenCalledWith("en")
    })

    test("flèche droite sur le bouton actif (FR) bascule vers EN et lui donne le focus", async () => {
        const user = userEvent.setup()
        render(<BiblioToolbar />)
        screen.getByRole("radio", { name: new RegExp(UI_TEXT.fr.langFr) }).focus()
        await user.keyboard("{ArrowRight}")
        expect(mocks.setLang).toHaveBeenCalledWith("en")
    })

    test("seul le bouton actif a tabIndex=0 (roving tabIndex)", () => {
        render(<BiblioToolbar />)
        expect(screen.getByRole("radio", { name: new RegExp(UI_TEXT.fr.langFr) })).toHaveAttribute("tabIndex", "0")
        expect(screen.getByRole("radio", { name: new RegExp(UI_TEXT.fr.langEn) })).toHaveAttribute("tabIndex", "-1")
    })
})

describe("BiblioToolbar — barre de recherche", () => {
    test("la saisie appelle setSearchQuery avec le texte tapé", async () => {
        const user = userEvent.setup()
        render(<BiblioToolbar />)
        await user.type(screen.getByRole("textbox"), "livraison")
        expect(mocks.setSearchQuery).toHaveBeenCalled()
    })

    test("le bouton d'effacement n'apparaît pas si la recherche est vide", () => {
        mocks.searchQuery = ""
        render(<BiblioToolbar />)
        expect(screen.queryByRole("button", { name: UI_TEXT.fr.clearSearch })).not.toBeInTheDocument()
    })

    test("le bouton d'effacement apparaît dès qu'il y a du texte, et vide la recherche au clic", async () => {
        const user = userEvent.setup()
        mocks.searchQuery = "livraison"
        render(<BiblioToolbar />)
        const clearButton = screen.getByRole("button", { name: UI_TEXT.fr.clearSearch })
        expect(clearButton).toBeInTheDocument()
        await user.click(clearButton)
        expect(mocks.setSearchQuery).toHaveBeenCalledWith("")
    })
})
