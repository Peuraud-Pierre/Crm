// ── ThematiqueFormDialog.soumission.test.tsx ──────────────────────────────────
// Tests unitaires de ThematiqueFormDialog — SOUMISSION, ÉTAT isSaving, PRÉ-REMPLISSAGE.
//
// Fait partie d'un groupe de 4 fichiers (voir ThematiqueFormDialog.test.tsx pour
// la liste complète et l'explication du découpage / de la duplication du mock).
//
// Comportements testés ICI :
//   1. Appel de handleSaveThematique avec les valeurs saisies (trimées)
//   2. Soumission via la touche Entrée
//   3. État isSaving : bouton + annulation désactivés pendant la sauvegarde
//   4. Pré-remplissage des champs en mode renommage (via onOpenAutoFocus)

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"

const mocks = rstest.hoisted(() => {
    return {
        closeDialog: rstest.fn(),
        handleSaveThematique: rstest.fn(),
        uploadThematiqueImage: rstest.fn(),
        uploadThematiqueIcon: rstest.fn(),
        discardUnsavedThematiqueMedia: rstest.fn(),
        resolveThematiqueMediaUrl: rstest.fn(),
        dialogRef: { current: null as null | { mode: string; thematique?: object } },
    }
})

function mockBiblioContextValue() {
    return {
        nav: { ui: UI_TEXT.fr },
        dialogs: {
            dialog: mocks.dialogRef.current,
            closeDialog: mocks.closeDialog,
        },
        handlers: {
            handleSaveThematique: mocks.handleSaveThematique,
            uploadThematiqueImage: mocks.uploadThematiqueImage,
            uploadThematiqueIcon: mocks.uploadThematiqueIcon,
            discardUnsavedThematiqueMedia: mocks.discardUnsavedThematiqueMedia,
            resolveThematiqueMediaUrl: mocks.resolveThematiqueMediaUrl,
        },
    }
}

rstest.mock("@/features/bibliotheque/context/BiblioContext", () => ({
    useBiblioContext: mockBiblioContextValue,
}))

import { ThematiqueFormDialog } from "./ThematiqueFormDialog"

beforeEach(() => {
    rstest.clearAllMocks()
    mocks.dialogRef.current = { mode: "create-thematique" }
    mocks.handleSaveThematique.mockResolvedValue(undefined)
    mocks.uploadThematiqueImage.mockResolvedValue("livraison.png")
    mocks.uploadThematiqueIcon.mockResolvedValue("icons/livraison.svg")
    mocks.discardUnsavedThematiqueMedia.mockResolvedValue(undefined)
    mocks.resolveThematiqueMediaUrl.mockImplementation((v: string) => v ? `resolved:${v}` : "")
})

// ── Soumission du formulaire ───────────────────────────────────────────────────
// Vérifie que handleSaveThematique est appelé avec les bonnes valeurs.
// Le composant trim() les valeurs avant de les passer — important à tester.

describe("ThematiqueFormDialog — soumission", () => {
    test("appelle handleSaveThematique avec les valeurs saisies (trimées)", async () => {
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)

        await user.type(
            screen.getByLabelText(new RegExp(UI_TEXT.fr.topicNameLabel, "i")),
            "  Livraison  "
        )
        await user.type(
            screen.getByLabelText(new RegExp(UI_TEXT.en.topicNameLabel, "i")),
            "Delivery"
        )
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.create }))

        await waitFor(() => expect(mocks.handleSaveThematique).toHaveBeenCalledTimes(1))
        expect(mocks.handleSaveThematique).toHaveBeenCalledWith(
            "Livraison",
            "Delivery",
            "",
            ""
        )
    })

    test("soumission via la touche Entrée dans un champ déclenche le save", async () => {
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)

        const frInput = screen.getByLabelText(new RegExp(UI_TEXT.fr.topicNameLabel, "i"))
        const enInput = screen.getByLabelText(new RegExp(UI_TEXT.en.topicNameLabel, "i"))

        await user.type(frInput, "Livraison")
        await user.type(enInput, "Delivery{Enter}")

        await waitFor(() => expect(mocks.handleSaveThematique).toHaveBeenCalledTimes(1))
    })
})

// ── État isSaving ─────────────────────────────────────────────────────────────
// Pendant la sauvegarde (handleSaveThematique en attente), le composant doit :
//   - Afficher un loader à la place du libellé du bouton
//   - Désactiver le bouton de soumission (empêche la double soumission)
//   - Désactiver le bouton Annuler (empêche la fermeture en cours de save)

