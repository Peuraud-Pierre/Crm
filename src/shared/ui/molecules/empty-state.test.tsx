import { expect, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Search } from "lucide-react"
import { EmptyState } from "./empty-state"

test("rend le titre et la description", () => {
    render(<EmptyState title="Aucun client" description="Crée le premier." />)
    expect(screen.getByText("Aucun client")).toBeTruthy()
    expect(screen.getByText("Crée le premier.")).toBeTruthy()
})

test("déclenche l'action principale et l'action secondaire", async () => {
    const user = userEvent.setup()
    let created = 0
    let reset = 0

    render(
        <EmptyState
            icon={Search}
            title="Aucun résultat"
            action={{ label: "Créer", onClick: () => (created += 1) }}
            secondaryAction={{
                label: "Réinitialiser les filtres",
                onClick: () => (reset += 1),
            }}
        />
    )

    await user.click(screen.getByRole("button", { name: "Créer" }))
    await user.click(
        screen.getByRole("button", { name: "Réinitialiser les filtres" })
    )

    expect(created).toBe(1)
    expect(reset).toBe(1)
})

test("annonce le vide de recherche, pas le vide par défaut", () => {
    // Le vide `search` est le RÉSULTAT d'une saisie : sans région live, un
    // lecteur d'écran ne signale rien. Le vide `default` est présent au
    // chargement et lu normalement — l'annoncer serait du bruit.
    const { unmount } = render(
        <EmptyState variant="search" title="Aucun résultat" />
    )
    expect(screen.getByRole("status")).toBeTruthy()
    unmount()

    render(<EmptyState variant="default" title="Aucun client" />)
    expect(screen.queryByRole("status")).toBeNull()
})
