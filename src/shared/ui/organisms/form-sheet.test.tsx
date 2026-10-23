import { expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SquarePen } from "lucide-react"
import { FormSheet } from "./form-sheet"

/**
 * Le bouton de suppression est une icône discrète, à quelques pixels du bouton
 * « Annuler », et la plupart des suppressions du dépôt sont irréversibles. Ce
 * fichier existe pour une seule raison : garantir qu'aucun clic unique ne
 * supprime quoi que ce soit.
 *
 * `fireEvent` et non `user-event` : `rstest.config.ts` tourne en
 * `isolate: false`, et piloter un overlay Radix à la souris dans un jsdom
 * partagé échoue par intermittence selon le fichier exécuté juste avant.
 */

function renderSheet(props: Partial<Parameters<typeof FormSheet>[0]> = {}) {
    return render(
        <FormSheet
            open
            onClose={() => {}}
            icon={SquarePen}
            title="MSCU1234567"
            onSubmit={() => {}}
            {...props}
        >
            <p>corps</p>
        </FormSheet>,
    )
}

const deleteButton = () => screen.getByRole("button", { name: "Supprimer l'arrivage" })

// ─── Confirmation ─────────────────────────────────────────────────────────────

test("un clic sur la corbeille ne supprime rien, il demande confirmation", () => {
    const onDelete = rstest.fn()
    renderSheet({ onDelete, deleteLabel: "Supprimer l'arrivage" })

    fireEvent.click(deleteButton())

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
})

test("confirmer déclenche la suppression puis referme le dialogue", async () => {
    const onDelete = rstest.fn()
    renderSheet({ onDelete, deleteLabel: "Supprimer l'arrivage" })

    fireEvent.click(deleteButton())
    fireEvent.click(screen.getByRole("button", { name: "Supprimer" }))

    expect(onDelete).toHaveBeenCalledTimes(1)
    // `confirmDelete` est async : la fermeture arrive après `await onDelete()`.
    // L'attendre garde ces mises à jour d'état dans `act` (sinon warning).
    await waitFor(() =>
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    )
})

test("annuler referme sans supprimer", () => {
    const onDelete = rstest.fn()
    renderSheet({ onDelete, deleteLabel: "Supprimer l'arrivage" })

    fireEvent.click(deleteButton())
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }))

    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
})

test("le dialogue reprend le texte fourni par l'écran", () => {
    renderSheet({
        onDelete: rstest.fn(),
        deleteLabel: "Supprimer l'arrivage",
        deleteConfirm: {
            title: "Supprimer l'arrivage MSCU1234567 ?",
            description: "Cette action est définitive.",
        },
    })

    fireEvent.click(deleteButton())

    expect(screen.getByText("Supprimer l'arrivage MSCU1234567 ?")).toBeInTheDocument()
    expect(screen.getByText("Cette action est définitive.")).toBeInTheDocument()
})

test("sans texte fourni, le dialogue reste explicite", () => {
    renderSheet({ onDelete: rstest.fn(), deleteLabel: "Supprimer l'arrivage" })

    fireEvent.click(deleteButton())

    expect(screen.getByText("Supprimer l'arrivage ?")).toBeInTheDocument()
})

// ─── Absence de suppression ───────────────────────────────────────────────────

test("sans onDelete, aucune corbeille n'est rendue", () => {
    // C'est ainsi que le droit de suppression se traduit à l'écran : l'écran ne
    // passe pas `onDelete` quand l'utilisateur ne l'a pas.
    renderSheet()

    expect(screen.queryByRole("button", { name: /Supprimer/ })).not.toBeInTheDocument()
})

test("une sheet en lecture seule n'a pas de pied d'action", () => {
    // Sans `onSubmit`, la sheet sert à consulter — le journal d'activité, par
    // exemple, qui est produit par des triggers et ne s'édite pas.
    renderSheet({ onSubmit: undefined, onDelete: rstest.fn() })

    expect(screen.queryByRole("button", { name: "Enregistrer" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Supprimer/ })).not.toBeInTheDocument()
})

// ─── Pastille d'en-tête ───────────────────────────────────────────────────────

test("la pastille accepte un nœud déjà composé", () => {
    // Utilisé par la sheet de journal, dont l'icône est celle du type d'entité
    // et porte déjà sa couleur.
    renderSheet({ icon: <span data-testid="pastille" /> })

    expect(screen.getByTestId("pastille")).toBeInTheDocument()
})
