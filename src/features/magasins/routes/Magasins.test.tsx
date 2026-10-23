import { beforeEach, expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"

const mocks = rstest.hoisted(() => {
    const state = { data: { magasins: [] as { id: string; nom: string }[], loading: false } }
    return {
        state,
        useAuth: rstest.fn(() => ({ hasPermission: () => true })),
        useMagasins: rstest.fn(() => state.data),
    }
})

rstest.mock("@/features/auth/hooks/useAuth/AuthProvider", () => ({
    useAuth: mocks.useAuth,
}))
rstest.mock("@/features/magasins/hooks/data/useMagasins", () => ({
    useMagasins: mocks.useMagasins,
}))
// On n'observe ici que l'aiguillage par l'URL.
rstest.mock("@/features/magasins/components/list/MagasinsBoard", () => ({
    MagasinsBoard: () => <div data-testid="board" />,
}))
rstest.mock("@/features/magasins/components/detail/MagasinDetail", () => ({
    MagasinDetail: ({ magasin, section }: { magasin: { nom: string }; section: string }) => (
        <div data-testid="detail">
            {magasin.nom}/{section}
        </div>
    ),
}))

import Magasins from "./Magasins"

function LocationProbe() {
    return <span data-testid="path">{useLocation().pathname}</span>
}

function renderAt(path: string) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <LocationProbe />
            <Routes>
                <Route path="/magasins/:magasinId?/:section?" element={<Magasins />} />
            </Routes>
        </MemoryRouter>,
    )
}

beforeEach(() => {
    mocks.state.data = { magasins: [{ id: "m1", nom: "Marais" }], loading: false }
})

test("/magasins affiche la liste", () => {
    renderAt("/magasins")
    expect(screen.getByTestId("board")).toBeInTheDocument()
})

test("/magasins/<id> est réécrit vers l'onglet Plan", () => {
    renderAt("/magasins/m1")
    expect(screen.getByTestId("path").textContent).toBe("/magasins/m1/plan")
    expect(screen.getByTestId("detail")).toHaveTextContent("Marais/plan")
})

test("une section inconnue retombe sur Plan, une section connue est servie", () => {
    renderAt("/magasins/m1/inconnu")
    expect(screen.getByTestId("path").textContent).toBe("/magasins/m1/plan")

    const details = () => screen.getAllByTestId("detail")
    renderAt("/magasins/m1/emplacements")
    expect(details()[details().length - 1]).toHaveTextContent("Marais/emplacements")
})

test("un magasin absent de la liste est annoncé", () => {
    renderAt("/magasins/inconnu/plan")
    expect(screen.getByText("Magasin introuvable")).toBeInTheDocument()
})
