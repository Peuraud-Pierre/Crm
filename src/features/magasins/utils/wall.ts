// Murs : lignes brisées en mètres, tracées point par point.

import type { Point } from "@/features/magasins/types/magasin.types"

export const murKey = (id: string) => `m:${id}`
export const isMurKey = (key: string | null): key is string => Boolean(key?.startsWith("m:"))
export const murIdOf = (key: string) => key.slice(2)

/** Longueur totale du mur, en mètres. */
export function wallLength(points: readonly Point[]): number {
    let total = 0
    for (let i = 1; i < points.length; i++) {
        total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
    }
    return Math.round(total * 100) / 100
}

/**
 * Mur tracé par quatre points (refermé ou non) : c'est le pourtour d'un mur
 * plein, dessiné rempli en 2D et extrudé d'un bloc en 3D. `null` sinon.
 */
export function filledOutline(points: readonly Point[]): Point[] | null {
    const last = points[points.length - 1]
    const closed = points.length > 1 && last[0] === points[0][0] && last[1] === points[0][1]
    const outline = closed ? points.slice(0, -1) : [...points]
    return outline.length === 4 ? outline : null
}

/** Segments du mur, pour la 3D : milieu, longueur et angle (radians, de +x vers +y). */
export function wallSegments(points: readonly Point[]) {
    return points.slice(1).flatMap((end, i) => {
        const start = points[i]
        const dx = end[0] - start[0]
        const dy = end[1] - start[1]
        const length = Math.hypot(dx, dy)
        if (length < 1e-6) return []
        return [{ cx: (start[0] + end[0]) / 2, cy: (start[1] + end[1]) / 2, length, angle: Math.atan2(dy, dx) }]
    })
}

/** Pas d'angle avec Maj enfoncée : 15° donne 0, 15, 30, 45, 60, 90… */
export const ANGLE_STEP = 15

/**
 * Maj enfoncée : le segment depuis le point précédent prend l'angle multiple
 * de 15° le plus proche (horizontale, verticale, 45°, 30°…) et une longueur
 * arrondie à 10 cm — des diagonales nettes sans viser, comme en CAO.
 */
export function angleSnapPoint(previous: Point | undefined, at: Point, step = ANGLE_STEP): Point {
    if (!previous) return at
    const dx = at[0] - previous[0]
    const dy = at[1] - previous[1]
    const length = Math.round(Math.hypot(dx, dy) * 10) / 10
    const stepRad = (step * Math.PI) / 180
    const angle = Math.round(Math.atan2(dy, dx) / stepRad) * stepRad
    const round2 = (v: number) => Math.round(v * 100) / 100
    return [round2(previous[0] + length * Math.cos(angle)), round2(previous[1] + length * Math.sin(angle))]
}

/** Longueur (m) et angle (°, 0 = vers la droite, sens horaire à l'écran) d'un segment. */
export function segmentMeasure(from: Point, to: Point): { length: number; angle: number } {
    const dx = to[0] - from[0]
    const dy = to[1] - from[1]
    const angle = Math.round(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360)
    return { length: Math.round(Math.hypot(dx, dy) * 100) / 100, angle: angle === 360 ? 0 : angle }
}

/** « 2,35 m · 45° » : cote d'un segment, affichée pendant le tracé. */
export function formatMeasure(from: Point, to: Point): string {
    const { length, angle } = segmentMeasure(from, to)
    return `${length.toLocaleString("fr-FR")} m · ${angle}°`
}
