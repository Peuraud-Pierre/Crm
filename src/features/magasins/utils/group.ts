// Équipements regroupés : volées d'escalier fusionnées en un seul escalier
// (migration 20261008170000).

import type { PlanItem } from "@/features/magasins/types/magasin.types"
import { moveRect, rectOf, type Bounds, type Rect } from "./planGeometry"

const STAIRS = new Set<PlanItem["kind"]>(["escalier", "escalier_colimacon"])

export const isStairs = (item: PlanItem) => STAIRS.has(item.kind)

/** L'élément et les autres membres de son groupe (lui seul hors groupe). */
export function groupMembers(item: PlanItem, items: readonly PlanItem[]): PlanItem[] {
    if (!item.groupe) return [item]
    return items.filter((i) => i.groupe === item.groupe)
}

/** Clés de tous les éléments mis en évidence par la sélection de `key`. */
export function selectionKeys(key: string | null, items: readonly PlanItem[]): Set<string> {
    const item = key ? items.find((i) => i.key === key) : undefined
    return new Set(item ? groupMembers(item, items).map((i) => i.key) : key ? [key] : [])
}

/**
 * Rectangles à appliquer quand un élément change. Un déplacement (même
 * taille) emporte tout son groupe du même écart ; un redimensionnement ne
 * touche que l'élément tiré.
 */
export function groupRects(item: PlanItem, rect: Rect, items: readonly PlanItem[], bounds: Bounds): { item: PlanItem; rect: Rect }[] {
    const before = rectOf(item.geometry)
    const moved = before && before.w === rect.w && before.h === rect.h
    if (!item.groupe || !before || !moved) return [{ item, rect }]
    const dx = rect.x - before.x
    const dy = rect.y - before.y
    return groupMembers(item, items).flatMap((member) => {
        if (member.key === item.key) return [{ item, rect }]
        const r = rectOf(member.geometry)
        return r ? [{ item: member, rect: moveRect(r, dx, dy, bounds, member.geometry.rotation) }] : []
    })
}

/** Le groupe résultant de la fusion de deux éléments (les groupes existants se rejoignent). */
export function mergedIds(a: PlanItem, b: PlanItem, items: readonly PlanItem[]): string[] {
    return [...new Set([...groupMembers(a, items), ...groupMembers(b, items)].map((i) => i.id))]
}
