import { expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { newBalle, type BalleDraft } from "@/features/salle-de-tri/utils/triDraft"

/**
 * Saisie d'une feuille de tri au clavier : `Entrée` avance de champ en champ
 * dans une balle et en ouvre une nouvelle depuis la note de la dernière ;
 * la jauge dit ce qu'il reste à répartir, sans jamais bloquer.
 */

const mocks = rstest.hoisted(() => ({
    useReferentialContext: rstest.fn(() => ({
        categories: [{ id: "pant", name: "Pantalons", tag: "PANT", unit_price: 0, unit_weight: 0 }],
        fournisseurs: [{ id: "abc", name: "ABC" }],
    })),
    useTriContext: rstest.fn(() => ({
        sorties: [
            { id: "mag", code: "MAG", libelle: "Magasin", ordre: 1, actif: true, created_at: "" },
            { id: "ks", code: "KS", libelle: "Kilo shop", ordre: 2, actif: true, created_at: "" },
            { id: "old", code: "OLD", libelle: "Ancien", ordre: 3, actif: false, created_at: "" },
        ],
    })),
}))

rstest.mock("@/features/stock", () => ({ useReferentialContext: mocks.useReferentialContext }))
rstest.mock("@/features/salle-de-tri/hooks/context/TriContext", () => ({ useTriContext: mocks.useTriContext }))

import { FicheTriBallesEditor } from "./FicheTriBallesEditor"

let last: BalleDraft[] = []

function Harness({ initial }: { initial: BalleDraft[] }) {
    const [balles, setBalles] = useState(initial)
    last = balles
    return <FicheTriBallesEditor balles={balles} setBalles={setBalles} showErrors={false} />
}

test("une colonne de répartition par type ACTIF ; Entrée avance poids → MAG → KS → note", () => {
    render(<Harness initial={[{ ...newBalle(), category_id: "pant" }]} />)

    expect(screen.queryByLabelText("OLD balle 1 (kg)")).not.toBeInTheDocument()
    const poids = screen.getByLabelText("Poids initial balle 1 (kg)")
    fireEvent.keyDown(poids, { key: "Enter" })
    expect(screen.getByLabelText("MAG balle 1 (kg)")).toHaveFocus()
    fireEvent.keyDown(screen.getByLabelText("MAG balle 1 (kg)"), { key: "Enter" })
    expect(screen.getByLabelText("KS balle 1 (kg)")).toHaveFocus()
    fireEvent.keyDown(screen.getByLabelText("KS balle 1 (kg)"), { key: "Enter" })
    expect(screen.getByLabelText("Note balle 1")).toHaveFocus()
})

test("Entrée dans la note de la dernière balle en ouvre une, qui reprend fournisseur et catégorie, curseur sur son poids", () => {
    render(<Harness initial={[{ ...newBalle(), fournisseur_id: "abc", category_id: "pant", poids: "100" }]} />)

    fireEvent.keyDown(screen.getByLabelText("Note balle 1"), { key: "Enter" })

    expect(last).toHaveLength(2)
    expect(last[1]).toMatchObject({ fournisseur_id: "abc", category_id: "pant", poids: "", qualite: null, repartition: {} })
    expect(screen.getByLabelText("Poids initial balle 2 (kg)")).toHaveFocus()
})

test("la jauge signale ce qui manque, puis l'équilibre", () => {
    render(<Harness initial={[{ ...newBalle(), category_id: "pant", poids: "100" }]} />)

    fireEvent.change(screen.getByLabelText("MAG balle 1 (kg)"), { target: { value: "60" } })
    fireEvent.change(screen.getByLabelText("KS balle 1 (kg)"), { target: { value: "36" } })
    expect(screen.getByText(/Il manque 4\skg/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("KS balle 1 (kg)"), { target: { value: "40" } })
    expect(screen.getByText("Tout est réparti")).toBeInTheDocument()
    expect(last[0].repartition).toEqual({ mag: "60", ks: "40" })
})

test("retirer la dernière balle en laisse une vide plutôt qu'aucune", () => {
    render(<Harness initial={[{ ...newBalle(), category_id: "pant", poids: "5" }]} />)

    fireEvent.click(screen.getByRole("button", { name: "Retirer la balle 1" }))

    expect(last).toHaveLength(1)
    expect(last[0]).toMatchObject({ fournisseur_id: "", category_id: "", poids: "" })
})
