import { expect, test } from "@rstest/core"
import { addPoint, boundingRect, closesShape, shapeFromPoints, toAbsolute, toRelative } from "./shape"
import type { Point } from "@/features/magasins/types/magasin.types"

// Gondole en L : 3 m × 2 m, branche de 1 m.
const L: Point[] = [[2, 1], [5, 1], [5, 2], [3, 2], [3, 3], [2, 3]]

test("boundingRect englobe le tracé", () => {
    expect(boundingRect(L)).toEqual({ x: 2, y: 1, w: 3, h: 2 })
    // Un trait plat garde une épaisseur sélectionnable.
    expect(boundingRect([[0, 0], [4, 0], [2, 0]])).toEqual({ x: 0, y: 0, w: 4, h: 0.2 })
})

test("la forme relative suit le rectangle quand on déplace ou agrandit la zone", () => {
    const { rect, forme } = shapeFromPoints(L)
    expect(forme[0]).toEqual([0, 0])
    expect(forme[3]).toEqual([0.3333, 0.5])
    expect(toAbsolute(forme, rect)).toEqual(L)
    // Déplacée de 1 m à droite et agrandie de moitié : le L suit.
    expect(toAbsolute(forme, { x: 3, y: 1, w: 4.5, h: 3 })[1]).toEqual([7.5, 1])
    expect(toRelative(toAbsolute(forme, rect), rect)).toEqual(forme)
})

test("le tracé se ferme en cliquant près du premier point, à partir de 3 points", () => {
    expect(closesShape([[0, 0], [2, 0]], [0.1, 0], 0.3)).toBe(false)
    expect(closesShape([[0, 0], [2, 0], [2, 2]], [0.1, 0.1], 0.3)).toBe(true)
    expect(closesShape([[0, 0], [2, 0], [2, 2]], [1, 1], 0.3)).toBe(false)
})

test("addPoint ignore le second clic d'un double-clic", () => {
    expect(addPoint([[1, 1]], [1.02, 1])).toEqual([[1, 1]])
    expect(addPoint([[1, 1]], [2, 1])).toEqual([[1, 1], [2, 1]])
})
