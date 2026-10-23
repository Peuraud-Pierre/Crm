import { expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen } from "@testing-library/react"
import type { FicheTriComplete } from "@/features/salle-de-tri/types/tri.types"

/**
 * Navigation entre fiches depuis la fiche résumé : boutons ‹ › et flèches
 * du clavier, sauf pendant une saisie.
 */

const mocks = rstest.hoisted(() => {
    const sorties = [{ id: "mag", code: "MAG", libelle: "Magasin", ordre: 1, actif: true, created_at: "" }]
    return {
        useTriContext: rstest.fn(() => ({
            sorties,
            sortieById: new Map(sorties.map((s) => [s.id, s])),
            categoryName: () => "Jean",
            deleteFiche: async () => true,
        })),
    }
})
rstest.mock("@/features/salle-de-tri/hooks/context/TriContext", () => ({ useTriContext: mocks.useTriContext }))
rstest.mock("@/features/stock", () => ({ EntityTimeline: () => null }))

import { FicheTriDetailSheet } from "./FicheTriDetailSheet"

const fiche = {
    id: "f1", code: "T-0042", trieur_nom: "Karim", date_tri: "2026-09-14",
    heure_debut: null, heure_fin: null, duree_minutes: null,
    poids_initial_kg: 100, poids_reparti_kg: 100, ecart_kg: 0, nb_balles: 1, nb_balles_ecart: 0,
    qualite_moyenne: 2, fournisseur_ids: ["abc"], fournisseurs_noms: "ABC", updated_at: "",
    balles: [{
        id: "b1", fiche_id: "f1", ordre: 0, fournisseur_id: "abc", fournisseur_nom: "ABC", category_id: "jean",
        poids_initial_kg: 100, qualite: 2, note: null, poids_reparti_kg: 100, ecart_kg: 0,
        repartition: [{ sortie_id: "mag", poids_kg: 100 }],
    }],
} as unknown as FicheTriComplete

const renderSheet = (nav: Parameters<typeof FicheTriDetailSheet>[0]["nav"]) =>
    render(<FicheTriDetailSheet fiche={fiche} onClose={() => {}} onDeleted={() => {}} canDelete={false} nav={nav} />)

test("position affichée ; ‹ › et ← → mènent aux fiches voisines", () => {
    const onPrev = rstest.fn()
    const onNext = rstest.fn()
    renderSheet({ position: 2, total: 5, onPrev, onNext })

    expect(screen.getByText("2 / 5")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Fiche suivante" }))
    expect(onNext).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: "ArrowLeft" })
    expect(onPrev).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: "ArrowRight" })
    expect(onNext).toHaveBeenCalledTimes(2)
})

test("en bout de liste, le bouton est désactivé ; une flèche dans un champ ne navigue pas", () => {
    const onNext = rstest.fn()
    renderSheet({ position: 1, total: 3, onNext })

    expect(screen.getByRole("button", { name: "Fiche précédente" })).toBeDisabled()

    const input = document.createElement("input")
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: "ArrowRight" })
    expect(onNext).not.toHaveBeenCalled()
    input.remove()
})

test("une fiche seule : pas de navigation", () => {
    renderSheet({ position: 1, total: 1 })
    expect(screen.queryByRole("group", { name: "Fiches voisines" })).not.toBeInTheDocument()
})
