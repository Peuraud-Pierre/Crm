import { expect, test } from "@rstest/core"
import { equipement } from "../__fixtures__/plan"
import { buildPlanItems } from "./planTree"
import { flightEnds, stairLevels } from "./stairs"

const flight = (id: string, code: string, x: number, y: number, w: number, h: number, rotation = 0) => ({
    ...equipement(id, code, "escalier"),
    pos_x: x,
    pos_y: y,
    width: w,
    height: h,
    rotation,
    groupe: "g",
})

test("une volée part du début de sa flèche et arrive à sa pointe, rotation comprise", () => {
    const [a] = buildPlanItems([], [], [{ ...flight("a", "E1", 0, 0, 4, 1), groupe: null }])
    expect(flightEnds(a)).toMatchObject({ start: [0, 0.5], end: [4, 0.5], length: 4 })
    const [b] = buildPlanItems([], [], [{ ...flight("b", "E1", 0, 0, 4, 1, 180), groupe: null }])
    const ends = flightEnds(b)!
    expect(ends.start[0]).toBeCloseTo(4)
    expect(ends.end[0]).toBeCloseTo(0)
})

test("des volées fusionnées s'enchaînent, dans l'ordre du tracé et non des codes", () => {
    // Escalier en L : E2 (vers la droite) puis E1 (vers le bas) depuis son arrivée.
    const items = buildPlanItems([], [], [flight("a", "E1", 4, 0, 1, 3), flight("b", "E2", 0, 0, 4, 1)])
    const levels = stairLevels(items, 2.8)
    expect(levels.get("q:b")!.start).toBe(0)
    expect(levels.get("q:b")!.height).toBeCloseTo(1.6)
    expect(levels.get("q:a")!.start).toBeCloseTo(1.6)
    expect(levels.get("q:a")!.height).toBeCloseTo(1.2)
})

test("une volée seule n'a pas de niveau imposé", () => {
    const items = buildPlanItems([], [], [{ ...flight("a", "E1", 0, 0, 4, 1), groupe: null }])
    expect(stairLevels(items, 2.8).size).toBe(0)
})

test("un escalier fusionné qui descend s'enfonce volée après volée", () => {
    const items = buildPlanItems([], [], [
        { ...flight("a", "E1", 4, 0, 1, 3), descend: true },
        { ...flight("b", "E2", 0, 0, 4, 1), descend: true },
    ])
    const levels = stairLevels(items, 2.8)
    expect(levels.get("q:b")!.start).toBeCloseTo(0)
    expect(levels.get("q:a")!.start).toBeCloseTo(-1.6)
})
