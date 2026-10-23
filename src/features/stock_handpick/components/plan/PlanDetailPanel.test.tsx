import { expect, rstest, test } from "@rstest/core"
import { render, screen, within } from "@testing-library/react"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import type { Emplacement, ZoneNode } from "@/features/stock_handpick/types/location.types"
import { buildPlanIndex, shelfLevelKey } from "@/features/stock_handpick/utils/planLayout"
import { PlanDetailPanel } from "./PlanDetailPanel"

/**
 * Plan de l'entrepôt : les emplacements du dessin sont retrouvés par leur
 * chemin de codes, et une étagère se lit de haut (H2) en bas (H0).
 */

const base = {
    label: null, pos_x: null, pos_y: null, width: null, height: null,
    is_active: true, created_at: "", updated_at: "", created_by: null,
}

function zone(id: string, code: string, parent_id: string | null): ZoneNode {
    return {
        ...base, id, code, parent_id,
        kind: parent_id ? "etagere" : "zone",
        rotation: 0, color: null, sort_order: 0,
    }
}

function emplacement(id: string, zone_id: string, code: string): Emplacement {
    return { ...base, id, zone_id, code, capacity: null, notes: null }
}

const zones = [
    zone("zb", "B", null),
    { ...zone("zr2", "R2", "zb"), kind: "allee" as const },
    zone("ze3", "E3", "zr2"),
    zone("za", "A", null),
]
const emplacements = [
    emplacement("h0", "ze3", "H0"),
    emplacement("h2", "ze3", "H2"),
    emplacement("sol", "za", "SOL"),
]
const index = buildPlanIndex(zones, emplacements)

function balle(id: string, emplacement_id: string): BalleHandpick {
    return { id, emplacement_id, raw_name: `Balle ${id}`, packing: 10, packing_mode: "kilos" } as BalleHandpick
}

const byEmplacement: Record<string, BalleHandpick[]> = { h2: [balle("aaaaaaaa-1", "h2")] }
const ballesIn = (ids: readonly (string | undefined)[]) =>
    ids.flatMap((id) => (id ? byEmplacement[id] ?? [] : []))

test("l'index retrouve un emplacement par son chemin, sans tenir compte de la casse", () => {
    expect(index.byPath.get(shelfLevelKey("R2", "E3", "H2"))).toBe("h2")
    expect(index.byPath.get(shelfLevelKey("R1", "E2", "H0"))).toBeUndefined()
    expect(index.byZone.get("B")).toEqual(["h0", "h2"])
    expect(index.byZone.get("A")).toEqual(["sol"])
})

test("une étagère se lit de H2 à H0, et signale une hauteur absente de la base", () => {
    render(
        <PlanDetailPanel
            selection={{ kind: "shelf", row: "R2", shelf: "E3" }}
            index={index}
            ballesIn={ballesIn}
            pathFor={() => null}
            onClose={rstest.fn()}
            onOpenBalle={rstest.fn()}
        />,
    )

    const rows = screen.getAllByRole("listitem")
    expect(rows.map((row) => row.textContent?.slice(0, 2))).toEqual(["H2", "H1", "H0"])
    expect(within(rows[0]).getByText("Balle aaaaaaaa-1")).toBeInTheDocument()
    expect(within(rows[1]).getByText("Emplacement non créé")).toBeInTheDocument()
    expect(within(rows[2]).getByText("Vide")).toBeInTheDocument()
})

test("cliquer une balle ouvre sa fiche", () => {
    const onOpenBalle = rstest.fn()
    render(
        <PlanDetailPanel
            selection={{ kind: "shelf", row: "R2", shelf: "E3" }}
            index={index}
            ballesIn={ballesIn}
            pathFor={() => null}
            onClose={rstest.fn()}
            onOpenBalle={onOpenBalle}
        />,
    )

    screen.getByRole("button", { name: /Balle aaaaaaaa-1/ }).click()

    expect(onOpenBalle).toHaveBeenCalledWith("aaaaaaaa-1")
})

test("une palette au sol (R2/E1) n'a que la hauteur H0", () => {
    render(
        <PlanDetailPanel
            selection={{ kind: "shelf", row: "R2", shelf: "E1" }}
            index={index}
            ballesIn={ballesIn}
            pathFor={() => null}
            onClose={rstest.fn()}
            onOpenBalle={rstest.fn()}
        />,
    )

    const rows = screen.getAllByRole("listitem")
    expect(rows.map((row) => row.textContent?.slice(0, 2))).toEqual(["H0"])
})
