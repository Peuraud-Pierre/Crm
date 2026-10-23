import { EQUIPEMENT_CODE_PREFIX } from "@/features/magasins/constants"
import type {
    EmplacementMagasin,
    EquipementKind,
    EquipementMagasin,
    PlanItem,
    ZoneMagasin,
    ZoneTreeNode,
} from "@/features/magasins/types/magasin.types"

export const PATH_SEPARATOR = " · "

export const zoneKey = (id: string) => `z:${id}`
export const emplacementKey = (id: string) => `e:${id}`
export const equipementKey = (id: string) => `q:${id}`

/** Prochain code libre d'un type d'équipement : C1, C2… (trous comblés). */
export function nextEquipementCode(kind: EquipementKind, existing: readonly EquipementMagasin[]): string {
    const prefix = EQUIPEMENT_CODE_PREFIX[kind]
    const used = new Set(existing.filter((e) => e.kind === kind).map((e) => e.code.toUpperCase()))
    let n = 1
    while (used.has(`${prefix}${n}`)) n++
    return `${prefix}${n}`
}

function byOrder(a: ZoneMagasin, b: ZoneMagasin) {
    return a.sort_order - b.sort_order || a.code.localeCompare(b.code, "fr", { numeric: true })
}

function byCode(a: { code: string }, b: { code: string }) {
    return a.code.localeCompare(b.code, "fr", { numeric: true })
}

/**
 * Recompose l'arbre à partir des deux listes plates. Une zone dont le parent
 * manque (désynchronisation passagère) est rattachée à la racine plutôt que
 * perdue.
 */
export function buildZoneTree(
    zones: readonly ZoneMagasin[],
    emplacements: readonly EmplacementMagasin[],
): ZoneTreeNode[] {
    const nodes = new Map<string, ZoneTreeNode>()
    for (const zone of zones) nodes.set(zone.id, { ...zone, children: [], emplacements: [] })

    const roots: ZoneTreeNode[] = []
    for (const node of nodes.values()) {
        const parent = node.parent_id ? nodes.get(node.parent_id) : undefined
        if (parent) parent.children.push(node)
        else roots.push(node)
    }
    for (const emplacement of emplacements) {
        nodes.get(emplacement.zone_id)?.emplacements.push(emplacement)
    }

    const sort = (list: ZoneTreeNode[]) => {
        list.sort(byOrder)
        for (const node of list) {
            sort(node.children)
            node.emplacements.sort(byCode)
        }
    }
    sort(roots)
    return roots
}

/** Codes de la zone racine jusqu'à la zone donnée. */
export function zoneSegments(zoneId: string, zonesById: ReadonlyMap<string, ZoneMagasin>): string[] {
    const segments: string[] = []
    const seen = new Set<string>()
    let current = zonesById.get(zoneId)
    while (current && !seen.has(current.id)) {
        seen.add(current.id)
        segments.unshift(current.code)
        current = current.parent_id ? zonesById.get(current.parent_id) : undefined
    }
    return segments
}

/** Zone donnée et toute sa descendance. */
export function descendantZoneIds(zoneId: string, zones: readonly ZoneMagasin[]): string[] {
    const childrenOf = new Map<string, string[]>()
    for (const zone of zones) {
        if (!zone.parent_id) continue
        childrenOf.set(zone.parent_id, [...(childrenOf.get(zone.parent_id) ?? []), zone.id])
    }
    const result: string[] = []
    const stack = [zoneId]
    while (stack.length > 0) {
        const id = stack.pop() as string
        if (result.includes(id)) continue
        result.push(id)
        stack.push(...(childrenOf.get(id) ?? []))
    }
    return result
}

/** Emplacements emportés par la suppression d'une zone (cascade en base). */
export function emplacementsUnder(
    zoneId: string,
    zones: readonly ZoneMagasin[],
    emplacements: readonly EmplacementMagasin[],
): EmplacementMagasin[] {
    const ids = new Set(descendantZoneIds(zoneId, zones))
    return emplacements.filter((e) => ids.has(e.zone_id))
}

/**
 * Éléments du plan à plat, dans l'ordre de dessin : les zones du plus général
 * au plus précis, les emplacements par-dessus, puis les équipements (caisses,
 * portes), qui ne sont dans aucune zone.
 */
