import { expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"

/**
 * Éclatement d'une balle — ce que la fiche doit garantir : l'action passe
 * par une confirmation (elle est définitive), et une balle éclatée ne
 * propose plus ni emprunt ni nouvel éclatement.
 */

const mocks = rstest.hoisted(() => {
    const eclaterBalle = rstest.fn(async () => true)
    return {
        eclaterBalle,
        useBalleHandpickContext: rstest.fn(() => ({
            emplacementOptions: [],
            emplacementPath: (id: string | null) => (id ? "B · R2 · E3 · H1" : null),
            borrowBalle: rstest.fn(async () => true),
            returnBalle: rstest.fn(),
            eclaterBalle,
            moveBalles: rstest.fn(async () => true),
        })),
        useBalleEmplacementHistory: rstest.fn(() => ({
            events: [],
            userNames: new Map([["u1", "Alice"]]),
            loading: false,
        })),
    }
})

rstest.mock("@/features/stock_handpick/hooks/context/StockHandpickProvider", () => ({
    useBalleHandpickContext: mocks.useBalleHandpickContext,
}))

rstest.mock("@/features/stock_handpick/hooks/data/useBalleEmplacementHistory", () => ({
    useBalleEmplacementHistory: mocks.useBalleEmplacementHistory,
}))

import { BalleEmplacementSection } from "./BalleEmplacementSection"

function balle(over: Partial<BalleHandpick> = {}): BalleHandpick {
    return {
        id: "b1",
        status: "stocked",
        borrowed_by: null,
        borrowed_at: null,
        is_eclatee: false,
        eclatee_at: null,
        eclatee_by: null,
        updated_at: "2026-09-23T10:00:00Z",
        ...over,
    } as BalleHandpick
}

test("éclater demande confirmation puis appelle eclaterBalle", async () => {
    render(<BalleEmplacementSection balle={balle()} canBorrow />)

    fireEvent.click(screen.getByRole("button", { name: /Éclater/ }))
    expect(mocks.eclaterBalle).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Éclater la balle" }))
    await waitFor(() => expect(mocks.eclaterBalle).toHaveBeenCalledWith("b1"))
})

test("une balle éclatée n'offre plus ni emprunt ni éclatement", () => {
    render(
        <BalleEmplacementSection
            balle={balle({
                status: "eclatee",
                is_eclatee: true,
                eclatee_at: "2026-09-22T14:30:00Z",
                eclatee_by: "u1",
            })}
            canBorrow
        />,
    )

    expect(screen.getByText(/Éclatée/)).toBeTruthy()
    expect(screen.getByText(/par Alice/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Emprunter/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Éclater/ })).toBeNull()
})

test("sans droit de modification, pas de bouton Éclater", () => {
    render(<BalleEmplacementSection balle={balle()} canBorrow={false} />)
    expect(screen.queryByRole("button", { name: /Éclater/ })).toBeNull()
})

test("l'avertissement cite l'emplacement quitté et l'emprunt clôturé", () => {
    render(
        <BalleEmplacementSection
            balle={balle({ borrowed_by: "u1", borrowed_at: "2026-09-22T09:00:00Z" })}
            canBorrow
        />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Éclater/ }))

    expect(screen.getByText(/définitive/)).toBeTruthy()
    expect(screen.getByText(/emprunt de Alice sera clôturé/)).toBeTruthy()
})

test("l'avertissement cite l'emplacement que la balle va quitter", () => {
    render(<BalleEmplacementSection balle={balle({ emplacement_id: "e1" })} canBorrow />)
    fireEvent.click(screen.getByRole("button", { name: /Éclater/ }))

    expect(screen.getByText(/B · R2 · E3 · H1/)).toBeTruthy()
})

test("« Déplacer » ouvre la fenêtre de déplacement pour cette balle", () => {
    render(<BalleEmplacementSection balle={balle()} canBorrow />)

    fireEvent.click(screen.getByRole("button", { name: /Déplacer/ }))

    expect(screen.getByRole("heading", { name: "Déplacer cette balle" })).toBeInTheDocument()
})
