// ── FormatEditDialog.test.tsx ─────────────────────────────────────────────────
// Tests unitaires de FormatEditDialog. Deux comportements critiques à couvrir :
//   - `allEmpty` : le bouton Enregistrer se désactive si les 6 champs sont vides.
//   - `hasMismatch` : pour un canal donné, FR et EN doivent être remplis ensemble
//     ou vides ensemble — un canal avec une seule des deux langues renseignée
//     ne doit jamais pouvoir être enregistré.

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"
import type { QR, FormatMap } from "../types"

const mocks = rstest.hoisted(() => ({
    closeDialog: rstest.fn(),
    handleSaveFormat: rstest.fn(),
    dialogRef: { current: null as null | { mode: string; qr?: QR } },
    formatReponses: {} as Record<string, FormatMap>,
}))

function mockBiblioContextValue() {
    return {
        data: { formatReponses: mocks.formatReponses },
        nav: { lang: "fr" as const, ui: UI_TEXT.fr },
        dialogs: { dialog: mocks.dialogRef.current, closeDialog: mocks.closeDialog },
        handlers: { handleSaveFormat: mocks.handleSaveFormat },
    }
}

rstest.mock("@/features/bibliotheque/context/BiblioContext", () => ({
    useBiblioContext: mockBiblioContextValue,
}))

import { FormatEditDialog } from "./FormatEditDialog"

const mkQR = (overrides: Partial<QR> = {}): QR => ({
    id: "qr1", thematiqueId: "t1", question: "Q", questionEn: "Q-en", briefQr: "R", briefQrEn: "R-en",
    ...overrides,
})

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.dialogRef.current = null
    mocks.formatReponses = {}
    mocks.handleSaveFormat.mockResolvedValue(undefined)
})

