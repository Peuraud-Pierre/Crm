// Mannequins rattachés aux zones, comme les portants : la zone où l'on pose
// un mannequin devient la sienne, s'il n'en a pas encore.

import type { EquipementMagasin, PlanGeometry, PlanItem } from "@/features/magasins/types/magasin.types"
import { containingZone, rectOf } from "./planGeometry"

/** Zone, rayon ou portant le plus petit sous le centre de la position ; `null` hors de tout. */
export function zoneUnder(geometry: PlanGeometry, items: readonly PlanItem[]): string | null {
    const rect = rectOf(geometry)
    return rect ? (containingZone(rect, items)?.id ?? null) : null
}

/**
 * Rattachements à faire après un enregistrement du plan : chaque mannequin
 * déplacé et encore sans zone prend celle où il a été posé.
 */
export function autoZoneLinks(
    changes: readonly { type: string; id: string; geometry: PlanGeometry }[],
    equipements: readonly EquipementMagasin[],
    items: readonly PlanItem[],
): { id: string; zoneId: string }[] {
    return changes.flatMap((change) => {
        if (change.type !== "equipement") return []
        const eq = equipements.find((e) => e.id === change.id)
        if (eq?.kind !== "mannequin" || eq.zone_id) return []
        const zoneId = zoneUnder(change.geometry, items)
        return zoneId ? [{ id: eq.id, zoneId }] : []
    })
}
