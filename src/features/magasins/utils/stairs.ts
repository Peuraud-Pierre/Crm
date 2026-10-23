// Escaliers fusionnés en 3D : les volées s'enchaînent — chacune part de la
// hauteur où la précédente arrive, au lieu de repartir du sol.

import type { PlanItem, Point } from "@/features/magasins/types/magasin.types"
import { groupMembers, isStairs } from "./group"
import { rectOf } from "./planGeometry"

/** Tour d'un colimaçon (voir les marques 2D et `buildColimacon`). */
const SPIRAL_TURN = 330

/** Départ et arrivée d'une volée sur le plan, dans le sens de la flèche. */
export function flightEnds(item: PlanItem): { start: Point; end: Point; length: number } | null {
    const rect = rectOf(item.geometry)
    if (!rect) return null
    const cx = rect.x + rect.w / 2
    const cy = rect.y + rect.h / 2
    const rad = (item.geometry.rotation * Math.PI) / 180
    // Rotation du plan (y vers le bas) : sens horaire à l'écran, comme le SVG.
    const turn = (dx: number, dy: number): Point => [
        cx + dx * Math.cos(rad) - dy * Math.sin(rad),
        cy + dx * Math.sin(rad) + dy * Math.cos(rad),
    ]
    if (item.kind === "escalier_colimacon") {
        const r = Math.min(rect.w, rect.h) / 2
        const at = (deg: number) => {
            const a = ((deg - 90) * Math.PI) / 180
            return turn(r * Math.cos(a), r * Math.sin(a))
        }
        return { start: at(0), end: at(SPIRAL_TURN), length: Math.PI * r }
    }
    const alongX = rect.w >= rect.h
    const half = Math.max(rect.w, rect.h) / 2
    return {
        start: alongX ? turn(-half, 0) : turn(0, -half),
        end: alongX ? turn(half, 0) : turn(0, half),
        length: half * 2,
    }
}

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1])

/**
 * Niveau de départ et hauteur de chaque volée d'escalier fusionné. Les volées
 * sont mises bout à bout : la première est celle dont le départ ne touche
 * l'arrivée d'aucune autre, la suivante celle qui part au plus près de
 * l'arrivée courante. La hauteur totale se partage selon leur longueur.
 */
export function stairLevels(items: readonly PlanItem[], total: number): Map<string, { start: number; height: number }> {
    const levels = new Map<string, { start: number; height: number }>()
    const done = new Set<string>()
    for (const item of items) {
        if (!item.groupe || done.has(item.groupe) || !isStairs(item)) continue
        done.add(item.groupe)
        const flights = groupMembers(item, items).flatMap((m) => {
            const ends = isStairs(m) ? flightEnds(m) : null
            return ends ? [{ key: m.key, ...ends }] : []
        })
        if (flights.length < 2) continue
        const nearestEnd = (f: (typeof flights)[number]) =>
            Math.min(...flights.filter((o) => o !== f).map((o) => dist(f.start, o.end)))
        const rest = [...flights]
        rest.sort((a, b) => nearestEnd(b) - nearestEnd(a))
        const chain = [rest.shift()!]
        while (rest.length > 0) {
            const last = chain[chain.length - 1]
            rest.sort((a, b) => dist(last.end, a.start) - dist(last.end, b.start))
            chain.push(rest.shift()!)
        }
        const sum = chain.reduce((s, f) => s + f.length, 0)
        let start = 0
        for (const f of chain) {
            const height = (total * f.length) / sum
            // Qui descend part du sol vers le bas : chaque volée commence là où
            // la précédente est arrivée, plus bas.
            levels.set(f.key, { start: item.descend ? -start : start, height })
            start += height
        }
    }
    return levels
}
