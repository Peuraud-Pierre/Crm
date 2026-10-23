import { expect, test } from "@rstest/core"
import type { Emplacement, ZoneNode } from "@/features/stock_handpick/types/location.types"
import { DEFAULT_FLOOR } from "./floorPlan"
import { planStructureSync, type SyncOp } from "./planStructureSync"

/**
 * Le plan ne se relie aux balles que si la base porte les chemins attendus
 * (B · R2 · E3 · H1). Ces cas couvrent les états réels possibles de la base.
 */

let seq = 0
const zone = (code: string, parent: ZoneNode | null, kind: ZoneNode["kind"], label: string | null = null): ZoneNode =>
    ({ id: `z${++seq}`, code, parent_id: parent?.id ?? null, kind, label, sort_order: 0, is_active: true }) as ZoneNode
const leaf = (z: ZoneNode, code: string): Emplacement =>
    ({ id: `e${++seq}`, zone_id: z.id, code, is_active: true }) as Emplacement

/** Structure complète, telle que la créent toutes les migrations. */
function complete() {
    const zones: ZoneNode[] = []
    const emplacements: Emplacement[] = []
    const b = zone("B", null, "zone")
    const a = zone("A", null, "zone")
    const d = zone("D", null, "zone")
    zones.push(b, a, d)
    emplacements.push(leaf(a, "SOL"), leaf(d, "SOL"))
    for (const r of ["R1", "R2", "R3", "R4", "R5"]) {
        const row = zone(r, b, "allee")
        zones.push(row)
        for (const e of ["E1", "E2", "E3", "E4", "E5"]) {
            const shelf = zone(e, row, "etagere")
            zones.push(shelf)
            for (const h of ["H0", "H1", "H2"]) emplacements.push(leaf(shelf, h))
        }
    }
    return { zones, emplacements }
}

const count = (ops: SyncOp[], type: SyncOp["type"]) => ops.filter((op) => op.type === type).length

test("une base complète ne demande rien", () => {
    const { zones, emplacements } = complete()
    const plan = planStructureSync(zones, emplacements, DEFAULT_FLOOR)

    expect(plan.ops).toEqual([])
    expect(plan.missing).toEqual([])
})

test("une base vide reçoit toute la structure du plan", () => {
    const plan = planStructureSync([], [], DEFAULT_FLOOR)

    // 3 zones + 5 rangées + 20 travées (R1 : 4, E4 démontée ; R2, R3 : 5 ;
    // R4, R5 : 3)
    expect(count(plan.ops, "createZone")).toBe(3 + 5 + 20)
    // 16 travées × 3 hauteurs + 4 palettes au sol (R2-R3/E1-E2, H0 seul)
    // + 2 sols
    expect(count(plan.ops, "createEmplacement")).toBe(16 * 3 + 4 + 2)
    expect(plan.missing).toEqual(expect.arrayContaining(["Zone B", "R1", "R2", "R5", "A · SOL", "D · SOL"]))
    expect(plan.needsUpdate).toBe(false)
})

test("les étagères posées directement sous B deviennent la rangée R1, sans être recréées", () => {
    const zones: ZoneNode[] = []
    const emplacements: Emplacement[] = []
    const b = zone("B", null, "zone")
    const a = zone("A", null, "zone")
    const d = zone("D", null, "zone")
    zones.push(b, a, d)
    emplacements.push(leaf(a, "SOL"), leaf(d, "SOL"))
    const shelves = ["E1", "E2", "E3", "E4", "E5"].map((e) => zone(e, b, "etagere"))
    zones.push(...shelves)
    for (const shelf of shelves) for (const h of ["H0", "H1", "H2"]) emplacements.push(leaf(shelf, h))

    const plan = planStructureSync(zones, emplacements, DEFAULT_FLOOR)

    const moves = plan.ops.filter((op) => op.type === "moveZone")
    expect(moves.map((op) => op.type === "moveZone" && op.parentKey)).toEqual(Array(5).fill("B/R1"))
    // R1 est créée une fois, ses travées ne le sont pas.
    const created = plan.ops.filter((op) => op.type === "createZone").map((op) => op.type === "createZone" && op.key)
    expect(created).toContain("B/R1")
    expect(created).not.toContain("B/R1/E1")
    expect(plan.ids.get("B/R1/E3")).toBe(shelves[2].id)
    expect(plan.needsUpdate).toBe(true)
    // R2 à R5 sont créées de toutes pièces.
    expect(created).toEqual(expect.arrayContaining(["B/R2", "B/R3", "B/R4", "B/R5"]))
})

test("avant la séparation du rack double, R4 (vertical) devient R5 et R3 (bas) devient R4", () => {
    const zones: ZoneNode[] = []
    const emplacements: Emplacement[] = []
    const b = zone("B", null, "zone")
    const a = zone("A", null, "zone")
    const d = zone("D", null, "zone")
    zones.push(b, a, d)
    emplacements.push(leaf(a, "SOL"), leaf(d, "SOL"))
    const labels: Record<string, string> = {
        R1: "Rangée du haut",
        R2: "Rangée du milieu",
        R3: "Rangée du bas",
        R4: "Rack vertical",
    }
    for (const [r, label] of Object.entries(labels)) {
        const row = zone(r, b, "allee", label)
        zones.push(row)
        for (const e of ["E1", "E2", "E3", "E4", "E5"]) {
            const shelf = zone(e, row, "etagere")
            zones.push(shelf)
            for (const h of ["H0", "H1", "H2"]) emplacements.push(leaf(shelf, h))
        }
    }
    const vertical = zones.find((z) => z.code === "R4")!
    const bottom = zones.find((z) => z.code === "R3")!

    const plan = planStructureSync(zones, emplacements, DEFAULT_FLOOR)

    const renames = plan.ops.filter((op) => op.type === "renameZone")
    expect(renames).toEqual([
        expect.objectContaining({ zoneId: vertical.id, code: "R5" }),
        expect.objectContaining({ zoneId: bottom.id, code: "R4" }),
    ])
    // Seule la face basse du rack double (nouvelle R3) est à créer.
    const createdRows = plan.ops
        .filter((op) => op.type === "createZone" && op.kind === "allee")
        .map((op) => op.type === "createZone" && op.code)
    expect(createdRows).toEqual(["R3"])
})

test("un rack retiré du plan ne réclame pas sa rangée", () => {
    const { zones, emplacements } = complete()
    const floor = { ...DEFAULT_FLOOR, racks: DEFAULT_FLOOR.racks.filter((r) => r.row !== "R5") }
    const bare = zones.filter((z) => !(z.code === "R5"))

    const plan = planStructureSync(bare, emplacements, floor)

    expect(plan.missing).not.toContain("R5")
})
