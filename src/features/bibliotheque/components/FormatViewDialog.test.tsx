// ── FormatViewDialog.test.tsx ─────────────────────────────────────────────────
// Tests unitaires de FormatViewDialog — pop-up qui affiche FormatPanel pour la
// Q&R du dialog courant. Le contenu (onglets, texte, copier) est déjà couvert
// par FormatPanel.test.tsx ; ici on vérifie la mécanique propre au dialog :
// visibilité selon dialog.mode, lecture de la bonne Q&R/formatReponses, respect
// de la permission bibliotheque.manage (canManage), et le pont vers
// FormatEditDialog via openEditFormat.

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"
import type { QR, FormatMap } from "../types"

const mocks = rstest.hoisted(() => ({
    canManage: true,
    closeDialog: rstest.fn(),
    openEditFormat: rstest.fn(),
    dialogRef: { current: null as null | { mode: string; qr?: QR } },
    formatReponses: {} as Record<string, FormatMap>,
}))

function mockBiblioContextValue() {
    return {
        perms: { canManage: mocks.canManage },
        data: { formatReponses: mocks.formatReponses },
        nav: { lang: "fr" as const, ui: UI_TEXT.fr },
        dialogs: { dialog: mocks.dialogRef.current, closeDialog: mocks.closeDialog, openEditFormat: mocks.openEditFormat },
    }
}

rstest.mock("@/features/bibliotheque/context/BiblioContext", () => ({
    useBiblioContext: mockBiblioContextValue,
}))

import { FormatViewDialog } from "./FormatViewDialog"

const mkQR = (overrides: Partial<QR> = {}): QR => ({
    id: "qr1", thematiqueId: "t1", question: "Quel est le délai ?", questionEn: "What is the delay?",
    briefQr: "3 jours", briefQrEn: "3 days",
    ...overrides,
})

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.canManage = true
    mocks.dialogRef.current = null
    mocks.formatReponses = {}
})

describe("FormatViewDialog — visibilité", () => {
    test("visible uniquement en mode view-format", () => {
        mocks.dialogRef.current = { mode: "view-format", qr: mkQR() }
        render(<FormatViewDialog />)
        expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    test("absent pour un autre mode", () => {
        mocks.dialogRef.current = { mode: "edit-format", qr: mkQR() }
        render(<FormatViewDialog />)
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
})

describe("FormatViewDialog — contenu", () => {
    test("affiche la question de la Q&R du dialog dans l'en-tête", () => {
        mocks.dialogRef.current = { mode: "view-format", qr: mkQR({ question: "Quel est le délai ?" }) }
        render(<FormatViewDialog />)
        expect(screen.getByText("Quel est le délai ?")).toBeInTheDocument()
    })

    test("affiche les réponses formatées de la bonne Q&R", () => {
        mocks.dialogRef.current = { mode: "view-format", qr: mkQR({ id: "qr1" }) }
        mocks.formatReponses = { qr1: { email: "réponse email", emailEn: "", instagram: "", instagramEn: "", whatsapp: "", whatsappEn: "" } }
        render(<FormatViewDialog />)
        expect(screen.getByDisplayValue("réponse email")).toBeInTheDocument()
    })
})

describe("FormatViewDialog — permission bibliotheque.manage", () => {
    test("bouton Modifier visible avec la permission", () => {
        mocks.canManage = true
        mocks.dialogRef.current = { mode: "view-format", qr: mkQR() }
        render(<FormatViewDialog />)
        expect(screen.getByRole("button", { name: UI_TEXT.fr.edit })).toBeInTheDocument()
    })

    test("bouton Modifier absent sans la permission", () => {
        mocks.canManage = false
        mocks.dialogRef.current = { mode: "view-format", qr: mkQR() }
        render(<FormatViewDialog />)
        expect(screen.queryByRole("button", { name: UI_TEXT.fr.edit })).not.toBeInTheDocument()
    })
})

describe("FormatViewDialog — bouton Modifier", () => {
    test("appelle openEditFormat avec l'objet QR courant", async () => {
        const user = userEvent.setup()
        const qr = mkQR()
        mocks.dialogRef.current = { mode: "view-format", qr }
        render(<FormatViewDialog />)
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.edit }))
        expect(mocks.openEditFormat).toHaveBeenCalledWith(qr)
    })
})
