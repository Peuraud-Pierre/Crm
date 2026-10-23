import { expect, test } from "@rstest/core"
import { angleSnapPoint, formatMeasure, isMurKey, murIdOf, murKey, segmentMeasure, wallLength, wallSegments } from "./wall"

test("longueur et segments d'un mur en L", () => {
    const L: [number, number][] = [[0, 5], [8, 5], [8, 9]]
    expect(wallLength(L)).toBe(12)
    const [a, b] = wallSegments(L)
    expect(a).toMatchObject({ cx: 4, cy: 5, length: 8, angle: 0 })
    expect(b.length).toBe(4)
    expect(b.angle).toBeCloseTo(Math.PI / 2)
    // Deux points confondus ne font pas de segment.
    expect(wallSegments([[1, 1], [1, 1], [3, 1]])).toHaveLength(1)
})

test("Maj : angle par pas de 15° (diagonales à 45° comprises), longueur au 10 cm", () => {
    // Presque horizontal → horizontal.
    expect(angleSnapPoint([2, 2], [6, 2.3])).toEqual([6, 2])
    // Presque vertical → vertical.
    expect(angleSnapPoint([2, 2], [2.3, 7])).toEqual([2, 7])
    // À peu près 45° → 45° pile, longueur arrondie au 10 cm.
    const d = angleSnapPoint([0, 0], [3, 2.9])
    expect(segmentMeasure([0, 0], d).angle).toBe(45)
    expect(segmentMeasure([0, 0], d).length).toBeCloseTo(4.2, 1)
    // 30° vers le haut de l'écran (angle 330°).
    expect(segmentMeasure([0, 0], angleSnapPoint([0, 0], [4, -2.2])).angle).toBe(330)
    expect(angleSnapPoint(undefined, [3, 3])).toEqual([3, 3])
})

test("cote d'un segment : longueur et angle", () => {
    expect(formatMeasure([0, 0], [3, 4])).toBe("5 m · 53°")
    expect(formatMeasure([1, 1], [1, 3])).toBe("2 m · 90°")
    expect(segmentMeasure([0, 0], [-2, 0]).angle).toBe(180)
})

test("clés de sélection des murs", () => {
    expect(murKey("x")).toBe("m:x")
    expect(isMurKey("m:x")).toBe(true)
    expect(isMurKey("z:x")).toBe(false)
    expect(murIdOf("m:x")).toBe("x")
})
