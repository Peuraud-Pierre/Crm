import { expect, test } from "@rstest/core"
import type { Emplacement, ZoneNode } from "@/features/stock_handpick/types/location.types"
import { groupEmplacementsForCodes, rackGrid } from "./emplacementGroups"

/** Liste de sélection de l'onglet Codes : un groupe par rack, actifs seulement. */

const base = {
    label: null, pos_x: null, pos_y: null, width: null, height: null,
    is_active: true, created_at: "", updated_at: "", created_by: null,
}
const zone = (id: string, code: string, parent_id: string | null): ZoneNode => ({
    ...base, id, code, parent_id, kind: parent_id ? "etagere" : "zone",
    rotation: 0, color: null, sort_order: 0,
})
const emp = (id: string, zone_id: string, code: string, is_active = true): Emplacement => ({
    ...base, id, zone_id, code, is_active, capacity: null, notes: null,
})

const zones = [
    zone("b", "B", null), zone("a", "A", null),
    zone("r10", "R10", "b"), zone("r2", "R2", "b"),
    zone("r2e3", "E3", "r2"), zone("r2e1", "E1", "r2"), zone("r10e1", "E1", "r10"),
]
const emplacements = [
    emp("sol", "a", "SOL"),
    emp("r2e3h1", "r2e3", "H1"), emp("r2e3h0", "r2e3", "H0"),
    emp("r2e1h0", "r2e1", "H0"), emp("r2e1h1", "r2e1", "H1", false),
    emp("r10e1h0", "r10e1", "H0"),
]

test("un groupe par rack, tri numérique, zones sans rack à part", () => {
    const groups = groupEmplacementsForCodes(zones, emplacements)
    expect(groups.map((g) => g.label)).toEqual(["A", "B · R2", "B · R10"])
    expect(groups[1].items.map((i) => i.path)).toEqual([
        "B · R2 · E1 · H0", "B · R2 · E3 · H0", "B · R2 · E3 · H1",
    ])
})

test("les emplacements désactivés ne sont pas proposés", () => {
    const ids = groupEmplacementsForCodes(zones, emplacements).flatMap((g) => g.items.map((i) => i.id))
    expect(ids).not.toContain("r2e1h1")
})

test("chaque item porte le libellé de sa zone", () => {
    const [a, r2] = groupEmplacementsForCodes(zones, emplacements)
    expect(a.items[0]).toEqual({ id: "sol", path: "A · SOL", segments: ["A", "SOL"], zoneLabel: "Annexe" })
    expect(r2.items[0].zoneLabel).toBe("Bags")
})

test("un rack porte le surnom de sa rangée, une zone sans rack son nom", () => {
    const [a, r2] = groupEmplacementsForCodes(zones, emplacements)
    expect(a.subtitle).toBe("Annexe")
    expect(r2.subtitle).toBe("Double haut")
})

test("la grille d'un rack : travées en colonnes, hauteurs de haut en bas", () => {
    const r2 = groupEmplacementsForCodes(zones, emplacements)[1]
    const grid = rackGrid(r2)
    expect(grid?.bays).toEqual(["E1", "E3"])
    expect(grid?.levels).toEqual(["H1", "H0"])
    expect(grid?.cells.get("E3/H1")?.id).toBe("r2e3h1")
    // E1/H1 est désactivé : pas de case.
    expect(grid?.cells.get("E1/H1")).toBeUndefined()
})

test("une zone sans rack n'a pas de grille", () => {
    const a = groupEmplacementsForCodes(zones, emplacements)[0]
    expect(rackGrid(a)).toBeNull()
})
