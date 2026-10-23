import { expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"

/**
 * Liste de colisage — le droit qui ouvre la saisie.
 *
 * Ajouter une ligne est une CRÉATION : la RLS d'insertion de
 * `mouvements_handpick` exige `stock_handpick.flux.create`. Le bouton était
 * gaté sur `update`, si bien qu'il était proposé à des comptes que la base
 * refusait, et caché à ceux qu'elle acceptait.
 */

const mocks = rstest.hoisted(() => ({ lignes: rstest.fn(), referential: rstest.fn() }))

rstest.mock("@/features/stock_handpick/hooks/data/useMouvementHandpick", () => ({
    useLignesHandpick: mocks.lignes,
}))
rstest.mock("@/features/stock_handpick/hooks/context/StockHandpickProvider", () => ({
    useReferentialHandpickContext: mocks.referential,
}))
// La ligne de saisie a ses propres dépendances (recherche de balles) : elle
// n'apprend rien sur le gating du panneau.
rstest.mock("./LigneDraftRow", () => ({
    LigneDraftRow: () => <div data-testid="draft" />,
}))

import { LignesPanel } from "./LignesPanel"

mocks.referential.mockReturnValue({ categories: [] })
mocks.lignes.mockReturnValue({
    lignes: [],
    loading: false,
    addLigne: rstest.fn(),
    removeLigne: rstest.fn(),
})

test("avec le droit de création, l'ajout de ligne est proposé", () => {
    render(<LignesPanel fluxId="f1" canCreate canDelete={false} />)

    expect(screen.getByRole("button", { name: "Ajouter" })).toBeInTheDocument()
})

test("sans le droit de création, aucun ajout — même avec le droit de suppression", () => {
    render(<LignesPanel fluxId="f1" canCreate={false} canDelete />)

    expect(screen.queryByRole("button", { name: "Ajouter" })).not.toBeInTheDocument()
})
