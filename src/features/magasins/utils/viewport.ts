// Zoom d'affichage du plan 2D : la vue est une fenêtre (en mètres) sur le
// cadre du magasin. Le dessin ne change pas, seule la portion affichée.

import type { Bounds } from "./planGeometry"

/** Marge autour du cadre du magasin, en mètres (place des étiquettes). */
export const VIEW_MARGIN = 0.6
export const MIN_ZOOM = 1
export const MAX_ZOOM = 12

export interface ViewBox {
    x: number
    y: number
    w: number
    h: number
}

/** Vue entière : le magasin et sa marge. */
export function fullView(bounds: Bounds): ViewBox {
    return { x: -VIEW_MARGIN, y: -VIEW_MARGIN, w: bounds.width + 2 * VIEW_MARGIN, h: bounds.depth + 2 * VIEW_MARGIN }
}

/** Niveau de zoom d'une vue : 1 = tout le magasin. */
export function zoomOf(view: ViewBox, bounds: Bounds): number {
    return fullView(bounds).w / view.w
}

/** Garde la vue dans la vue entière (on ne se perd pas hors du magasin). */
export function clampView(view: ViewBox, bounds: Bounds): ViewBox {
    const full = fullView(bounds)
    const w = Math.min(view.w, full.w)
    const h = Math.min(view.h, full.h)
    return {
        x: Math.min(Math.max(view.x, full.x), full.x + full.w - w),
        y: Math.min(Math.max(view.y, full.y), full.y + full.h - h),
        w,
        h,
    }
}

/**
 * Zoom d'un facteur autour d'un point du plan (sous le pointeur) : ce point
 * reste sous le pointeur. Facteur > 1 rapproche, < 1 éloigne.
 */
export function zoomAt(view: ViewBox, bounds: Bounds, point: { x: number; y: number }, factor: number): ViewBox {
    const full = fullView(bounds)
    const target = Math.min(Math.max(zoomOf(view, bounds) * factor, MIN_ZOOM), MAX_ZOOM)
    const w = full.w / target
    const h = full.h / target
    const k = w / view.w
    return clampView({ x: point.x - (point.x - view.x) * k, y: point.y - (point.y - view.y) * k, w, h }, bounds)
}

/** Zoom autour du centre de la vue (boutons + et −). */
export function zoomCenter(view: ViewBox, bounds: Bounds, factor: number): ViewBox {
    return zoomAt(view, bounds, { x: view.x + view.w / 2, y: view.y + view.h / 2 }, factor)
}

/** Déplacement de la vue, en mètres. */
export function panView(view: ViewBox, bounds: Bounds, dx: number, dy: number): ViewBox {
    return clampView({ ...view, x: view.x + dx, y: view.y + dy }, bounds)
}

export function viewBoxAttr(view: ViewBox): string {
    return `${view.x} ${view.y} ${view.w} ${view.h}`
}
