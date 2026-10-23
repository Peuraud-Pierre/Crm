import { expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen } from "@testing-library/react"
import type { BalleStatus } from "@/features/stock/types/stock.types"
import BalleCard from "./BalleCard"

/**
 * Filet d'iso-comportement de la carte de balle du stock principal.
 *
 * Cette carte est la RÉFÉRENCE de la convergence : c'est son dessin que le
 * stock handpick adopte, les deux montant sur l'organisme partagé
 * `shared/ui/organisms/bale-card`. Elle ne doit donc pas bouger au passage — et
 * elle n'avait aucun test.
 *
 * À ne pas retoucher pendant le refactor : ajuster ces attentes pour faire
 * passer un changement leur ôterait toute valeur.
 */

const BASE = {
    bin: "BIN-0042",
    weight: 123.456,
    category: "Chemises",
    status: "stocked" as BalleStatus,
    location: "warehouse" as const,
    date: "2026-03-04T10:00:00.000Z",
}

function renderCard(over: Partial<React.ComponentProps<typeof BalleCard>> = {}) {
    return render(<BalleCard {...BASE} {...over} />)
}

test("affiche l'identité, le poids arrondi à deux décimales et son unité", () => {
    renderCard()

    expect(screen.getByText("BIN-0042")).toBeTruthy()
    expect(screen.getByText("123.46")).toBeTruthy()
    expect(screen.getByText("kg")).toBeTruthy()
})

test("affiche la catégorie et la date au format jour/mois", () => {
    renderCard()

    expect(screen.getByText("Chemises")).toBeTruthy()
    expect(screen.getByText("04/03")).toBeTruthy()
    expect(screen.getByText("warehouse")).toBeTruthy()
})

test("le libellé brut n'apparaît que s'il diffère de la catégorie", () => {
    const { unmount } = renderCard({ rawName: "CHEMISES" })
    // Même mot à la casse près : considéré comme un doublon, donc masqué.
    expect(screen.queryByText("CHEMISES")).toBeNull()
    unmount()

    renderCard({ rawName: "Chemises homme été" })
    expect(screen.getByText("Chemises homme été")).toBeTruthy()
})

test("le tiroir Détails est présent, masqué sous lg", () => {
    const { container } = renderCard()

    const footer = container.querySelector(".hidden.lg\\:flex")
    expect(footer).toBeTruthy()
    expect(screen.getByText(/Détails/)).toBeTruthy()
})

test("chaque statut habillé porte sa propre couleur de bordure", () => {
    const skins: Array<[BalleStatus, string]> = [
        ["stocked", "border-chart-1/20"],
        ["shipped", "border-chart-2/20"],
        ["exported", "border-chart-4/20"],
        ["used", "border-chart-5/20"],
        ["transfered", "border-chart-7/20"],
    ]

    for (const [status, expected] of skins) {
        const { container, unmount } = renderCard({ status })
        expect(container.firstElementChild?.className).toContain(expected)
        unmount()
    }
})

test("un statut non habillé retombe sur l'apparence « en stock »", () => {
    const { container } = renderCard({ status: "imported" })

    expect(container.firstElementChild?.className).toContain("border-chart-1/20")
})

test("le clic sur la carte remonte l'ouverture du détail", () => {
    const onClick = rstest.fn()
    const { container } = renderCard({ onClick })

    fireEvent.click(container.firstElementChild as Element)

    expect(onClick).toHaveBeenCalledTimes(1)
})
