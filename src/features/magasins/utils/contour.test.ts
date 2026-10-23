import { expect, test } from "@rstest/core"
import {
    edgeMidpoints,
    effectiveContour,
    insertVertex,
    isRectContour,
    moveVertex,
    polygonArea,
    rectContour,
    removeVertex,
    snapPoint,
} from "./contour"

const bounds = { width: 10, depth: 8 }

test("sans contour, l'étage a le rectangle du magasin", () => {
    expect(effectiveContour(null, bounds)).toEqual(rectContour(bounds))
    expect(isRectContour(rectContour(bounds), bounds)).toBe(true)
})

test("magasin en L : on tire un coin vers l'intérieur", () => {
    // Coin bas-droit ramené, et un sommet ajouté pour former le L.
    let l = moveVertex(rectContour(bounds), 2, [5, 8])
    l = insertVertex(l, 1, [10, 4])
    l = insertVertex(l, 2, [5, 4])
    expect(l).toEqual([[0, 0], [10, 0], [10, 4], [5, 4], [5, 8], [0, 8]])
    expect(polygonArea(l)).toBe(60)
    expect(isRectContour(l, bounds)).toBe(false)
})

test("snapPoint arrondit à 10 cm et reste dans le cadre", () => {
    expect(snapPoint(4.96, -2, bounds)).toEqual([5, 0])
    expect(snapPoint(12, 3.04, bounds)).toEqual([10, 3])
})

test("un contour garde au moins trois sommets", () => {
    const triangle = removeVertex(rectContour(bounds), 3)
    expect(triangle).toHaveLength(3)
    expect(removeVertex(triangle, 0)).toEqual(triangle)
})

test("les milieux de côté bouclent du dernier sommet au premier", () => {
    const mids = edgeMidpoints(rectContour(bounds))
    expect(mids[0]).toEqual({ index: 0, point: [5, 0] })
    expect(mids[3]).toEqual({ index: 3, point: [0, 4] })
})
