import { expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"

/**
 * Page à part des commandes boutiques : son seul travail est de transmettre
 * le segment `detail` de l'URL au board, sous son provider. Le board et ses
 * données sont remplacés ici.
 */

rstest.mock("../hooks/context/CommandeContext", () => ({
    CommandeProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="commande-provider">{children}</div>,
}))
rstest.mock("../components/CommandesBoard", () => ({
    default: ({ detail }: { detail?: string }) => <span data-testid="commandes-detail">{detail ?? "(liste)"}</span>,
}))

import Commandes from "./Commandes"

test("/commandes/{id}?vue=reception transmet le détail (lien des notifications)", () => {
    render(
        <MemoryRouter initialEntries={["/commandes/abc-123?vue=reception"]}>
            <Routes>
                <Route path="/commandes/:detail?" element={<Commandes />} />
            </Routes>
        </MemoryRouter>,
    )
    expect(screen.getByTestId("commande-provider")).toContainElement(screen.getByTestId("commandes-detail"))
    expect(screen.getByTestId("commandes-detail")).toHaveTextContent("abc-123")
})
