import { expect, rstest, test } from "@rstest/core"
import { act, renderHook } from "@testing-library/react"
import { equipement } from "../../__fixtures__/plan"
import { buildPlanItems } from "@/features/magasins/utils/planTree"
import type { PlanMagasinApi } from "@/features/magasins/hooks/data/usePlanMagasin"
import { usePointEditing } from "./usePointEditing"

const placed = { ...equipement("c1", "C1", "caisse"), pos_x: 4, pos_y: 4, width: 2, height: 1 }
const [caisse] = buildPlanItems([], [], [placed])
const [enL] = buildPlanItems([], [], [{ ...placed, forme: [[0, 0], [1, 0], [1, 0.5], [0, 0.5]] }])

function setup(item = caisse, editing = true) {
    const plan = { updateShape: rstest.fn(async () => true), updateMur: rstest.fn() } as unknown as PlanMagasinApi
    const discard = rstest.fn()
    const hook = renderHook(() => usePointEditing({ editing, tool: null, selected: item, selectedWall: null, plan, discard }))
    return { hook, plan, discard }
}

test("« Modifier les angles » part des quatre coins du rectangle", () => {
    const { hook } = setup()
    expect(hook.result.current.shapeEdit).toBeNull()
    act(() => hook.result.current.corners?.toggle())
    expect(hook.result.current.shapeItem?.key).toBe("q:c1")
    expect(hook.result.current.shapeEdit?.points).toEqual([[4, 4], [6, 4], [6, 5], [4, 5]])
})

test("un angle déplacé enregistre la forme et oublie la position en brouillon", async () => {
    const { hook, plan, discard } = setup()
    act(() => hook.result.current.corners?.toggle())
    await act(() => hook.result.current.shapeEdit!.onChange([[4, 4], [6, 4], [6, 5], [5, 5], [4, 4.5]]))
    expect(plan.updateShape).toHaveBeenCalledWith(caisse, [[4, 4], [6, 4], [6, 5], [5, 5], [4, 4.5]])
    expect(discard).toHaveBeenCalledWith("q:c1")
})

test("une forme libre peut redevenir un rectangle ; un rectangle n'a rien à remettre", async () => {
    expect(setup().hook.result.current.corners?.reset).toBeNull()
    const { hook, plan } = setup(enL)
    await act(async () => {
        await hook.result.current.corners?.reset?.()
    })
    expect(plan.updateShape).toHaveBeenCalledWith(enL, null)
})

test("hors mode édition, pas d'édition des angles", () => {
    const { hook } = setup(caisse, false)
    act(() => hook.result.current.corners?.toggle())
    expect(hook.result.current.shapeEdit).toBeNull()
})
