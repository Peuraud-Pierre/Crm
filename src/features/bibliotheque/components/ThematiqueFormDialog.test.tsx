// ── ThematiqueFormDialog.test.tsx ─────────────────────────────────────────────
// Tests unitaires de ThematiqueFormDialog — RENDU DE BASE ET VALIDATION.
//
// Ce fichier fait partie d'un groupe de 4 fichiers de test pour ce composant,
// scindé pour rester sous le seuil de 400 lignes (CLAUDE.md — "God components").
// Voir aussi (même dossier) :
//   - ThematiqueFormDialog.soumission.test.tsx  → soumission, isSaving, pré-remplissage
//   - ThematiqueFormDialog.upload.test.tsx      → upload d'image/icône
//   - ThematiqueFormDialog.media-cleanup.test.tsx → nettoyage Storage (orphelins)
//
// Ce composant dépend de useBiblioContext → il faut mocker le contexte.
// On utilise rstest.mock() + rstest.hoisted() pour que le mock soit prêt
// AVANT que React importe le module sous test (exigence du système de modules
// ESM : les imports sont évalués avant tout code). Ce bloc de setup est
// dupliqué à l'identique dans les 4 fichiers : rstest.mock() est résolu au
// niveau du fichier (comme vi.mock()), impossible à mutualiser dans un helper
// importé sans casser le hoisting.
//
// Comportements testés ICI :
//   1. Visibilité du dialog selon le mode (create-thematique / rename-thematique / null)
//   2. Titre et libellé du bouton adapté au mode (Créer vs Renommer)
//   3. Validation du formulaire : bouton désactivé tant que les deux noms sont vides

import { describe, expect, test, rstest, beforeEach } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UI_TEXT } from "../constants"

// ── Mock du contexte ───────────────────────────────────────────────────────────
// `dialogRef` est un conteneur mutable : on peut changer `dialogRef.current`
// dans chaque test pour simuler différents états du dialog (create, rename, null),
// car la fn useBiblioContext() lit la valeur AU MOMENT DU RENDU (pas au hoist).

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

// Nommée "mock…" (et non "use…") : ce n'est pas un vrai hook React, juste une
// factory de valeur de contexte — le préfixe use est réservé aux hooks.
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

// L'import du composant est APRÈS rstest.mock() pour que le mock soit actif
// quand React évalue l'import de BiblioContext depuis le composant.
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

// ── Visibilité du dialog ───────────────────────────────────────────────────────
// La Dialog Radix rend son contenu dans un portal sur document.body.
// role="dialog" est accessible via screen.getByRole() car RTL interroge
// l'intégralité de document.body.

describe("ThematiqueFormDialog — visibilité", () => {
    test("dialog visible quand mode est 'create-thematique'", () => {
        mocks.dialogRef.current = { mode: "create-thematique" }
        render(<ThematiqueFormDialog />)
        expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    test("dialog visible quand mode est 'rename-thematique'", () => {
        mocks.dialogRef.current = {
            mode: "rename-thematique",
            thematique: { id: "t1", label: "Livraison", labelEn: "Delivery", imageUrl: "", iconUrl: "" },
        }
        render(<ThematiqueFormDialog />)
        expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    test("dialog absent quand dialog est null (aucun dialog ouvert)", () => {
        mocks.dialogRef.current = null
        render(<ThematiqueFormDialog />)
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })

    test("dialog absent quand mode ne correspond pas au composant", () => {
        // Un mode d'un autre dialog ne doit pas ouvrir ce composant
        mocks.dialogRef.current = { mode: "edit-brief" }
        render(<ThematiqueFormDialog />)
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
})

// ── Contenu selon le mode ─────────────────────────────────────────────────────
// Le titre et le libellé du bouton de soumission varient entre création et renommage.

describe("ThematiqueFormDialog — contenu selon le mode", () => {
    test("mode création : titre 'Nouvelle thématique'", () => {
        render(<ThematiqueFormDialog />)
        expect(screen.getByText(UI_TEXT.fr.newTopicTitle)).toBeInTheDocument()
    })

    test("mode renommage : titre 'Renommer la thématique'", () => {
        mocks.dialogRef.current = {
            mode: "rename-thematique",
            thematique: { id: "t1", label: "Livraison", labelEn: "Delivery", imageUrl: "", iconUrl: "" },
        }
        render(<ThematiqueFormDialog />)
        expect(screen.getByText(UI_TEXT.fr.renameTopic)).toBeInTheDocument()
    })

    test("mode création : bouton de soumission libellé 'Créer'", () => {
        render(<ThematiqueFormDialog />)
        expect(screen.getByRole("button", { name: UI_TEXT.fr.create })).toBeInTheDocument()
    })

    test("mode renommage : bouton de soumission libellé 'Renommer'", () => {
        mocks.dialogRef.current = {
            mode: "rename-thematique",
            thematique: { id: "t1", label: "Livraison", labelEn: "Delivery", imageUrl: "", iconUrl: "" },
        }
        render(<ThematiqueFormDialog />)
        expect(screen.getByRole("button", { name: UI_TEXT.fr.rename })).toBeInTheDocument()
    })
})

// ── Validation du formulaire ───────────────────────────────────────────────────
// Le bouton de soumission est désactivé (disabled) dès qu'un des deux champs
// obligatoires est vide. Les deux doivent être remplis pour que la création/
// renommage soit possible.

describe("ThematiqueFormDialog — validation", () => {
    test("bouton désactivé au départ (champs vides)", () => {
        render(<ThematiqueFormDialog />)
        expect(screen.getByRole("button", { name: UI_TEXT.fr.create })).toBeDisabled()
    })

    test("bouton désactivé si le nom FR est vide même quand le nom EN est rempli", async () => {
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        const enInput = screen.getByLabelText(
            new RegExp(UI_TEXT.en.topicNameLabel, "i")
        )
        await user.type(enInput, "Delivery")
        expect(screen.getByRole("button", { name: UI_TEXT.fr.create })).toBeDisabled()
    })

    test("bouton désactivé si le nom EN est vide même quand le nom FR est rempli", async () => {
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        const frInput = screen.getByLabelText(
            new RegExp(UI_TEXT.fr.topicNameLabel, "i")
        )
        await user.type(frInput, "Livraison")
        expect(screen.getByRole("button", { name: UI_TEXT.fr.create })).toBeDisabled()
    })

    test("bouton activé quand les deux noms sont remplis", async () => {
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await user.type(
            screen.getByLabelText(new RegExp(UI_TEXT.fr.topicNameLabel, "i")),
            "Livraison"
        )
        await user.type(
            screen.getByLabelText(new RegExp(UI_TEXT.en.topicNameLabel, "i")),
            "Delivery"
        )
        expect(screen.getByRole("button", { name: UI_TEXT.fr.create })).not.toBeDisabled()
    })

    test("bouton reste désactivé si les champs ne contiennent que des espaces", async () => {
        // Le composant fait label.trim() avant de valider — des espaces comptent comme vide
        const user = userEvent.setup()
        render(<ThematiqueFormDialog />)
        await user.type(
            screen.getByLabelText(new RegExp(UI_TEXT.fr.topicNameLabel, "i")),
            "   "
        )
        await user.type(
            screen.getByLabelText(new RegExp(UI_TEXT.en.topicNameLabel, "i")),
            "   "
        )
        expect(screen.getByRole("button", { name: UI_TEXT.fr.create })).toBeDisabled()
    })
})
