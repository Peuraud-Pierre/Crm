// ── BriefChiffresDialogs.test.tsx ─────────────────────────────────────────────
// Tests unitaires de BriefEditDialog et ChiffresEditDialog. Le comportement
// critique à couvrir : quelle que soit la valeur de requireBothFilled, il est
// interdit d'enregistrer une seule des deux langues (FR sans EN, ou l'inverse)
// — une régression ici permettrait de sauvegarder un contenu à moitié traduit.
// Les chiffres restent optionnels (les deux langues peuvent rester vides).

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"
import type { Brief } from "../types"

const mocks = rstest.hoisted(() => ({
    closeDialog: rstest.fn(),
    handleSaveBrief: rstest.fn(),
    handleSaveChiffres: rstest.fn(),
    dialogRef: { current: null as null | { mode: string } },
    brief: { brief: "", briefEn: "", chiffres: "", chiffresEn: "" } as Brief,
}))

function mockBiblioContextValue() {
    return {
        data: { brief: mocks.brief },
        nav: { ui: UI_TEXT.fr },
        dialogs: { dialog: mocks.dialogRef.current, closeDialog: mocks.closeDialog },
        handlers: { handleSaveBrief: mocks.handleSaveBrief, handleSaveChiffres: mocks.handleSaveChiffres },
    }
}

rstest.mock("@/features/bibliotheque/context/BiblioContext", () => ({
    useBiblioContext: mockBiblioContextValue,
}))

import { BriefEditDialog, ChiffresEditDialog } from "./BriefChiffresDialogs"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.dialogRef.current = null
    mocks.brief = { brief: "", briefEn: "", chiffres: "", chiffresEn: "" }
    mocks.handleSaveBrief.mockResolvedValue(undefined)
    mocks.handleSaveChiffres.mockResolvedValue(undefined)
})

describe("BriefEditDialog — requireBothFilled (les deux langues obligatoires)", () => {
    test("visible uniquement en mode edit-brief", () => {
        mocks.dialogRef.current = { mode: "edit-brief" }
        render(<BriefEditDialog />)
        expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    test("pré-rempli avec brief.brief / brief.briefEn", async () => {
        mocks.dialogRef.current = { mode: "edit-brief" }
        mocks.brief = { brief: "Règle FR", briefEn: "Rule EN", chiffres: "", chiffresEn: "" }
        render(<BriefEditDialog />)
        await waitFor(() => expect(screen.getByLabelText(UI_TEXT.fr.sectionFr, { selector: "#brief-fr" })).toHaveValue("Règle FR"))
        expect(screen.getByLabelText(UI_TEXT.fr.sectionEn, { selector: "#brief-en" })).toHaveValue("Rule EN")
    })

    test("bouton Enregistrer désactivé si seule la langue FR est remplie", async () => {
        const user = userEvent.setup()
        mocks.dialogRef.current = { mode: "edit-brief" }
        render(<BriefEditDialog />)
        await user.type(screen.getByLabelText(UI_TEXT.fr.sectionFr, { selector: "#brief-fr" }), "Règle FR uniquement")
        expect(screen.getByRole("button", { name: UI_TEXT.fr.save })).toBeDisabled()
    })

    test("bouton Enregistrer activé une fois les deux langues remplies, et handleSaveBrief reçoit les deux valeurs trimées", async () => {
        const user = userEvent.setup()
        mocks.dialogRef.current = { mode: "edit-brief" }
        render(<BriefEditDialog />)
        await user.type(screen.getByLabelText(UI_TEXT.fr.sectionFr, { selector: "#brief-fr" }), "  Règle FR  ")
        await user.type(screen.getByLabelText(UI_TEXT.fr.sectionEn, { selector: "#brief-en" }), "  Rule EN  ")
        const saveButton = screen.getByRole("button", { name: UI_TEXT.fr.save })
        expect(saveButton).not.toBeDisabled()

        await user.click(saveButton)
        await waitFor(() => expect(mocks.handleSaveBrief).toHaveBeenCalledWith("Règle FR", "Rule EN"))
    })
})

describe("ChiffresEditDialog — les deux langues restent optionnelles, mais pas dépareillées", () => {
    test("visible uniquement en mode edit-chiffres", () => {
        mocks.dialogRef.current = { mode: "edit-chiffres" }
        render(<ChiffresEditDialog />)
        expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    test("pré-rempli avec brief.chiffres / brief.chiffresEn", async () => {
        mocks.dialogRef.current = { mode: "edit-chiffres" }
        mocks.brief = { brief: "", briefEn: "", chiffres: "50 000 clients", chiffresEn: "50,000 customers" }
        render(<ChiffresEditDialog />)
        await waitFor(() => expect(screen.getByLabelText(UI_TEXT.fr.sectionFr, { selector: "#chiffres-fr" })).toHaveValue("50 000 clients"))
        expect(screen.getByLabelText(UI_TEXT.fr.sectionEn, { selector: "#chiffres-en" })).toHaveValue("50,000 customers")
    })

    test("bouton Enregistrer activé quand les deux langues sont vides (on peut effacer les chiffres)", () => {
        mocks.dialogRef.current = { mode: "edit-chiffres" }
        render(<ChiffresEditDialog />)
        expect(screen.getByRole("button", { name: UI_TEXT.fr.save })).not.toBeDisabled()
    })

    test("bouton Enregistrer désactivé si seule la langue FR est remplie", async () => {
        const user = userEvent.setup()
        mocks.dialogRef.current = { mode: "edit-chiffres" }
        render(<ChiffresEditDialog />)
        await user.type(screen.getByLabelText(UI_TEXT.fr.sectionFr, { selector: "#chiffres-fr" }), "Seulement en FR")
        expect(screen.getByRole("button", { name: UI_TEXT.fr.save })).toBeDisabled()
    })

    test("bouton Enregistrer activé une fois les deux langues remplies, et handleSaveChiffres reçoit les deux valeurs trimées", async () => {
        const user = userEvent.setup()
        mocks.dialogRef.current = { mode: "edit-chiffres" }
        render(<ChiffresEditDialog />)
        await user.type(screen.getByLabelText(UI_TEXT.fr.sectionFr, { selector: "#chiffres-fr" }), "  100 clients  ")
        await user.type(screen.getByLabelText(UI_TEXT.fr.sectionEn, { selector: "#chiffres-en" }), "  100 customers  ")
        const saveButton = screen.getByRole("button", { name: UI_TEXT.fr.save })
        expect(saveButton).not.toBeDisabled()

        await user.click(saveButton)
        await waitFor(() => expect(mocks.handleSaveChiffres).toHaveBeenCalledWith("100 clients", "100 customers"))
    })
})
