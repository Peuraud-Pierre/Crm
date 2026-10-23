// ── QRFormDialog.test.tsx ─────────────────────────────────────────────────────
// Tests unitaires de QRFormDialog — jusqu'ici sans aucun test direct, alors que
// sa structure (deux modes, pré-remplissage via onOpenAutoFocus, validation,
// soumission) est la même famille de risques que ThematiqueFormDialog (déjà
// testé). Voir aussi FormatEditDialog.test.tsx, DeleteDialogs.test.tsx,
// BriefChiffresDialogs.test.tsx pour les 3 autres dialogs jusqu'ici non testés.

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"
import type { Thematique, QR } from "../types"

const mocks = rstest.hoisted(() => ({
    closeDialog: rstest.fn(),
    handleSaveQR: rstest.fn(),
    dialogRef: { current: null as null | { mode: string; qr?: QR } },
    thematiques: [] as Thematique[],
    activeId: "",
}))

function mockBiblioContextValue() {
    return {
        data: { thematiques: mocks.thematiques },
        nav: { lang: "fr" as const, ui: UI_TEXT.fr, activeId: mocks.activeId },
        dialogs: { dialog: mocks.dialogRef.current, closeDialog: mocks.closeDialog },
        handlers: { handleSaveQR: mocks.handleSaveQR },
    }
}

rstest.mock("@/features/bibliotheque/context/BiblioContext", () => ({
    useBiblioContext: mockBiblioContextValue,
}))

import { QRFormDialog } from "./QRFormDialog"

const mkThematique = (overrides: Partial<Thematique> = {}): Thematique => ({
    id: "t1", label: "Livraison", labelEn: "Delivery", imageUrl: "", iconUrl: "",
    ...overrides,
})

const mkQR = (overrides: Partial<QR> = {}): QR => ({
    id: "qr1", thematiqueId: "t1", question: "Ancienne question", questionEn: "Old question",
    briefQr: "Ancienne réponse", briefQrEn: "Old answer",
    ...overrides,
})

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.dialogRef.current = { mode: "create-qr" }
    mocks.thematiques = [mkThematique()]
    mocks.activeId = "t1"
    mocks.handleSaveQR.mockResolvedValue(undefined)
})

describe("QRFormDialog — visibilité et contenu", () => {
    test("visible et titré 'nouvelle question' en mode create-qr", () => {
        mocks.dialogRef.current = { mode: "create-qr" }
        render(<QRFormDialog />)
        expect(screen.getByRole("dialog")).toBeInTheDocument()
        expect(screen.getByText(UI_TEXT.fr.newQuestion)).toBeInTheDocument()
    })

    test("visible et titré 'modifier la question' en mode edit-qr", () => {
        mocks.dialogRef.current = { mode: "edit-qr", qr: mkQR() }
        render(<QRFormDialog />)
        expect(screen.getByText(UI_TEXT.fr.editQuestion)).toBeInTheDocument()
    })

    test("absent si dialog est null", () => {
        mocks.dialogRef.current = null
        render(<QRFormDialog />)
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
})

describe("QRFormDialog — pré-remplissage", () => {
    test("mode édition : les 4 champs texte sont pré-remplis avec la QR existante", async () => {
        // Le label "Question" est identique en FR et EN (UI_TEXT.fr/en.questionLabel) —
        // on cible chaque champ par son id (selector) plutôt que par le seul texte du
        // label, pour lever l'ambiguïté entre les deux colonnes FR/EN.
        mocks.dialogRef.current = { mode: "edit-qr", qr: mkQR() }
        render(<QRFormDialog />)
        await waitFor(() => {
            expect(screen.getByLabelText(UI_TEXT.fr.questionLabel, { selector: "#qr-question-fr" })).toHaveValue("Ancienne question")
        })
        expect(screen.getByLabelText(UI_TEXT.fr.reponseLabel, { selector: "#qr-brief-fr" })).toHaveValue("Ancienne réponse")
        expect(screen.getByLabelText(UI_TEXT.en.questionLabel, { selector: "#qr-question-en" })).toHaveValue("Old question")
        expect(screen.getByLabelText(UI_TEXT.en.reponseLabel, { selector: "#qr-brief-en" })).toHaveValue("Old answer")
    })

    test("mode création : le select de thématique est pré-rempli avec activeId", async () => {
        mocks.dialogRef.current = { mode: "create-qr" }
        mocks.activeId = "t1"
        render(<QRFormDialog />)
        // Le select affiche le libellé de la thématique active (Livraison)
        await waitFor(() => expect(screen.getByText("Livraison")).toBeInTheDocument())
    })
})

describe("QRFormDialog — validation", () => {
    test("bouton désactivé tant que question et réponse FR sont vides", () => {
        mocks.dialogRef.current = { mode: "create-qr" }
        render(<QRFormDialog />)
        expect(screen.getByRole("button", { name: UI_TEXT.fr.add })).toBeDisabled()
    })

    test("bouton toujours désactivé tant que question et réponse EN sont vides (FR seul ne suffit pas)", async () => {
        const user = userEvent.setup()
        mocks.dialogRef.current = { mode: "create-qr" }
        render(<QRFormDialog />)
        await user.type(screen.getByLabelText(UI_TEXT.fr.questionLabel, { selector: "#qr-question-fr" }), "Nouvelle question")
        await user.type(screen.getByLabelText(UI_TEXT.fr.reponseLabel, { selector: "#qr-brief-fr" }), "Nouvelle réponse")
        expect(screen.getByRole("button", { name: UI_TEXT.fr.add })).toBeDisabled()
    })

    test("bouton activé une fois question/réponse FR et EN, et thématique renseignées", async () => {
        const user = userEvent.setup()
        mocks.dialogRef.current = { mode: "create-qr" }
        render(<QRFormDialog />)
        await user.type(screen.getByLabelText(UI_TEXT.fr.questionLabel, { selector: "#qr-question-fr" }), "Nouvelle question")
        await user.type(screen.getByLabelText(UI_TEXT.fr.reponseLabel, { selector: "#qr-brief-fr" }), "Nouvelle réponse")
        await user.type(screen.getByLabelText(UI_TEXT.en.questionLabel, { selector: "#qr-question-en" }), "New question")
        await user.type(screen.getByLabelText(UI_TEXT.en.reponseLabel, { selector: "#qr-brief-en" }), "New answer")
        expect(screen.getByRole("button", { name: UI_TEXT.fr.add })).not.toBeDisabled()
    })
})

describe("QRFormDialog — soumission", () => {
    test("appelle handleSaveQR avec les valeurs trimées et la thématique sélectionnée", async () => {
        const user = userEvent.setup()
        mocks.dialogRef.current = { mode: "create-qr" }
        render(<QRFormDialog />)

        await user.type(screen.getByLabelText(UI_TEXT.fr.questionLabel, { selector: "#qr-question-fr" }), "  Q  ")
        await user.type(screen.getByLabelText(UI_TEXT.fr.reponseLabel, { selector: "#qr-brief-fr" }), "  R  ")
        await user.type(screen.getByLabelText(UI_TEXT.en.questionLabel, { selector: "#qr-question-en" }), "  Q-en  ")
        await user.type(screen.getByLabelText(UI_TEXT.en.reponseLabel, { selector: "#qr-brief-en" }), "  R-en  ")
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.add }))

        await waitFor(() => expect(mocks.handleSaveQR).toHaveBeenCalledTimes(1))
        expect(mocks.handleSaveQR).toHaveBeenCalledWith("Q", "R", "Q-en", "R-en", "t1")
    })
})
