import { expect, test } from "@rstest/core"
import { act, renderHook } from "@testing-library/react"
import { EMPLACEMENTS, ZONES } from "../../__fixtures__/plan"
import { buildPlanItems } from "@/features/magasins/utils/planTree"
import { usePlanEditor } from "./usePlanEditor"

const bounds = { width: 20, depth: 10 }
const items = buildPlanItems(ZONES, EMPLACEMENTS)
const byCode = (code: string) => items.find((i) => i.code === code)!

test("place pose un élément au centre de son parent déjà placé", () => {
    const { result } = renderHook(() => usePlanEditor(items, bounds))
    act(() => result.current.place(byCode("A")))
    act(() => result.current.place(byCode("R1")))

    const r1 = result.current.drafted.find((i) => i.code === "R1")!
    expect(r1.geometry).toMatchObject({ pos_x: 8, pos_y: 4.5, width: 4, height: 1 })
    expect(result.current.changes.map((c) => c.id)).toEqual(["a", "r1"])
})

test("setRect, rotate puis retrait du plan ; reset jette le brouillon", () => {
    const { result } = renderHook(() => usePlanEditor(items, bounds))
    const a = byCode("A")
    act(() => result.current.setRect(a, { x: 1, y: 1, w: 3, h: 2 }))
    act(() => result.current.rotate(result.current.drafted.find((i) => i.key === a.key)!, 90))
    expect(result.current.changes).toEqual([
        { type: "zone", id: "a", geometry: { pos_x: 1, pos_y: 1, width: 3, height: 2, rotation: 90 } },
    ])

    act(() => result.current.setRect(a, null))
    // Revenu à l'état enregistré (non placé) : plus rien à enregistrer.
    expect(result.current.changes).toEqual([])

    act(() => result.current.setRect(a, { x: 1, y: 1, w: 3, h: 2 }))
    act(() => result.current.reset())
    expect(result.current.changes).toEqual([])
})

test("setRotation fixe un angle quelconque, ramené entre 0 et 359°", () => {
    const { result } = renderHook(() => usePlanEditor(items, bounds))
    const a = byCode("A")
    act(() => result.current.setRect(a, { x: 1, y: 1, w: 3, h: 2 }))
    act(() => result.current.setRotation(result.current.drafted.find((i) => i.key === a.key)!, 37))
    expect(result.current.drafted.find((i) => i.key === a.key)?.geometry.rotation).toBe(37)
    act(() => result.current.setRotation(result.current.drafted.find((i) => i.key === a.key)!, -10))
    expect(result.current.drafted.find((i) => i.key === a.key)?.geometry.rotation).toBe(350)
})
