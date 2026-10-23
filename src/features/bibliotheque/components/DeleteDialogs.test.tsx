// ── DeleteDialogs.test.tsx ────────────────────────────────────────────────────
// Tests unitaires de DeleteQRDialog et DeleteThematiqueDialog — jusqu'ici sans
// aucun test, alors que c'est ici que se décide l'avertissement de cascade
// (suppression d'une thématique qui contient des Q&R) — une régression ici
// laisserait l'utilisateur supprimer silencieusement plusieurs Q&R sans le savoir.

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"
import type { QR, Thematique } from "../types"

const mocks = rstest.hoisted(() => ({
    closeDialog: rstest.fn(),
    handleDeleteQR: rstest.fn(),
    handleDeleteThematique: rstest.fn(),
    dialogRef: { current: null as null | { mode: string; qr?: QR; thematique?: Thematique } },
    countByThematique: {} as Record<string, number>,
}))

function mockBiblioContextValue() {
    return {
        data: { countByThematique: mocks.countByThematique },
        nav: { lang: "fr" as const, ui: UI_TEXT.fr },
        dialogs: { dialog: mocks.dialogRef.current, closeDialog: mocks.closeDialog },
        handlers: { handleDeleteQR: mocks.handleDeleteQR, handleDeleteThematique: mocks.handleDeleteThematique },
    }
}

rstest.mock("@/features/bibliotheque/context/BiblioContext", () => ({
    useBiblioContext: mockBiblioContextValue,
}))

import { DeleteQRDialog, DeleteThematiqueDialog } from "./DeleteDialogs"

const mkQR = (overrides: Partial<QR> = {}): QR => ({
    id: "qr1", thematiqueId: "t1", question: "Quel est le délai ?", questionEn: "", briefQr: "", briefQrEn: "",
    ...overrides,
})

const mkThematique = (overrides: Partial<Thematique> = {}): Thematique => ({
    id: "t1", label: "Livraison", labelEn: "Delivery", imageUrl: "", iconUrl: "",
    ...overrides,
})

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.dialogRef.current = null
    mocks.countByThematique = {}
    mocks.handleDeleteQR.mockResolvedValue(undefined)
    mocks.handleDeleteThematique.mockResolvedValue(undefined)
})

describe("DeleteQRDialog", () => {
    test("visible uniquement en mode delete-qr, avec le nom de la question dans le message", () => {
        mocks.dialogRef.current = { mode: "delete-qr", qr: mkQR() }
        render(<DeleteQRDialog />)
        expect(screen.getByRole("dialog")).toBeInTheDocument()
        expect(screen.getByText(UI_TEXT.fr.deleteQuestionConfirm("Quel est le délai ?"))).toBeInTheDocument()
    })

    test("absent si le mode n'est pas delete-qr", () => {
        mocks.dialogRef.current = { mode: "delete-thematique", thematique: mkThematique() }
        render(<DeleteQRDialog />)
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    test("clic sur Supprimer appelle handleDeleteQR", async () => {
        const user = userEvent.setup()
        mocks.dialogRef.current = { mode: "delete-qr", qr: mkQR() }
        render(<DeleteQRDialog />)
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.delete }))
        expect(mocks.handleDeleteQR).toHaveBeenCalledTimes(1)
    })

    test("clic sur Annuler ferme le dialog sans supprimer", async () => {
        const user = userEvent.setup()
        mocks.dialogRef.current = { mode: "delete-qr", qr: mkQR() }
        render(<DeleteQRDialog />)
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.cancel }))
        expect(mocks.closeDialog).toHaveBeenCalledTimes(1)
        expect(mocks.handleDeleteQR).not.toHaveBeenCalled()
    })
})

describe("DeleteThematiqueDialog", () => {
    test("aucun avertissement de cascade si la thématique n'a aucune Q&R", () => {
        mocks.dialogRef.current = { mode: "delete-thematique", thematique: mkThematique() }
        mocks.countByThematique = { t1: 0 }
        render(<DeleteThematiqueDialog />)
        expect(screen.getByText(UI_TEXT.fr.deleteTopicConfirm("Livraison"))).toBeInTheDocument()
        expect(screen.queryByText(UI_TEXT.fr.deleteTopicWarning(1))).not.toBeInTheDocument()
    })

    test("affiche l'avertissement de suppression en cascade si la thématique a des Q&R", () => {
        mocks.dialogRef.current = { mode: "delete-thematique", thematique: mkThematique() }
        mocks.countByThematique = { t1: 3 }
        render(<DeleteThematiqueDialog />)
        expect(screen.getByText(UI_TEXT.fr.deleteTopicWarning(3))).toBeInTheDocument()
    })

    test("clic sur Supprimer appelle handleDeleteThematique", async () => {
        const user = userEvent.setup()
        mocks.dialogRef.current = { mode: "delete-thematique", thematique: mkThematique() }
        mocks.countByThematique = { t1: 2 }
        render(<DeleteThematiqueDialog />)
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.delete }))
        expect(mocks.handleDeleteThematique).toHaveBeenCalledTimes(1)
    })

    test("les boutons sont désactivés pendant la suppression (protection double-soumission)", async () => {
        const user = userEvent.setup()
        let resolveDelete!: () => void
        mocks.handleDeleteThematique.mockReturnValue(new Promise<void>((resolve) => { resolveDelete = resolve }))
        mocks.dialogRef.current = { mode: "delete-thematique", thematique: mkThematique() }
        render(<DeleteThematiqueDialog />)

        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.delete }))
        await waitFor(() => {
            expect(screen.getByRole("button", { name: UI_TEXT.fr.cancel })).toBeDisabled()
        })

        resolveDelete()
        await waitFor(() => {
            expect(screen.getByRole("button", { name: UI_TEXT.fr.cancel })).not.toBeDisabled()
        })
    })
})