describe("ThematiqueFormDialog — état isSaving", () => {
    test("le bouton de soumission est désactivé pendant la sauvegarde", async () => {
        const user = userEvent.setup()

        let resolveSave!: () => void
        const saveInProgress = new Promise<void>((resolve) => { resolveSave = resolve })
        mocks.handleSaveThematique.mockReturnValueOnce(saveInProgress)

        render(<ThematiqueFormDialog />)
        await user.type(
            screen.getByLabelText(new RegExp(UI_TEXT.fr.topicNameLabel, "i")),
            "Livraison"
        )
        await user.type(
            screen.getByLabelText(new RegExp(UI_TEXT.en.topicNameLabel, "i")),
            "Delivery"
        )

        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.create }))

        await waitFor(() => {
            expect(screen.getByText(UI_TEXT.fr.saving)).toBeInTheDocument()
        })

        const savingButton = screen.getByRole("button", { name: new RegExp(UI_TEXT.fr.saving) })
        expect(savingButton).toBeDisabled()

        resolveSave()
        await waitFor(() => expect(screen.queryByText(UI_TEXT.fr.saving)).not.toBeInTheDocument())
    })

    test("le bouton Annuler est désactivé pendant la sauvegarde", async () => {
        const user = userEvent.setup()

        let resolveSave!: () => void
        const saveInProgress = new Promise<void>((resolve) => { resolveSave = resolve })
        mocks.handleSaveThematique.mockReturnValueOnce(saveInProgress)

        render(<ThematiqueFormDialog />)
        await user.type(
            screen.getByLabelText(new RegExp(UI_TEXT.fr.topicNameLabel, "i")),
            "Livraison"
        )
        await user.type(
            screen.getByLabelText(new RegExp(UI_TEXT.en.topicNameLabel, "i")),
            "Delivery"
        )
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.create }))

        await waitFor(() => {
            expect(screen.getByRole("button", { name: UI_TEXT.fr.cancel })).toBeDisabled()
        })

        resolveSave()
        await waitFor(() => {
            expect(screen.getByRole("button", { name: UI_TEXT.fr.cancel })).not.toBeDisabled()
        })
    })
})

// ── Sélection de média bloquée pendant la sauvegarde ──────────────────────────
// Bug corrigé : les boutons "choisir un fichier" ne vérifiaient que leur PROPRE
// état d'upload (isUploadingImage/isUploadingIcon), pas isSaving. Un clic
// pendant la sauvegarde pouvait lancer un nouvel upload dont le chemin
// remplaçait imageUrl/iconUrl dans le formulaire APRÈS que handleSubmit ait
// déjà capturé finalImageUrl/finalIconUrl — cleanupAbandonedUploads supprimait
// alors le fichier fraîchement uploadé, que l'UI affichait pourtant comme actuel.

describe("ThematiqueFormDialog — sélection de média bloquée pendant la sauvegarde", () => {
    test("les boutons de sélection d'image et d'icône sont désactivés pendant isSaving", async () => {
        const user = userEvent.setup()
        let resolveSave!: () => void
        const saveInProgress = new Promise<void>((resolve) => { resolveSave = resolve })
        mocks.handleSaveThematique.mockReturnValueOnce(saveInProgress)

        render(<ThematiqueFormDialog />)
        await user.type(
            screen.getByLabelText(new RegExp(UI_TEXT.fr.topicNameLabel, "i")),
            "Livraison"
        )
        await user.type(
            screen.getByLabelText(new RegExp(UI_TEXT.en.topicNameLabel, "i")),
            "Delivery"
        )
        await user.click(screen.getByRole("button", { name: UI_TEXT.fr.create }))

        await waitFor(() => {
            expect(screen.getByRole("button", { name: UI_TEXT.fr.topicImageChoose })).toBeDisabled()
            expect(screen.getByRole("button", { name: UI_TEXT.fr.topicIconChoose })).toBeDisabled()
        })

        resolveSave()
        await waitFor(() => expect(screen.queryByText(UI_TEXT.fr.saving)).not.toBeInTheDocument())
        expect(screen.getByRole("button", { name: UI_TEXT.fr.topicImageChoose })).not.toBeDisabled()
    })
})

// ── Pré-remplissage en mode renommage ─────────────────────────────────────────
// Quand le dialog s'ouvre en mode "rename-thematique", les champs doivent être
// initialisés avec les valeurs actuelles de la thématique (via onOpenAutoFocus).
//
// Note : cet événement est déclenché par le FocusTrap de Radix UI au montage
// du DialogContent. En jsdom, il se déclenche via le système de focus natif.

describe("ThematiqueFormDialog — pré-remplissage (mode renommage)", () => {
    test("les champs sont pré-remplis avec le label FR et EN de la thématique", async () => {
        mocks.dialogRef.current = {
            mode: "rename-thematique",
            thematique: { id: "t1", label: "Livraison", labelEn: "Delivery", imageUrl: "", iconUrl: "" },
        }
        render(<ThematiqueFormDialog />)

        await waitFor(() => {
            expect(
                screen.getByLabelText(new RegExp(UI_TEXT.fr.topicNameLabel, "i"))
            ).toHaveValue("Livraison")
        }, { timeout: 500 })

        expect(
            screen.getByLabelText(new RegExp(UI_TEXT.en.topicNameLabel, "i"))
        ).toHaveValue("Delivery")
    })

    test("le bouton est activé immédiatement (champs pré-remplis, pas vides)", async () => {
        mocks.dialogRef.current = {
            mode: "rename-thematique",
            thematique: { id: "t1", label: "Livraison", labelEn: "Delivery", imageUrl: "", iconUrl: "" },
        }
        render(<ThematiqueFormDialog />)

        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: UI_TEXT.fr.rename })
            ).not.toBeDisabled()
        }, { timeout: 500 })
    })
})
