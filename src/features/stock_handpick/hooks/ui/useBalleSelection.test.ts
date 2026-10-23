import { expect, test } from "@rstest/core"
import { act, renderHook } from "@testing-library/react"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import { isMovable, useBalleSelection } from "./useBalleSelection"

const balle = (id: string, over: Partial<BalleHandpick> = {}) =>
    ({ id, borrowed_by: null, is_eclatee: false, ...over }) as BalleHandpick

test("seules les balles ni empruntées ni éclatées sont déplaçables", () => {
    expect(isMovable(balle("a"))).toBe(true)
    expect(isMovable(balle("b", { borrowed_by: "u1" }))).toBe(false)
    expect(isMovable(balle("c", { is_eclatee: true }))).toBe(false)
})

test("cocher, décocher, et une balle non déplaçable reste hors sélection", () => {
    const { result } = renderHook(() => useBalleSelection())

    act(() => result.current.start())
    act(() => result.current.toggle(balle("a")))
    act(() => result.current.toggle(balle("b")))
    act(() => result.current.toggle(balle("c", { is_eclatee: true })))
    expect([...result.current.selected]).toEqual(["a", "b"])

    act(() => result.current.toggle(balle("a")))
    expect([...result.current.selected]).toEqual(["b"])
})

test("quitter le mode sélection vide la sélection", () => {
    const { result } = renderHook(() => useBalleSelection())

    act(() => result.current.start())
    act(() => result.current.toggle(balle("a")))
    act(() => result.current.stop())

    expect(result.current.active).toBe(false)
    expect(result.current.selected.size).toBe(0)
})
