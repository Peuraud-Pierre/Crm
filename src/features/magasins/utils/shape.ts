// Formes libres des zones (meubles de merch, îlots…) : tracées en mètres,
// stockées relativement à leur rectangle englobant (voir migration
// 20261008120000_magasins_formes_libres).

import type { Point } from "@/features/magasins/types/magasin.types"
import { MIN_SIDE, type Rect } from "./planGeometry"

const round2 = (v: number) => Math.round(v * 100) / 100
const round4 = (v: number) => Math.round(v * 10000) / 10000

/** Rectangle englobant, côtés d'au moins MIN_SIDE (un trait plat reste sélectionnable). */
export function boundingRect(points: readonly Point[]): Rect {
    const xs = points.map((p) => p[0])
    const ys = points.map((p) => p[1])
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    return {
        x: round2(x),
        y: round2(y),
        w: round2(Math.max(MIN_SIDE, Math.max(...xs) - x)),
        h: round2(Math.max(MIN_SIDE, Math.max(...ys) - y)),
    }
}

/** Points en mètres → coordonnées relatives au rectangle (0 à 1). */
export function toRelative(points: readonly Point[], rect: Rect): Point[] {
    return points.map(([x, y]) => [round4((x - rect.x) / rect.w), round4((y - rect.y) / rect.h)])
}

/** Coordonnées relatives → points en mètres, au rectangle courant de la zone. */
export function toAbsolute(forme: readonly Point[], rect: Rect): Point[] {
    return forme.map(([u, v]) => [round2(rect.x + u * rect.w), round2(rect.y + v * rect.h)])
}

/** Tracé fini → rectangle de la zone et forme relative à enregistrer. */
export function shapeFromPoints(points: readonly Point[]): { rect: Rect; forme: Point[] } {
    const rect = boundingRect(points)
    return { rect, forme: toRelative(points, rect) }
}

/** Le tracé en cours se ferme si l'on clique près de son premier point. */
export function closesShape(points: readonly Point[], at: Point, tolerance: number): boolean {
    if (points.length < 3) return false
    const [x, y] = points[0]
    return Math.hypot(at[0] - x, at[1] - y) <= tolerance
}

/** Ajoute un point au tracé ; le second clic d'un double-clic est ignoré. */
export function addPoint(points: readonly Point[], at: Point): Point[] {
    const last = points[points.length - 1]
    if (last && Math.hypot(last[0] - at[0], last[1] - at[1]) < 0.05) return [...points]
    return [...points, at]
}
