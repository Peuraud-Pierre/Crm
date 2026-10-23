import { EMPLACEMENT_PATH_SEPARATOR } from "@/features/stock_handpick/constants"
import type {
    Emplacement,
    EmplacementOption,
    EmplacementPath,
    ZoneNode,
    ZoneTreeNode,
} from "@/features/stock_handpick/types/location.types"

/**
 * Recompose l'arbre du plan à partir des deux listes plates.
 *
 * Les nœuds dont le parent est absent de la liste (cas théorique : une zone
 * filtrée côté RLS) sont traités comme des racines plutôt que silencieusement
 * perdus — mieux vaut un plan incomplet mais visible qu'un emplacement
 * introuvable.
 */
export function buildZoneTree(zones: ZoneNode[], emplacements: Emplacement[]): ZoneTreeNode[] {
    const nodes = new Map<string, ZoneTreeNode>(
        zones.map((zone) => [zone.id, { ...zone, children: [], emplacements: [] }]),
    )

    for (const emplacement of emplacements) {
        nodes.get(emplacement.zone_id)?.emplacements.push(emplacement)
    }

    const roots: ZoneTreeNode[] = []
    for (const node of nodes.values()) {
        const parent = node.parent_id ? nodes.get(node.parent_id) : undefined
        if (parent) parent.children.push(node)
        else roots.push(node)
    }

    const sortNodes = (list: ZoneTreeNode[]) => {
        list.sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code, "fr"))
        for (const node of list) sortNodes(node.children)
    }
    sortNodes(roots)

    return roots
}

/**
 * Chemin lisible de chaque emplacement (« A · 01 · 3 · P02 »), calculé une
 * fois pour toutes. Pas de colonne dénormalisée en base : elle exigerait de
 * recalculer toute la descendance à chaque renommage de zone.
 */
export function buildEmplacementPaths(
    zones: ZoneNode[],
    emplacements: Emplacement[],
): Map<string, EmplacementPath> {
    const byId = new Map(zones.map((zone) => [zone.id, zone]))

    // Mémoïsation : deux emplacements de la même étagère partagent leur préfixe.
    const prefixCache = new Map<string, string[]>()

    const prefixFor = (zoneId: string): string[] => {
        const cached = prefixCache.get(zoneId)
        if (cached) return cached

        const segments: string[] = []
        let current = byId.get(zoneId)
        const seen = new Set<string>()

        // `seen` garde contre un cycle résiduel : le trigger
        // zones_handpick_check_hierarchy l'empêche en base, mais une donnée
        // antérieure au trigger ferait ici une boucle infinie.
        while (current && !seen.has(current.id)) {
            seen.add(current.id)
            segments.unshift(current.code)
            current = current.parent_id ? byId.get(current.parent_id) : undefined
        }

        prefixCache.set(zoneId, segments)
        return segments
    }

    const paths = new Map<string, EmplacementPath>()
    for (const emplacement of emplacements) {
        const segments = [...prefixFor(emplacement.zone_id), emplacement.code]
        paths.set(emplacement.id, {
            emplacement_id: emplacement.id,
            segments,
            full_code: segments.join(EMPLACEMENT_PATH_SEPARATOR),
        })
    }

    return paths
}

/** Options triées du select plat d'emplacement (Inventaire). */
export function buildEmplacementOptions(
    zones: ZoneNode[],
    emplacements: Emplacement[],
): EmplacementOption[] {
    const paths = buildEmplacementPaths(zones, emplacements)

    return emplacements
        .map((emplacement) => ({
            id: emplacement.id,
            full_code: paths.get(emplacement.id)?.full_code ?? emplacement.code,
            segments: paths.get(emplacement.id)?.segments ?? [emplacement.code],
            is_active: emplacement.is_active,
        }))
        .sort((a, b) => a.full_code.localeCompare(b.full_code, "fr", { numeric: true }))
}