describe("FormatEditDialog — visibilité", () => {
    test("visible uniquement en mode edit-format", () => {
        mocks.dialogRef.current = { mode: "edit-format", qr: mkQR() }
        render(<FormatEditDialog />)
        expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    test("absent pour un autre mode", () => {
        mocks.dialogRef.current = { mode: "edit-brief" }
        render(<FormatEditDialog />)
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
})

describe("FormatEditDialog — pré-remplissage", () => {
    test("initialise l'onglet email avec les valeurs existantes de formatReponses", async () => {
        const qr = mkQR({ id: "qr1" })
        mocks.dialogRef.current = { mode: "edit-format", qr }
        mocks.formatReponses = {
            qr1: { email: "Bonjour", emailEn: "Hello", instagram: "", instagramEn: "", whatsapp: "", whatsappEn: "" },
        }
        render(<FormatEditDialog />)
        await waitFor(() => {
            expect(screen.getByLabelText(UI_TEXT.fr.sectionFr, { selector: "#format-fr-email" })).toHaveValue("Bonjour")
        })
        expect(screen.getByLabelText(UI_TEXT.fr.sectionEn, { selector: "#format-en-email" })).toHaveValue("Hello")
    })

    test("initialise à vide si aucun format n'existe encore pour cette QR", async () => {
        mocks.dialogRef.current = { mode: "edit-format", qr: mkQR({ id: "qr-sans-format" }) }
        render(<FormatEditDialog />)
        await waitFor(() => {
            expect(screen.getByLabelText(UI_TEXT.fr.sectionFr, { selector: "#format-fr-email" })).toHaveValue("")
        })
    })
})

describe("FormatEditDialog — changement d'onglet", () => {
    test("changer d'onglet affiche le contenu du canal correspondant", async () => {
        const user = userEvent.setup()
        mocks.dialogRef.current = { mode: "edit-format", qr: mkQR({ id: "qr1" }) }
        mocks.formatReponses = {
            qr1: { email: "", emailEn: "", instagram: "Salut Insta", instagramEn: "Hi Insta", whatsapp: "", whatsappEn: "" },
        }
        render(<FormatEditDialog />)
        await waitFor(() => expect(screen.getByLabelText(UI_TEXT.fr.sectionFr, { selector: "#format-fr-email" })).toBeInTheDocument())

        await user.click(screen.getByRole("button", { name: /Instagram|DM/i }))

        expect(screen.getByLabelText(UI_TEXT.fr.sectionFr, { selector: "#format-fr-instagram" })).toHaveValue("Salut Insta")
    })
})

describe("FormatEditDialog — validation allEmpty", () => {
    test("bouton Enregistrer désactivé quand les 6 champs sont vides", async () => {
        mocks.dialogRef.current = { mode: "edit-format", qr: mkQR({ id: "qr-vide" }) }
        render(<FormatEditDialog />)
        await waitFor(() => expect(screen.getByRole("button", { name: UI_TEXT.fr.save })).toBeDisabled())
    })

    test("bouton Enregistrer toujours désactivé si un seul champ (sur les deux langues) d'un canal est rempli", async () => {
        const user = userEvent.setup()
        mocks.dialogRef.current = { mode: "edit-format", qr: mkQR({ id: "qr-vide" }) }
        render(<FormatEditDialog />)
        await waitFor(() => expect(screen.getByLabelText(UI_TEXT.fr.sectionFr, { selector: "#format-fr-email" })).toBeInTheDocument())

        await user.type(screen.getByLabelText(UI_TEXT.fr.sectionFr, { selector: "#format-fr-email" }), "Email FR seul")

        expect(screen.getByRole("button", { name: UI_TEXT.fr.save })).toBeDisabled()
    })

    test("bouton Enregistrer activé une fois les deux langues du canal remplies", async () => {
        const user = userEvent.setup()
        mocks.dialogRef.current = { mode: "edit-format", qr: mkQR({ id: "qr-vide" }) }
        render(<FormatEditDialog />)
        await waitFor(() => expect(screen.getByLabelText(UI_TEXT.fr.sectionFr, { selector: "#format-fr-email" })).toBeInTheDocument())

        await user.type(screen.getByLabelText(UI_TEXT.fr.sectionFr, { selector: "#format-fr-email" }), "Email FR")
        await user.type(screen.getByLabelText(UI_TEXT.fr.sectionEn, { selector: "#format-en-email" }), "Email EN")

        expect(screen.getByRole("button", { name: UI_TEXT.fr.save })).not.toBeDisabled()
    })
})

describe("FormatEditDialog — soumission", () => {
    test("handleSaveFormat reçoit les 6 champs assemblés (dont ceux saisis sur un autre onglet)", async () => {
        const user = userEvent.setup()
        mocks.dialogRef.current = { mode: "edit-format", qr: mkQR({ id: "qr1" }) }
        render(<FormatEditDialog />)
        await waitFor(() => expect(screen.getByLabelText(UI_TEXT.fr.sectionFr, { selector: "#format-fr-email" })).toBeInTheDocument())

        // Remplit l'onglet email (actif par défaut à l'ouverture), FR et EN —
        // un canal rempli dans une seule langue ne permettrait pas d'enregistrer.
        await user.type(screen.getByLabelText(UI_TEXT.fr.sectionFr, { selector: "#format-fr-email" }), "  Bonjour  ")
        await user.type(screen.getByLabelText(UI_TEXT.fr.sectionEn, { selector: "#format-en-email" }), "  Hello  ")

        // Bascule sur whatsapp et remplit aussi ce canal (FR + EN) — les deux
        // doivent être conservés dans `values` malgré le changement d'onglet
        // (state au niveau du dialog, pas du textarea).
        await user.click(screen.getByRole("button", { name: /WhatsApp/i }))
        await user.type(screen.getByLabelText(UI_TEXT.fr.sectionFr, { selector: "#format-fr-whatsapp" }), "  Salut WhatsApp  ")
        await user.type(screen.getByLabelText(UI_TEXT.fr.sectionEn, { selector: "#format-en-whatsapp" }), "  Hi WhatsApp  ")

        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.save }))

        await waitFor(() => expect(mocks.handleSaveFormat).toHaveBeenCalledTimes(1))
        expect(mocks.handleSaveFormat).toHaveBeenCalledWith({
            email: "Bonjour", emailEn: "Hello",
            instagram: "", instagramEn: "",
            whatsapp: "Salut WhatsApp", whatsappEn: "Hi WhatsApp",
        })
    })
})
