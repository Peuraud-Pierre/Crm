import { expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen } from "@testing-library/react"
import type { FicheTriBalle, FicheTriComplete } from "@/features/salle-de-tri/types/tri.types"

/**
 * Carte d'une fiche : poids trié des balles affichées, trieur, fournisseurs
 * des balles, écart signalé en en-tête, ouverture au clic comme au clavier.
 */

const mocks = rstest.hoisted(() => {
    const sorties = [{ id: "mag", code: "MAG", libelle: "Magasin", ordre: 1, actif: true, created_at: "" }]
    return { useTriContext: rstest.fn(() => ({ sorties, sortieById: new Map(sorties.map((s) => [s.id, s])) })) }
})
rstest.mock("@/features/salle-de-tri/hooks/context/TriContext", () => ({ useTriContext: mocks.useTriContext }))

import { FicheTriCard } from "./FicheTriCard"

const balle = (fournisseur_nom: string, initial: number, mag: number): FicheTriBalle => ({
    id: `${fournisseur_nom}-${initial}`, fiche_id: "f1", ordre: 0, fournisseur_id: fournisseur_nom, fournisseur_nom,
    category_id: "pant", poids_initial_kg: initial, qualite: 2, note: null,
    poids_reparti_kg: mag, ecart_kg: mag - initial, repartition: [{ sortie_id: "mag", poids_kg: mag }],
})

const fiche = (balles: FicheTriBalle[]) => ({
    id: "f1", code: "T-0042", trieur_nom: "Karim", duree_minutes: 150, balles,
}) as unknown as FicheTriComplete

test("poids trié, trieur, fournisseurs des balles ; l'écart s'annonce", () => {
    render(<FicheTriCard fiche={fiche([balle("XYZ", 100, 96), balle("ABC", 50, 50)])} onOpen={() => {}} />)

    expect(screen.getByText("150")).toBeInTheDocument()
    expect(screen.getByText("Karim")).toBeInTheDocument()
    expect(screen.getByText("ABC, XYZ")).toBeInTheDocument()
    expect(screen.getByText(/−4\skg/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /T-0042.*1 balle en écart/ })).toBeInTheDocument()
})

test("sans écart, pas d'alerte ; Entrée ouvre la fiche", () => {
    const onOpen = rstest.fn()
    const f = fiche([balle("ABC", 50, 50)])
    render(<FicheTriCard fiche={f} onOpen={onOpen} />)

    const card = screen.getByRole("button", { name: "Fiche T-0042, Karim" })
    fireEvent.keyDown(card, { key: "Enter" })
    expect(onOpen).toHaveBeenCalledWith(f)
})
