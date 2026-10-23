import { expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import type { FluxHandpickRow } from "@/features/stock_handpick/types/flux.types"

/**
 * Fiche de lecture d'une expédition — ce qu'elle doit garantir.
 *
 * Deux choses la distinguent du formulaire et sont vérifiées ici : le pied
 * « Modifier » n'existe que si l'appelant le fournit (convention posée par
 * `BalleDetailSheet` : pas de bouton désactivé pour un lecteur seul), et les
 * totaux sont calculés depuis les lignes, jamais d'une saisie.
 */

// La liste de colisage a son propre chargement, ses propres droits et son
// propre fichier de test : elle n'apprend rien sur la fiche.
rstest.mock("./LignesPanel", () => ({
    LignesPanel: () => <div data-testid="lignes" />,
}))

import { FluxDetailSheet } from "./FluxDetailSheet"

function flux(over: Partial<FluxHandpickRow> = {}): FluxHandpickRow {
    return {
        id: "11111111-2222-3333-4444-555555555555",
        direction: "in",
        status: "planifié",
        fournisseur_id: null,
        type: null,
        poids_kg: null,
        fournisseur: { id: "f1", name: "Fournisseur Un" },
        departure_date: "2026-01-05",
        prev_dechargement_at: null,
        notes: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        created_by: null,
        lignes_count: 3,
        total_weight_kg: 1000,
        total_qty: 40,
        total_value: 2500,
        ...over,
    }
}

const renderSheet = (over: Partial<FluxHandpickRow> = {}, onEdit?: () => void) =>
    render(
        <FluxDetailSheet
            open
            flux={flux(over)}
            canCreate={false}
            canDelete={false}
            onClose={rstest.fn()}
            onEdit={onEdit}
        />,
    )

// ─── Pied d'action ────────────────────────────────────────────────────────────

test("sans onEdit, la fiche n'offre aucun bouton Modifier", () => {
    renderSheet()

    expect(screen.queryByRole("button", { name: "Modifier" })).not.toBeInTheDocument()
})

test("avec onEdit, le bouton Modifier le déclenche", async () => {
    const onEdit = rstest.fn()
    renderSheet({}, onEdit)

    screen.getByRole("button", { name: "Modifier" }).click()

    expect(onEdit).toHaveBeenCalledTimes(1)
})

// ─── Totaux ───────────────────────────────────────────────────────────────────

test("les totaux affichés sont ceux de la vue, pas une saisie", () => {
    renderSheet()

    expect(screen.getByText("1 000")).toBeInTheDocument()
    expect(screen.getByText("40")).toBeInTheDocument()
})

test("une valeur nulle s'affiche en tiret et non en zéro euro", () => {
    renderSheet({ total_value: 0 })

    expect(screen.queryByText(/0,00/)).not.toBeInTheDocument()
})

// ─── Identité ─────────────────────────────────────────────────────────────────

test("le fournisseur titre la fiche", () => {
    renderSheet()

    expect(screen.getByRole("heading", { name: "Fournisseur Un" })).toBeInTheDocument()
})

test("sans fournisseur, le sens sert de titre", () => {
    renderSheet({ fournisseur: null, direction: "out" })

    expect(screen.getByRole("heading", { name: /Départ sans usine/ })).toBeInTheDocument()
})

// ─── Liste de colisage ────────────────────────────────────────────────────────

test("la fiche porte la liste de colisage", () => {
    // C'est ce qui la distingue du formulaire, et ce qui a permis de retirer le
    // contournement `canUpdate: true` de la garde de lien profond.
    renderSheet()

    expect(screen.getByTestId("lignes")).toBeInTheDocument()
})
