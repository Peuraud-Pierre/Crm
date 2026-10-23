// ── BriefPanel.test.tsx ───────────────────────────────────────────────────────
// Tests unitaires de BriefPanel — jusqu'ici sans aucun test malgré une
// sélection de contenu conditionnelle à la langue active (brief/briefEn,
// chiffres/chiffresEn) et des messages de repli distincts pour chaque section
// quand le contenu est vide.

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"
import type { Brief, Lang } from "../types"

const mocks = rstest.hoisted(() => ({
    canManage: true,
    brief: { brief: "", briefEn: "", chiffres: "", chiffresEn: "" } as Brief,
    lang: "fr" as Lang,
    openEditBrief: rstest.fn(),
    openEditChiffres: rstest.fn(),
}))

function mockBiblioContextValue() {
    return {
        perms: { canManage: mocks.canManage },
        data: { brief: mocks.brief },
        nav: { lang: mocks.lang, ui: UI_TEXT[mocks.lang as Lang] },
        dialogs: { openEditBrief: mocks.openEditBrief, openEditChiffres: mocks.openEditChiffres },
    }
}

rstest.mock("@/features/bibliotheque/context/BiblioContext", () => ({
    useBiblioContext: mockBiblioContextValue,
}))

import { BriefPanel } from "./BriefPanel"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.canManage = true
    mocks.brief = { brief: "", briefEn: "", chiffres: "", chiffresEn: "" }
    mocks.lang = "fr"
})

describe("BriefPanel — sélection de la langue", () => {
    test("affiche brief.brief (FR) quand lang=fr", () => {
        mocks.brief = { brief: "Toujours répondre poliment.", briefEn: "Always be polite.", chiffres: "", chiffresEn: "" }
        mocks.lang = "fr"
        render(<BriefPanel />)
        expect(screen.getByText("Toujours répondre poliment.")).toBeInTheDocument()
        expect(screen.queryByText("Always be polite.")).not.toBeInTheDocument()
    })

    test("affiche brief.briefEn quand lang=en", () => {
        mocks.brief = { brief: "Toujours répondre poliment.", briefEn: "Always be polite.", chiffres: "", chiffresEn: "" }
        mocks.lang = "en"
        render(<BriefPanel />)
        expect(screen.getByText("Always be polite.")).toBeInTheDocument()
        expect(screen.queryByText("Toujours répondre poliment.")).not.toBeInTheDocument()
    })

    test("affiche chiffres.chiffresEn quand lang=en", () => {
        mocks.brief = { brief: "", briefEn: "", chiffres: "50 000 clients", chiffresEn: "50,000 customers" }
        mocks.lang = "en"
        render(<BriefPanel />)
        expect(screen.getByText("50,000 customers")).toBeInTheDocument()
    })
})

describe("BriefPanel — état vide", () => {
    test("affiche le message de repli du brief quand brief.brief est vide", () => {
        render(<BriefPanel />)
        expect(screen.getByText(UI_TEXT.fr.noBrief)).toBeInTheDocument()
    })

    test("affiche le message de repli des chiffres quand chiffres est vide", () => {
        render(<BriefPanel />)
        expect(screen.getByText(UI_TEXT.fr.noChiffres)).toBeInTheDocument()
    })
})

describe("BriefPanel — édition", () => {
    test("le bouton d'édition du brief appelle openEditBrief", async () => {
        const user = userEvent.setup()
        render(<BriefPanel />)
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.editBriefTitle }))
        expect(mocks.openEditBrief).toHaveBeenCalledTimes(1)
    })

    test("le bouton d'édition des chiffres appelle openEditChiffres", async () => {
        const user = userEvent.setup()
        render(<BriefPanel />)
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.editChiffresTitle }))
        expect(mocks.openEditChiffres).toHaveBeenCalledTimes(1)
    })
})
