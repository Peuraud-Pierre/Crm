import { expect, rstest, test } from "@rstest/core"
import { act, renderHook } from "@testing-library/react"
import { equipement } from "../../__fixtures__/plan"
import { buildPlanItems } from "@/features/magasins/utils/planTree"
import type { PlanMagasinApi } from "@/features/magasins/hooks/data/usePlanMagasin"
import { useStairsMerge } from "./useStairsMerge"

const items = buildPlanItems(
    [],
    [],
    [
        { ...equipement("a", "ESC1", "escalier"), groupe: "g" },
        { ...equipement("b", "ESC2", "escalier"), groupe: "g" },
        equipement("c", "ESC3", "escalier_colimacon"),
        equipement("k", "C1", "caisse"),
    ],
)

function setup() {
    const plan = {
        mergeEquipements: rstest.fn(async () => true),
        ungroupEquipements: rstest.fn(async () => true),
        setStairsDescend: rstest.fn(async () => true),
    } as unknown as PlanMagasinApi
    const select = rstest.fn()
    const hook = renderHook(() => useStairsMerge(plan, items, select))
    const item = (key: string) => items.find((i) => i.key === key)!
    return { hook, plan, select, item }
}

test("« Fusionner avec… » puis un clic sur un autre escalier les réunit", () => {
    const { hook, plan, item } = setup()
    act(() => hook.result.current.controlsFor(item("q:c"))!.start())
    expect(hook.result.current.from?.key).toBe("q:c")
    let consumed = false
    act(() => {
        consumed = hook.result.current.pick("q:b")
    })
    expect(consumed).toBe(true)
    // Le groupe existant (a, b) rejoint l'escalier c.
    expect(plan.mergeEquipements).toHaveBeenCalledWith(["c", "a", "b"])
    expect(hook.result.current.from).toBeNull()
})

test("un clic sur autre chose qu'un escalier ne fusionne rien", () => {
    const { hook, plan, item } = setup()
    act(() => hook.result.current.controlsFor(item("q:c"))!.start())
    act(() => void hook.result.current.pick("q:k"))
    expect(plan.mergeEquipements).not.toHaveBeenCalled()
    expect(hook.result.current.from?.key).toBe("q:c")
})

test("hors fusion, le clic passe ; « Séparer » seulement pour un escalier groupé", () => {
    const { hook, plan, item } = setup()
    expect(hook.result.current.pick("q:a")).toBe(false)
    expect(hook.result.current.controlsFor(item("q:k"))).toBeNull()
    expect(hook.result.current.controlsFor(item("q:c"))?.ungroup).toBeNull()
    hook.result.current.controlsFor(item("q:a"))!.ungroup!()
    expect(plan.ungroupEquipements).toHaveBeenCalledWith("g")
})

test("le sens monte / descend s'applique à toutes les volées de l'escalier", () => {
    const { hook, plan, item } = setup()
    const controls = hook.result.current.controlsFor(item("q:a"))!
    expect(controls.descend).toBe(false)
    controls.setDescend(true)
    expect(plan.setStairsDescend).toHaveBeenCalledWith(["a", "b"], true)
})
