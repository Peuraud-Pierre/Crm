import { expect, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import type { BalleEmplacementEvent } from "@/features/stock_handpick/types/balle.types"
import { BalleEmplacementHistory } from "./BalleEmplacementHistory"

/**
 * Historique d'emplacement d'une balle. On vérifie le libellé de chaque
 * mouvement, et que le chemin actuel d'un emplacement prime sur l'instantané,
 * qui ne sert que si l'emplacement a disparu.
 */

function event(over: Partial<BalleEmplacementEvent> = {}): BalleEmplacementEvent {
    return {
        id: "e1",
        balle_id: "b1",
        event: "moved",
        emplacement_from_id: "p1",
        emplacement_to_id: "p2",
        from_path: "B1 · E1 · H1",
        to_path: "B1 · E2 · H2",
        user_id: "u1",
        created_at: "2026-09-17T10:00:00.000Z",
        ...over,
    }
}

const livePaths: Record<string, string> = { p2: "B1 · E2 · H2-renommé" }
const pathOf = (id: string | null | undefined) => (id ? livePaths[id] ?? null : null)

const renderHistory = (events: BalleEmplacementEvent[], loading = false) =>
    render(
        <BalleEmplacementHistory
            events={events}
            userNames={new Map([["u1", "Alice"]])}
            loading={loading}
            emplacementPath={pathOf}
        />,
    )

test("sans mouvement, l'état vide est explicite", () => {
    renderHistory([])

    expect(screen.getByText("Aucun mouvement enregistré")).toBeInTheDocument()
})

test("un déplacement affiche son libellé, son trajet et son auteur", () => {
    renderHistory([event()])

    expect(screen.getByText("Déplacée")).toBeInTheDocument()
    expect(screen.getByText(/Alice/)).toBeInTheDocument()
})

test("le chemin actuel prime, l'instantané prend le relais d'un emplacement disparu", () => {
    renderHistory([event()])

    // p2 existe encore : son nom du jour.
    expect(screen.getByText("B1 · E2 · H2-renommé")).toBeInTheDocument()
    // p1 a disparu : l'instantané.
    expect(screen.getByText("B1 · E1 · H1")).toBeInTheDocument()
})

test("un emprunt n'a pas de destination", () => {
    renderHistory([
        event({ event: "borrowed", emplacement_to_id: null, to_path: null }),
    ])

    expect(screen.getByText("Empruntée")).toBeInTheDocument()
    expect(screen.getByText("B1 · E1 · H1")).toBeInTheDocument()
    expect(screen.getByText("1 mouvement")).toBeInTheDocument()
})
