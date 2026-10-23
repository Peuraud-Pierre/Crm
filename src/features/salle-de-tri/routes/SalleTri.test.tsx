import { expect, rstest, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"

/**
 * Page à part de la salle de tri : son seul travail est de transmettre le
 * segment `detail` de l'URL au board, sous son provider. Le board et ses
 * données sont remplacés ici.
 */

rstest.mock("../hooks/context/TriContext", () => ({
    TriProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="tri-provider">{children}</div>,
}))
rstest.mock("../components/TriBoard", () => ({
    default: ({ detail }: { detail?: string }) => <span data-testid="tri-detail">{detail ?? "(liste)"}</span>,
}))

import SalleTri from "./SalleTri"

const at = (path: string) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/salle-de-tri/:detail?" element={<SalleTri />} />
            </Routes>
        </MemoryRouter>,
    )

test("/salle-de-tri : la liste, sous son provider", () => {
    at("/salle-de-tri")
    expect(screen.getByTestId("tri-provider")).toContainElement(screen.getByTestId("tri-detail"))
    expect(screen.getByTestId("tri-detail")).toHaveTextContent("(liste)")
})

test("/salle-de-tri/new et /salle-de-tri/{id} transmettent le détail", () => {
    at("/salle-de-tri/new")
    expect(screen.getByTestId("tri-detail")).toHaveTextContent("new")
})
