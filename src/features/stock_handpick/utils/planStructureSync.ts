import type { Emplacement, ZoneKind, ZoneNode } from "@/features/stock_handpick/types/location.types"
import type { FloorLayout } from "./floorPlan"
import { PLAN_ROW_LABELS, isPlanShelf, PLAN_ZONES, rowBays, shelfLevels, type PlanRow, type PlanZoneCode } from "./planLayout"

/**
 * Relie le plan dessiné aux emplacements en base.
 *
 * Le plan (2D, 3D) et l'inventaire retrouvent une case par son chemin de
 * codes : `B · R2 · E3 · H1`. Si la base ne porte pas ce chemin — migrations
 * du plan non appliquées, ou appliquées en partie —, rien ne se relie : le
 * rack s'affiche vide et l'inventaire ne propose pas la rangée.
 *
 * Ce module compare les racks adressables du plan à l'arbre réel et en déduit
 * les opérations à faire. Il rattrape aussi les états intermédiaires des
 * migrations :
 *  • étagères E1…E5 posées directement sous B (avant les rangées) → elles
 *    deviennent la rangée R1, avec leurs balles ;
 *  • rangées R1…R4 où R4 est le rack vertical et R3 le rack du bas (avant la
 *    séparation du rack double) → R4 devient R5, R3 devient R4.
 *
 * Fonction PURE : l'exécution est faite par `usePlanStructureSync`.
 */

export type SyncOp =
    | { type: "createZone"; key: string; parentKey: string | null; kind: ZoneKind; code: string; label: string; sort: number }
    | { type: "moveZone"; zoneId: string; key: string; parentKey: string }
    | { type: "renameZone"; zoneId: string; key: string; code: string; label: string; sort: number }
    | { type: "createEmplacement"; parentKey: string; code: string; label: string }

export interface SyncPlan {
    ops: SyncOp[]
    /** Clé de chemin (après opérations) → id, pour les zones déjà en base. */
    ids: Map<string, string>
    /** Ce qui manque, en clair : « R1 », « A · SOL »… */
    missing: string[]
    /** Vrai si le plan déplace ou renomme des zones (droit de modification). */
    needsUpdate: boolean
}

const up = (value: string) => value.trim().toUpperCase()
const SHELF_RE = /^E\d+$/

/** Chemin de codes (en majuscules) de chaque zone, depuis la racine. */
function zonePaths(zones: ZoneNode[]): Map<string, string> {
    const byId = new Map(zones.map((z) => [z.id, z]))
    const paths = new Map<string, string>()
    for (const zone of zones) {
        const parts: string[] = []
        let current: ZoneNode | undefined = zone
        const seen = new Set<string>()
        while (current && !seen.has(current.id)) {
            seen.add(current.id)
            parts.unshift(up(current.code))
            current = current.parent_id ? byId.get(current.parent_id) : undefined
        }
        paths.set(zone.id, parts.join("/"))
    }
    return paths
}

