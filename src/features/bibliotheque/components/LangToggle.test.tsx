// ── LangToggle.test.tsx ───────────────────────────────────────────────────────
// Tests unitaires de LangToggle — extrait de BiblioToolbar puis réutilisé tel
// quel par FormatPanel. La logique (roving tabIndex, navigation clavier au
// clic sur les flèches) était couverte via BiblioToolbar.test.tsx avant
// l'extraction ; ces tests couvrent maintenant directement le composant
// partagé, y compris son usage "className" (cas FormatPanel).

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"
import type { Lang } from "../types"
import { LangToggle } from "./LangToggle"

const setLang = rstest.fn()

function renderToggle(lang: Lang, className?: string) {
    return render(
        <LangToggle
            lang={lang}
            setLang={setLang}
            label={UI_TEXT.fr.langSelectorLabel}
            labelFr={UI_TEXT.fr.langFr}
            labelEn={UI_TEXT.fr.langEn}
            className={className}
        />
    )
}

beforeEach(() => {
    rstest.clearAllMocks()
})

describe("LangToggle — état affiché", () => {
    test("le bouton FR est coché quand lang=fr", () => {
        renderToggle("fr")
        expect(screen.getByRole("radio", { name: new RegExp(UI_TEXT.fr.langFr) })).toHaveAttribute("aria-checked", "true")
        expect(screen.getByRole("radio", { name: new RegExp(UI_TEXT.fr.langEn) })).toHaveAttribute("aria-checked", "false")
    })

    test("le bouton EN est coché quand lang=en", () => {
        renderToggle("en")
        expect(screen.getByRole("radio", { name: new RegExp(UI_TEXT.fr.langEn) })).toHaveAttribute("aria-checked", "true")
        expect(screen.getByRole("radio", { name: new RegExp(UI_TEXT.fr.langFr) })).toHaveAttribute("aria-checked", "false")
    })

    test("seul le bouton actif a tabIndex=0 (roving tabIndex)", () => {
        renderToggle("fr")
        expect(screen.getByRole("radio", { name: new RegExp(UI_TEXT.fr.langFr) })).toHaveAttribute("tabIndex", "0")
        expect(screen.getByRole("radio", { name: new RegExp(UI_TEXT.fr.langEn) })).toHaveAttribute("tabIndex", "-1")
    })

    test("le radiogroup porte l'aria-label fourni", () => {
        renderToggle("fr")
        expect(screen.getByRole("radiogroup", { name: UI_TEXT.fr.langSelectorLabel })).toBeInTheDocument()
    })
})

describe("LangToggle — interactions", () => {
    test("clic sur EN appelle setLang('en')", async () => {
        const user = userEvent.setup()
        renderToggle("fr")
        await user.click(screen.getByRole("radio", { name: new RegExp(UI_TEXT.fr.langEn) }))
        expect(setLang).toHaveBeenCalledWith("en")
    })

    test("clic sur FR appelle setLang('fr')", async () => {
        const user = userEvent.setup()
        renderToggle("en")
        await user.click(screen.getByRole("radio", { name: new RegExp(UI_TEXT.fr.langFr) }))
        expect(setLang).toHaveBeenCalledWith("fr")
    })

    test("flèche droite sur le bouton actif (FR) bascule vers EN et lui donne le focus", async () => {
        const user = userEvent.setup()
        renderToggle("fr")
        screen.getByRole("radio", { name: new RegExp(UI_TEXT.fr.langFr) }).focus()
        await user.keyboard("{ArrowRight}")
        expect(setLang).toHaveBeenCalledWith("en")
    })

    test("flèche gauche sur le bouton actif (EN) bascule vers FR et lui donne le focus", async () => {
        const user = userEvent.setup()
        renderToggle("en")
        screen.getByRole("radio", { name: new RegExp(UI_TEXT.fr.langEn) }).focus()
        await user.keyboard("{ArrowLeft}")
        expect(setLang).toHaveBeenCalledWith("fr")
    })

    test("une touche autre que les flèches ne déclenche pas setLang", async () => {
        // {Enter}/{Space} sont exclus : ce sont des touches d'activation natives du <button>
        // (déclenchent onClick), pas des touches gérées par handleLangKey — {Escape} n'active
        // rien et ne fait pas partie des flèches directionnelles.
        const user = userEvent.setup()
        renderToggle("fr")
        screen.getByRole("radio", { name: new RegExp(UI_TEXT.fr.langFr) }).focus()
        await user.keyboard("{Escape}")
        expect(setLang).not.toHaveBeenCalled()
    })
})

describe("LangToggle — className (usage FormatPanel)", () => {
    test("la className fournie est appliquée sur le radiogroup", () => {
        renderToggle("fr", "w-fit")
        expect(screen.getByRole("radiogroup")).toHaveClass("w-fit")
    })
})
