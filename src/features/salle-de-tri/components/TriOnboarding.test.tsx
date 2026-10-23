import { expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen } from "@testing-library/react"
import { TriOnboarding } from "./TriOnboarding"

/**
 * Premier lancement : les étapes à préparer, dans l'ordre. La saisie d'une
 * fiche n'est proposée qu'une fois types et trieurs en place.
 */

test("référentiel vide : on renvoie vers les types, pas de saisie possible", () => {
    const onReferentiel = rstest.fn()
    render(<TriOnboarding sortiesActives={0} trieursActifs={0} onReferentiel={onReferentiel} onCreate={() => {}} />)

    expect(screen.getAllByLabelText("À faire")).toHaveLength(3)
    expect(screen.queryByRole("button", { name: /Nouvelle fiche/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Ajouter les types/ }))
    expect(onReferentiel).toHaveBeenCalled()
})

test("types en place, trieurs manquants : l'étape faite est cochée", () => {
    render(<TriOnboarding sortiesActives={4} trieursActifs={0} onReferentiel={() => {}} onCreate={() => {}} />)

    expect(screen.getByLabelText("Fait")).toBeInTheDocument()
    expect(screen.getByText(/4 types actifs/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Ajouter les types/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Ajouter les trieurs/ })).toBeInTheDocument()
})

test("tout est prêt : la première fiche se saisit, si on en a le droit", () => {
    const onCreate = rstest.fn()
    const { rerender } = render(<TriOnboarding sortiesActives={4} trieursActifs={2} onReferentiel={() => {}} onCreate={onCreate} />)

    fireEvent.click(screen.getByRole("button", { name: /Nouvelle fiche/ }))
    expect(onCreate).toHaveBeenCalled()

    rerender(<TriOnboarding sortiesActives={4} trieursActifs={2} onReferentiel={() => {}} />)
    expect(screen.queryByRole("button", { name: /Nouvelle fiche/ })).not.toBeInTheDocument()
})
