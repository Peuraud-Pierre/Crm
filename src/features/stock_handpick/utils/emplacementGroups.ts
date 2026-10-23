import { EMPLACEMENT_PATH_SEPARATOR } from "@/features/stock_handpick/constants"
import type { Emplacement, ZoneNode } from "@/features/stock_handpick/types/location.types"
import { buildEmplacementPaths } from "./planHelpers"
import { PLAN_ROW_LABELS, PLAN_ZONES, type PlanRow, type PlanZoneCode } from "./planLayout"

/**
 * Emplacements proposés à l'impression d'étiquettes, groupés par rack
 * (`B · R2`) pour pouvoir cocher un rack entier. Un emplacement désactivé
 * (travée retirée, hauteur d'une palette au sol) n'est jamais proposé.
 */

export interface CodeItem {
    id: string
    /** Chemin affiché : « B · R2 · E3 · H1 ». */
    path: string
    segments: string[]
    /** Nom de la zone racine : « Bags », « Annexe »… */
    zoneLabel: string
}

export interface CodeGroup {
    key: string
    label: string
    /** Surnom du rack (« Double haut ») ou nom de la zone (« Annexe »). */
    subtitle: string
    items: CodeItem[]
}

const byNumericLabel = (a: string, b: string) => a.localeCompare(b, "fr", { numeric: true })

export function groupEmplacementsForCodes(zones: ZoneNode[], emplacements: Emplacement[]): CodeGroup[] {
    const paths = buildEmplacementPaths(zones, emplacements)
    const groups = new Map<string, CodeGroup>()

    for (const emplacement of emplacements) {
        if (!emplacement.is_active) continue
        const path = paths.get(emplacement.id)
        if (!path) continue
        const { segments } = path
        // Les deux derniers segments sont la travée et la hauteur ; une zone
        // sans rack (A · SOL) n'a que sa racine.
        const groupSegments = segments.length > 2 ? segments.slice(0, -2) : segments.slice(0, 1)
        const key = groupSegments.join("/").toUpperCase()
        const root = segments[0]?.toUpperCase() as PlanZoneCode
        const row = groupSegments[1]?.toUpperCase() as PlanRow | undefined
        const group = groups.get(key) ?? {
            key,
            label: groupSegments.join(EMPLACEMENT_PATH_SEPARATOR),
            subtitle: (row && PLAN_ROW_LABELS[row]) ?? PLAN_ZONES[root]?.label ?? "",
            items: [],
        }
        group.items.push({
            id: emplacement.id,
            path: path.full_code,
            segments,
            zoneLabel: PLAN_ZONES[root]?.label ?? segments[0] ?? "",
        })
        groups.set(key, group)
    }

    const sorted = [...groups.values()].sort((a, b) => byNumericLabel(a.label, b.label))
    for (const group of sorted) group.items.sort((a, b) => byNumericLabel(a.path, b.path))
    return sorted
}

/**
 * Grille d'un rack, lue comme le rack lui-même : travées en colonnes (E1 →),
 * hauteurs en lignes de haut en bas (H2 → H0). `cells` : `E3/H1` → item ;
 * une case absente (hauteur d'une palette au sol, emplacement retiré) reste
 * vide. `null` pour une zone sans rack (A · SOL).
 */
export interface RackGrid {
    bays: string[]
    levels: string[]
    cells: Map<string, CodeItem>
}

export function rackGrid(group: CodeGroup): RackGrid | null {
    if (!group.items.every((item) => item.segments.length >= 4)) return null
    const cells = new Map<string, CodeItem>()
    const bays = new Set<string>()
    const levels = new Set<string>()
    for (const item of group.items) {
        const [bay, level] = item.segments.slice(-2)
        bays.add(bay)
        levels.add(level)
        cells.set(`${bay}/${level}`, item)
    }
    return {
        bays: [...bays].sort(byNumericLabel),
        levels: [...levels].sort(byNumericLabel).reverse(),
        cells,
    }
}
