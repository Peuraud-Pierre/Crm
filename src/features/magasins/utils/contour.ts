// Contour d'un étage : polygone libre en mètres, dans le cadre du magasin
// (magasin en L, renfoncement, pan coupé…). `null` en base = le rectangle
// entier du magasin.

import type { Point } from "@/features/magasins/types/magasin.types"
import { snap, type Bounds } from "./planGeometry"

/** Un polygone a au moins trois sommets (contrainte en base aussi). */
export const MIN_VERTICES = 3

export function rectContour(bounds: Bounds): Point[] {
    return [
        [0, 0],
        [bounds.width, 0],
        [bounds.width, bounds.depth],
        [0, bounds.depth],
    ]
}

/** Contour à dessiner : celui de l'étage, ou le rectangle du magasin. */
export function effectiveContour(contour: readonly Point[] | null, bounds: Bounds): Point[] {
    return contour && contour.length >= MIN_VERTICES ? contour.map(([x, y]) => [x, y] as Point) : rectContour(bounds)
}

/** Le contour est-il le rectangle du magasin ? On enregistre alors `null`. */
export function isRectContour(points: readonly Point[], bounds: Bounds): boolean {
    const rect = rectContour(bounds)
    return points.length === 4 && points.every(([x, y], i) => x === rect[i][0] && y === rect[i][1])
}

/** Sommet ramené au pas de 10 cm et dans le cadre du magasin. */
export function snapPoint(x: number, y: number, bounds: Bounds): Point {
    const clamp = (v: number, max: number) => Math.min(Math.max(snap(v), 0), max)
    return [clamp(x, bounds.width), clamp(y, bounds.depth)]
}

export function moveVertex(points: readonly Point[], index: number, to: Point): Point[] {
    return points.map((p, i) => (i === index ? to : p))
}

/** Insère un sommet entre `index` et le suivant (le dernier rejoint le premier). */
export function insertVertex(points: readonly Point[], index: number, at: Point): Point[] {
    return [...points.slice(0, index + 1), at, ...points.slice(index + 1)]
}

/** Retire un sommet, sauf s'il n'en resterait plus que deux. */
export function removeVertex(points: readonly Point[], index: number): Point[] {
    if (points.length <= MIN_VERTICES) return [...points]
    return points.filter((_, i) => i !== index)
}

/** Milieu de chaque côté : là où l'on « tire » pour ajouter un sommet. */
export function edgeMidpoints(points: readonly Point[]): { index: number; point: Point }[] {
    return points.map((p, i) => {
        const next = points[(i + 1) % points.length]
        return { index: i, point: [(p[0] + next[0]) / 2, (p[1] + next[1]) / 2] as Point }
    })
}

export function polygonPoints(points: readonly Point[]): string {
    return points.map(([x, y]) => `${x},${y}`).join(" ")
}

/** Surface du polygone (formule du lacet), en m². */
export function polygonArea(points: readonly Point[]): number {
    let sum = 0
    for (let i = 0; i < points.length; i++) {
        const [x1, y1] = points[i]
        const [x2, y2] = points[(i + 1) % points.length]
        sum += x1 * y2 - x2 * y1
    }
    return Math.abs(sum) / 2
}