export function planStructureSync(
    zones: ZoneNode[],
    emplacements: Emplacement[],
    layout: FloorLayout,
): SyncPlan {
    const paths = zonePaths(zones)
    const byId = new Map(zones.map((z) => [z.id, z]))

    // Arbre simulé : clé de chemin → id (zones existantes), et emplacements
    // existants par clé de zone.
    const ids = new Map<string, string>()
    for (const [id, path] of paths) ids.set(path, id)
    const leaves = new Set<string>(
        emplacements
            .filter((e) => paths.has(e.zone_id))
            .map((e) => `${paths.get(e.zone_id)}/${up(e.code)}`),
    )

    const ops: SyncOp[] = []
    const missing: string[] = []
    let needsUpdate = false

    /** Renomme une clé et toute sa descendance dans l'arbre simulé. */
    const rekey = (from: string, to: string) => {
        for (const [key, id] of [...ids]) {
            if (key === from || key.startsWith(`${from}/`)) {
                ids.delete(key)
                ids.set(to + key.slice(from.length), id)
            }
        }
        for (const leaf of [...leaves]) {
            if (leaf.startsWith(`${from}/`)) {
                leaves.delete(leaf)
                leaves.add(to + leaf.slice(from.length))
            }
        }
    }

    const ensureZone = (key: string, parentKey: string | null, kind: ZoneKind, code: string, label: string, sort: number) => {
        if (ids.has(key)) return
        ops.push({ type: "createZone", key, parentKey, kind, code, label, sort })
        ids.set(key, "")
    }

    const ensureLeaf = (parentKey: string, code: string, label: string, report: string) => {
        const key = `${parentKey}/${code}`
        if (leaves.has(key)) return
        ops.push({ type: "createEmplacement", parentKey, code, label })
        leaves.add(key)
        if (!missing.includes(report)) missing.push(report)
    }

    // 1. Zones racines.
    for (const [code, sort] of [["B", 0], ["A", 1], ["D", 2]] as const) {
        if (!ids.has(code)) missing.push(`Zone ${code}`)
        ensureZone(code, null, "zone", code, PLAN_ZONES[code as PlanZoneCode].label, sort)
    }

    const rows = [...new Set(layout.racks.map((r) => r.row).filter((r): r is PlanRow => r !== null))].sort(
        (a, b) => a.localeCompare(b, "fr", { numeric: true }),
    )
    const childrenOfB = zones.filter((z) => paths.get(z.id) === `B/${up(z.code)}`)

    // 2. Rattrapage : étagères directement sous B → rangée R1.
    const looseShelves = childrenOfB.filter((z) => z.kind === "etagere" && SHELF_RE.test(up(z.code)))
    if (looseShelves.length > 0 && !ids.has("B/R1") && rows.includes("R1")) {
        ensureZone("B/R1", "B", "allee", "R1", `Rack R1 — ${PLAN_ROW_LABELS.R1}`, 1)
        missing.push("R1 (étagères à rattacher)")
        for (const shelf of looseShelves) {
            const from = `B/${up(shelf.code)}`
            const to = `B/R1/${up(shelf.code)}`
            ops.push({ type: "moveZone", zoneId: shelf.id, key: to, parentKey: "B/R1" })
            rekey(from, to)
            needsUpdate = true
        }
    }

    // 3. Rattrapage : rack vertical encore en R4, rack du bas en R3.
    const rowZone = (code: string) => {
        const id = ids.get(`B/${code}`)
        return id ? byId.get(id) : undefined
    }
    const r4 = rowZone("R4")
    if (rows.includes("R5") && !ids.has("B/R5") && r4 && /vertical/i.test(r4.label ?? "")) {
        ops.push({ type: "renameZone", zoneId: r4.id, key: "B/R5", code: "R5", label: `Rack R5 — ${PLAN_ROW_LABELS.R5}`, sort: 5 })
        rekey("B/R4", "B/R5")
        needsUpdate = true
        missing.push("R5 (rack vertical à renuméroter)")
        const r3 = rowZone("R3")
        if (r3 && /bas/i.test(r3.label ?? "") && !/double/i.test(r3.label ?? "")) {
            ops.push({ type: "renameZone", zoneId: r3.id, key: "B/R4", code: "R4", label: `Rack R4 — ${PLAN_ROW_LABELS.R4}`, sort: 4 })
            rekey("B/R3", "B/R4")
        }
    }

    // 4. Rangées, travées et hauteurs des racks adressables.
    for (const row of rows) {
        const rowKey = `B/${row}`
        if (!ids.has(rowKey)) missing.push(row)
        ensureZone(rowKey, "B", "allee", row, `Rack ${row} — ${PLAN_ROW_LABELS[row]}`, Number(row.slice(1)))
        // Une travée démontée (R1/E4) ou retirée (R4-R5/E4-E5) n'est pas
        // recréée, ni les hauteurs d'une palette au sol (R2-R3/E1-E2).
        for (const [i, shelf] of rowBays(row).entries()) {
            if (!isPlanShelf(row, shelf)) continue
            const shelfKey = `${rowKey}/${shelf}`
            ensureZone(shelfKey, rowKey, "etagere", shelf, `Travée ${i + 1}`, i + 1)
            for (const level of shelfLevels(row, shelf)) {
                ensureLeaf(shelfKey, level, `Hauteur ${level.slice(1)}`, row)
            }
        }
    }

    // 5. Sol des zones sans rack.
    for (const zone of ["A", "D"] as const) {
        ensureLeaf(zone, "SOL", "Au sol", `${zone} · SOL`)
    }

    // Ids des zones existantes seulement (les créées sont résolues à l'exécution).
    for (const [key, id] of [...ids]) if (!id) ids.delete(key)

    return { ops, ids, missing, needsUpdate }
}