export function buildPlanItems(
    zones: readonly ZoneMagasin[],
    emplacements: readonly EmplacementMagasin[],
    equipements: readonly EquipementMagasin[] = [],
): PlanItem[] {
    const zonesById = new Map(zones.map((z) => [z.id, z]))
    const roots = [...zones].filter((z) => !z.parent_id).sort(byOrder)
    const rootIndex = new Map(roots.map((z, i) => [z.id, i]))
    const rootOf = (zoneId: string) => {
        const seen = new Set<string>()
        let current = zonesById.get(zoneId)
        while (current?.parent_id && !seen.has(current.id)) {
            seen.add(current.id)
            const parent = zonesById.get(current.parent_id)
            if (!parent) break
            current = parent
        }
        return current?.id ?? zoneId
    }

    const zoneItems: PlanItem[] = zones.map((zone) => {
        const segments = zoneSegments(zone.id, zonesById)
        return {
            key: zoneKey(zone.id),
            type: "zone",
            id: zone.id,
            parentKey: zone.parent_id ? zoneKey(zone.parent_id) : null,
            kind: zone.kind,
            code: zone.code,
            label: zone.label,
            path: segments.join(PATH_SEPARATOR),
            depth: segments.length - 1,
            color: zone.color,
            colorIndex: rootIndex.get(rootOf(zone.id)) ?? 0,
            is_active: zone.is_active,
            geometry: pick(zone),
            forme: zone.forme ?? null,
            groupe: null,
            descend: false,
            groupLeader: true,
        }
    })
    zoneItems.sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path, "fr", { numeric: true }))

    const emplacementItems: PlanItem[] = emplacements.map((emp) => {
        const segments = [...zoneSegments(emp.zone_id, zonesById), emp.code]
        const zone = zonesById.get(emp.zone_id)
        return {
            key: emplacementKey(emp.id),
            type: "emplacement",
            id: emp.id,
            parentKey: zoneKey(emp.zone_id),
            kind: "emplacement",
            code: emp.code,
            label: emp.label,
            path: segments.join(PATH_SEPARATOR),
            depth: segments.length - 1,
            color: zone?.color ?? null,
            colorIndex: rootIndex.get(rootOf(emp.zone_id)) ?? 0,
            is_active: emp.is_active,
            geometry: pick(emp),
            forme: null,
            groupe: null,
            descend: false,
            groupLeader: true,
        }
    })
    emplacementItems.sort((a, b) => a.path.localeCompare(b.path, "fr", { numeric: true }))

    // Le premier code d'un groupe (ESC1 avant ESC2) le représente.
    const leaders = new Map<string, string>()
    for (const eq of [...equipements].sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true }))) {
        if (eq.groupe && !leaders.has(eq.groupe)) leaders.set(eq.groupe, eq.id)
    }
    const equipementItems: PlanItem[] = equipements.map((eq) => {
        // Mannequin rattaché : il prend place dans l'arborescence, comme un portant.
        const zoneId = eq.zone_id && zonesById.has(eq.zone_id) ? eq.zone_id : null
        const segments = zoneId ? [...zoneSegments(zoneId, zonesById), eq.code] : [eq.code]
        return {
            key: equipementKey(eq.id),
            type: "equipement" as const,
            id: eq.id,
            parentKey: zoneId ? zoneKey(zoneId) : null,
            kind: eq.kind,
            code: eq.code,
            label: eq.label,
            path: segments.join(PATH_SEPARATOR),
            depth: segments.length - 1,
            color: null,
            colorIndex: 0,
            is_active: eq.is_active,
            geometry: pick(eq),
            forme: eq.forme ?? null,
            groupe: eq.groupe ?? null,
            groupLeader: !eq.groupe || leaders.get(eq.groupe) === eq.id,
            descend: eq.descend ?? false,
        }
    })
    equipementItems.sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true }))

    return [...zoneItems, ...emplacementItems, ...equipementItems]
}

function pick(row: ZoneMagasin | EmplacementMagasin | EquipementMagasin) {
    return {
        pos_x: row.pos_x,
        pos_y: row.pos_y,
        width: row.width,
        height: row.height,
        rotation: row.rotation ?? 0,
    }
}
