import { expect, test } from "@rstest/core"
import { render, screen } from "@testing-library/react"
import { legProgress } from "@/shared/lib/shipment"
import { ShipmentInvoiceNotice, ShipmentTimeline } from "./shipment-timeline"

/**
 * Frise d'acheminement — ce qu'elle doit garantir.
 *
 * Elle est partagée par les deux modules de stock, qui n'ont pas le même
 * nombre d'escales : le stock principal saisit une arrivée au port, le handpick
 * ne la saisit plus. La frise ne doit donc rien présumer du trajet.
 *
 * Ce qui compte fonctionnellement : le terminus porte l'échéance en toutes
 * lettres — c'est ce qu'une date brute ne dit pas — une étape non renseignée
 * reste visible plutôt que d'être escamotée, sans quoi le trajet paraîtrait
 * plus court qu'il ne l'est, et la position du véhicule est une DONNÉE, donc
 * testable.
 */

/** Déchargement à N jours, pour piloter l'échéance. */
function daysAhead(n: number): string {
    return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString()
}

test("chaque étape du trajet est rendue, dans l'ordre", () => {
    render(
        <ShipmentTimeline
            stops={[
                { label: "Départ", date: "2026-01-05", vehicle: "ship" },
                { label: "Arrivée au port", date: "2026-01-12", vehicle: "truck" },
            ]}
            arrival={{ label: "Déchargement", at: daysAhead(3) }}
            tone="upcoming"
        />,
    )

    const labels = screen.getAllByRole("listitem").map((li) => li.textContent)
    expect(labels[0]).toContain("Départ")
    expect(labels[1]).toContain("Arrivée au port")
    expect(labels[2]).toContain("Déchargement")
})

test("une étape non renseignée reste visible, marquée d'une croix", () => {
    // L'escamoter raccourcirait le trajet : le stock principal saisit parfois
    // l'arrivée au port, parfois non. L'absence est une information.
    render(
        <ShipmentTimeline
            stops={[{ label: "Arrivée au port", date: null, vehicle: "truck" }]}
            arrival={{ label: "Déchargement", at: null }}
            tone="neutral"
        />,
    )

    expect(screen.getByText("Arrivée au port")).toBeInTheDocument()
    expect(screen.getAllByLabelText("Date manquante").length).toBeGreaterThan(0)
})

test("le terminus porte l'échéance en toutes lettres", () => {
    // Le tableau signale les prochaines expéditions par leur RANG ; une fiche
    // ouverte seule n'a pas ce classement, la date seule n'apprend rien.
    render(
        <ShipmentTimeline
            stops={[]}
            arrival={{ label: "Déchargement", at: daysAhead(3) }}
            tone="upcoming"
        />,
    )

    expect(screen.getByText("dans 3 jours")).toBeInTheDocument()
})

test("un déchargement dépassé est compté à rebours, pas masqué", () => {
    render(
        <ShipmentTimeline
            stops={[]}
            arrival={{ label: "Déchargement", at: daysAhead(-4) }}
            tone="neutral"
        />,
    )

    expect(screen.getByText("il y a 4 jours")).toBeInTheDocument()
})

test("sans date de déchargement, le terminus le dit", () => {
    render(
        <ShipmentTimeline
            stops={[]}
            arrival={{ label: "Déchargement", at: null }}
            tone="neutral"
        />,
    )

    expect(screen.getByText("Non planifié")).toBeInTheDocument()
})

// ─── Bloc de facturation ──────────────────────────────────────────────────────

test("facturé : le numéro et la date sont réunis", () => {
    render(
        <ShipmentInvoiceNotice
            invoiceNo="FA-2026-001"
            invoiceDate="2026-01-10"
            alert={false}
        />,
    )

    expect(screen.getByText("Facturé")).toBeInTheDocument()
    expect(screen.getByText("FA-2026-001 · 10/01/26")).toBeInTheDocument()
})

test("sans numéro de facture, la date suffit", () => {
    // Le stock principal ne saisit pas de numéro : le séparateur ne doit pas
    // rester orphelin.
    render(<ShipmentInvoiceNotice invoiceDate="2026-01-10" alert={false} />)

    expect(screen.getByText("10/01/26")).toBeInTheDocument()
})

test("alerte : l'échéance justifie l'urgence", () => {
    render(
        <ShipmentInvoiceNotice invoiceDate={null} alert countdownLabel="dans 3 jours" />,
    )

    expect(screen.getByText("Facture manquante")).toBeInTheDocument()
    expect(screen.getByText(/Déchargement dans 3 jours/)).toBeInTheDocument()
})

test("non facturé sans urgence n'est pas présenté comme une alerte", () => {
    render(<ShipmentInvoiceNotice invoiceDate={null} alert={false} />)

    expect(screen.getByText("Non facturé")).toBeInTheDocument()
    expect(screen.queryByText("Facture manquante")).not.toBeInTheDocument()
})

// ─── Progression du véhicule ──────────────────────────────────────────────────

/**
 * `legProgress` est le calcul dont dépend la position du véhicule. Le tester
 * directement plutôt qu'à travers le DOM : une position est un nombre, pas une
 * classe CSS.
 */

const JAN_01 = new Date("2026-01-01T00:00").getTime()
const JAN_11 = new Date("2026-01-11T00:00").getTime()
const JAN_21 = new Date("2026-01-21T00:00").getTime()

test("à mi-parcours, le trajet est à la moitié", () => {
    const { state, ratio } = legProgress("2026-01-01", "2026-01-21", JAN_11)

    expect(state).toBe("moving")
    expect(ratio).toBeCloseTo(0.5, 5)
})

test("avant le départ, le véhicule reste au point de départ", () => {
    const { state, ratio } = legProgress("2026-01-11", "2026-01-21", JAN_01)

    expect(state).toBe("pending")
    expect(ratio).toBe(0)
})

test("après l'arrivée, le trajet est plein — la position ne dépasse jamais", () => {
    const { state, ratio } = legProgress("2026-01-01", "2026-01-11", JAN_21)

    expect(state).toBe("done")
    expect(ratio).toBe(1)
})

test("une borne manquante ne produit aucune position", () => {
    // Mieux vaut un segment en pointillés qu'un véhicule placé au hasard.
    expect(legProgress(null, "2026-01-21", JAN_11).state).toBe("unknown")
    expect(legProgress("2026-01-01", null, JAN_11).state).toBe("unknown")
})

test("des dates inversées ne renvoient pas de ratio hors bornes", () => {
    const { state, ratio } = legProgress("2026-01-21", "2026-01-01", JAN_11)

    expect(state).toBe("done")
    expect(ratio).toBe(1)
})

test("le tangage ne tourne que sur le segment en cours", () => {
    // Un trajet fini ou pas commencé reste immobile : sinon le mouvement ne
    // signifierait plus rien.
    const { container } = render(
        <ShipmentTimeline
            stops={[
                { label: "Départ", date: "2026-01-01", vehicle: "ship" },
                { label: "Arrivée au port", date: "2026-01-21", vehicle: "truck" },
            ]}
            arrival={{ label: "Déchargement", at: "2026-02-01" }}
            tone="upcoming"
            now={JAN_11}
        />,
    )

    // Premier segment en cours, second pas commencé.
    expect(container.querySelectorAll(".animate-ship-bob")).toHaveLength(1)
    expect(container.querySelectorAll(".animate-truck-rumble")).toHaveLength(0)
})
