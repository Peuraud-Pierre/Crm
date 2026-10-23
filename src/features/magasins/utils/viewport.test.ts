import { expect, test } from "@rstest/core"
import { clampView, fullView, MAX_ZOOM, panView, zoomAt, zoomCenter, zoomOf } from "./viewport"

const bounds = { width: 20, depth: 10 }
const full = fullView(bounds)

test("la vue entière couvre le magasin et sa marge, au zoom 1", () => {
    expect(full).toEqual({ x: -0.6, y: -0.6, w: 21.2, h: 11.2 })
    expect(zoomOf(full, bounds)).toBe(1)
})

test("zoomer garde le point visé sous le pointeur", () => {
    const point = { x: 5, y: 4 }
    const view = zoomAt(full, bounds, point, 2)
    expect(zoomOf(view, bounds)).toBeCloseTo(2)
    // Position relative du point dans la vue : inchangée.
    const before = (point.x - full.x) / full.w
    const after = (point.x - view.x) / view.w
    expect(after).toBeCloseTo(before)
})

test("le zoom est borné entre la vue entière et MAX_ZOOM", () => {
    expect(zoomOf(zoomCenter(full, bounds, 0.5), bounds)).toBe(1)
    let view = full
    for (let i = 0; i < 20; i++) view = zoomCenter(view, bounds, 2)
    expect(zoomOf(view, bounds)).toBeCloseTo(MAX_ZOOM)
})

test("on se déplace dans la vue sans sortir du magasin", () => {
    const zoomed = zoomCenter(full, bounds, 4)
    const moved = panView(zoomed, bounds, 2, 0)
    expect(moved.x).toBeCloseTo(zoomed.x + 2)
    const far = panView(zoomed, bounds, 1000, -1000)
    expect(far.x + far.w).toBeCloseTo(full.x + full.w)
    expect(far.y).toBeCloseTo(full.y)
    const back = clampView({ ...full, x: 50 }, bounds)
    for (const k of ["x", "y", "w", "h"] as const) expect(back[k]).toBeCloseTo(full[k])
})
