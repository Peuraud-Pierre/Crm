import { expect, rstest, test } from "@rstest/core"
import { fireEvent, render, screen, within } from "@testing-library/react"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import { BalleByPlace } from "./BalleByPlace"

/**
 * Inventaire « Par emplacement » : un bloc par rack ou par zone, puis les
 * empruntées et les non rangées ; les raccourcis filtrent d'un clic.
 */

const PATHS: Record<string, string[]> = {
    "b-r2": ["B", "R2", "E1", "H0"],
    "d-sol": ["D", "SOL"],
}
const segmentsFor = (id: string | null | undefined) => (id ? PATHS[id] ?? null : null)
const pathFor = (id: string | null | undefined) => segmentsFor(id)?.join(" · ") ?? null

function balle(id: string, over: Partial<BalleHandpick> = {}): BalleHandpick {
    return {
        id: `${id}-0000-0000`,
        raw_name: `Balle ${id}`,
        packing: 100,
        packing_mode: "kilos",
        status: "stocked",
        emplacement_id: null,
        borrowed_by: null,
        location: null,
        import_date: null,
        category: null,
        ...over,
    } as BalleHandpick
}

const BALLES = [
    balle("aaaa", { emplacement_id: "b-r2" }),
    balle("bbbb", { emplacement_id: "d-sol" }),
    balle("cccc", { location: "reception" }),
]

function renderView(place = "all", onPlaceChange = rstest.fn()) {
    render(
        <BalleByPlace
            balles={BALLES}
            allBalles={BALLES}
            emplacementPath={pathFor}
            segmentsFor={segmentsFor}
            place={place}
            onPlaceChange={onPlaceChange}
            onOpen={rstest.fn()}
        />,
    )
    return onPlaceChange
}

test("un bloc par lieu de stockage, dans l'ordre du plan", () => {
    renderView()

    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)
    expect(headings).toEqual([
        "Zone B · Bags — R2 · Double haut",
        "Zone D · Display",
        "Non rangées — réception",
    ])
})

test("chaque bloc annonce son nombre de balles et son poids", () => {
    renderView()

    const block = screen.getByRole("region", { name: "Zone D · Display" })
    expect(within(block).getByText(/1 balle · 100 kg/)).toBeInTheDocument()
})

test("un raccourci de zone filtre l'inventaire", () => {
    const onPlaceChange = renderView()

    fireEvent.click(screen.getByRole("button", { name: /Zone B/ }))

    expect(onPlaceChange).toHaveBeenCalledWith("B")
})

test("« Voir seulement » filtre sur le bloc, les non rangées ensemble", () => {
    const onPlaceChange = renderView()

    const block = screen.getByRole("region", { name: "Non rangées — réception" })
    fireEvent.click(within(block).getByRole("button", { name: /Voir seulement/ }))

    expect(onPlaceChange).toHaveBeenCalledWith("unplaced")
})

function renderWith(balles: BalleHandpick[]) {
    render(
        <BalleByPlace
            balles={balles}
            allBalles={balles}
            emplacementPath={pathFor}
            segmentsFor={segmentsFor}
            place="all"
            onPlaceChange={rstest.fn()}
            onOpen={rstest.fn()}
        />,
    )
}

/** Le bouton du volet — distinct du raccourci « Éclatées » du haut. */
const eclateesToggle = () =>
    screen
        .getAllByRole("button", { name: /Éclatées/ })
        .find((button) => button.hasAttribute("aria-expanded"))!

const ECLATEE = balle("eeee", {
    status: "eclatee",
    is_eclatee: true,
    eclatee_at: "2026-09-22T10:00:00Z",
    location: "warehouse",
    fournisseur: null,
    fournisseur_label: "Usine supprimée",
})

test("le volet « Éclatées » est fermé par défaut et se déplie", () => {
    try { localStorage.clear() } catch { /* stockage indisponible */ }
    renderWith([...BALLES, ECLATEE])

    const toggle = eclateesToggle()
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("Balle eeee")).toBeNull()

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Balle eeee")).toBeInTheDocument()
})

test("une balle éclatée garde le nom de son usine supprimée", () => {
    try { localStorage.clear() } catch { /* stockage indisponible */ }
    renderWith([ECLATEE])

    fireEvent.click(eclateesToggle())

    expect(screen.getByText(/Usine supprimée/)).toBeInTheDocument()
})
