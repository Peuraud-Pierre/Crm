import { expect, test } from "@rstest/core"
import { equipement } from "../__fixtures__/plan"
import { buildPlanItems } from "./planTree"
import { groupRects, isStairs, mergedIds, selectionKeys } from "./group"

const at = (id: string, code: string, x: number, groupe: string | null, kind: "escalier" | "caisse" = "escalier") => ({
    ...equipement(id, code, kind),
    pos_x: x,
    pos_y: 1,
    width: 1,
    height: 3,
    groupe,
})
const items = buildPlanItems([], [], [at("a", "ESC1", 1, "g"), at("b", "ESC2", 3, "g"), at("c", "ESC3", 8, null), at("k", "C1", 10, null, "caisse")])
const byId = (id: string) => items.find((i) => i.id === id)!
const bounds = { width: 20, depth: 10 }

test("un groupe n'a qu'une étiquette : son premier code", () => {
    expect(items.map((i) => [i.code, i.groupLeader])).toEqual([
        ["C1", true],
        ["ESC1", true],
        ["ESC2", false],
        ["ESC3", true],
    ])
})

test("sélectionner une volée met en évidence tout l'escalier", () => {
    expect([...selectionKeys("q:b", items)].sort()).toEqual(["q:a", "q:b"])
    expect([...selectionKeys("q:c", items)]).toEqual(["q:c"])
    expect(selectionKeys(null, items).size).toBe(0)
})

test("déplacer une volée emporte le groupe ; la redimensionner ne touche qu'elle", () => {
    const moved = groupRects(byId("a"), { x: 2, y: 2, w: 1, h: 3 }, items, bounds)
    expect(moved.map((m) => [m.item.id, m.rect.x, m.rect.y])).toEqual([
        ["a", 2, 2],
        ["b", 4, 2],
    ])
    expect(groupRects(byId("a"), { x: 1, y: 1, w: 2, h: 3 }, items, bounds)).toHaveLength(1)
    expect(groupRects(byId("c"), { x: 9, y: 1, w: 1, h: 3 }, items, bounds)).toHaveLength(1)
})

test("fusionner rejoint les groupes ; seuls les escaliers sont concernés", () => {
    expect(mergedIds(byId("c"), byId("b"), items).sort()).toEqual(["a", "b", "c"])
    expect(isStairs(byId("a"))).toBe(true)
    expect(isStairs(byId("k"))).toBe(false)
})
