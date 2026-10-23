import { expect, test } from "@rstest/core"
import { PILE_MAX, bagsFor, pileSlots } from "./pileLayout"

/**
 * Plan 3D : un sac dessiné pour deux balles, rangés en longueur puis
 * empilés, 3 × 3 au plus — atteint pour un emplacement plein (18 à 25).
 */

test("un sac pour deux balles", () => {
    expect([0, 1, 2, 3, 4, 5].map(bagsFor)).toEqual([0, 1, 1, 2, 2, 3])
})

test("un emplacement plein (18 à 25 balles) s'affiche en 3 × 3", () => {
    for (const count of [18, 21, 25]) expect(bagsFor(count)).toBe(PILE_MAX)
    expect(bagsFor(16)).toBe(8)
})

test("les sacs se rangent en longueur, centrés, puis s'empilent", () => {
    expect(pileSlots(2)).toEqual([{ col: 0, layer: 0 }])
    expect(pileSlots(6).map((s) => s.col)).toEqual([-1, 0, 1])

    const five = pileSlots(10)
    expect(five.filter((s) => s.layer === 0)).toHaveLength(3)
    expect(five.filter((s) => s.layer === 1).map((s) => s.col)).toEqual([-0.5, 0.5])
})

test("jamais plus de 3 × 3, même sur-rempli", () => {
    const slots = pileSlots(60)

    expect(slots).toHaveLength(PILE_MAX)
    expect(Math.max(...slots.map((s) => s.layer))).toBe(2)
    expect(Math.max(...slots.map((s) => Math.abs(s.col)))).toBe(1)
})

test("aucune balle, aucun sac", () => {
    expect(pileSlots(0)).toEqual([])
})
