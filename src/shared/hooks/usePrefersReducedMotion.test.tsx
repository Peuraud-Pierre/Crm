import { beforeEach, expect, test } from "@rstest/core"
import { act, renderHook } from "@testing-library/react"

type Listener = () => void

const listeners = new Set<Listener>()
let addCalls = 0
let removeCalls = 0
let matches = false

// Le module capture `window.matchMedia` À L'IMPORT (MediaQueryList unique
// pour tout l'arbre). Le mock doit donc être posé avant, et le hook chargé
// par un import dynamique — un `import` statique serait hissé au-dessus.
window.matchMedia = ((query: string) => ({
    get matches() {
        return matches
    },
    media: query,
    addEventListener: (_: string, listener: Listener) => {
        addCalls += 1
        listeners.add(listener)
    },
    removeEventListener: (_: string, listener: Listener) => {
        removeCalls += 1
        listeners.delete(listener)
    },
})) as unknown as typeof window.matchMedia

const { usePrefersReducedMotion } = await import("./usePrefersReducedMotion")

beforeEach(() => {
    addCalls = 0
    removeCalls = 0
    matches = false
})

test("rend la préférence courante", () => {
    matches = true
    const { result, unmount } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(true)
    unmount()
})

test("propage un changement de préférence à l'abonné", () => {
    const { result, unmount } = renderHook(() => usePrefersReducedMotion())
    expect(result.current).toBe(false)

    act(() => {
        matches = true
        listeners.forEach((l) => l())
    })

    expect(result.current).toBe(true)
    unmount()
})

test("n'attache qu'un seul listener natif quel que soit le nombre d'abonnés", () => {
    // C'est la raison d'être du hook : `useReducedMotion` de framer-motion
    // alloue un matchMedia + un listener PAR site d'appel, soit un par ligne
    // dans une liste (DESIGN_SYSTEM.md §13.5).
    const a = renderHook(() => usePrefersReducedMotion())
    const b = renderHook(() => usePrefersReducedMotion())
    const c = renderHook(() => usePrefersReducedMotion())

    expect(addCalls).toBe(1)
    expect(removeCalls).toBe(0)

    a.unmount()
    b.unmount()
    expect(removeCalls).toBe(0)

    // Le listener natif n'est détaché qu'au départ du dernier abonné.
    c.unmount()
    expect(removeCalls).toBe(1)
})
