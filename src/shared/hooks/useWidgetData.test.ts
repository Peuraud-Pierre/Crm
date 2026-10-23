// ── useWidgetData.test.ts ─────────────────────────────────────────────────────
// Ce hook existe pour une raison précise : les modules du dashboard rendaient
// un échec de requête comme un état vide, ce qui a masqué une erreur PostgREST
// en production. Le test qui compte est donc celui qui vérifie qu'un rejet
// produit bien un `error` — et pas un simple `data` vide.

import { describe, expect, rstest, test } from "@rstest/core"
import { renderHook, waitFor } from "@testing-library/react"
import { useWidgetData } from "./useWidgetData"

describe("useWidgetData", () => {
    test("expose la donnée résolue et sort du chargement", async () => {
        const { result } = renderHook(() =>
            useWidgetData(() => Promise.resolve([1, 2]), [], "Test")
        )

        expect(result.current.loading).toBe(true)
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.data).toEqual([1, 2])
        expect(result.current.error).toBeNull()
    })

    test("un rejet produit une erreur, et surtout PAS un état vide", async () => {
        const spy = rstest.spyOn(console, "error").mockImplementation(() => {})
        const boom = new Error("PGRST200")

        const { result } = renderHook(() =>
            useWidgetData(() => Promise.reject(boom), [], "Test")
        )

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.error).toBe(boom)
        expect(result.current.data).toBeNull()
        expect(spy).toHaveBeenCalled()

        spy.mockRestore()
    })

    test("un rejet non-Error est enveloppé dans une Error", async () => {
        const spy = rstest.spyOn(console, "error").mockImplementation(() => {})

        const { result } = renderHook(() =>
            useWidgetData(() => Promise.reject("cassé"), [], "Test")
        )

        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(result.current.error).toBeInstanceOf(Error)
        expect(result.current.error?.message).toBe("cassé")

        spy.mockRestore()
    })

    test("un fetcher nul n'exécute rien et laisse le hook en chargement", async () => {
        const { result } = renderHook(() => useWidgetData(null, [], "Test"))

        await Promise.resolve()
        expect(result.current.loading).toBe(true)
        expect(result.current.data).toBeNull()
        expect(result.current.error).toBeNull()
    })

    test("le résultat d'une requête démontée n'est jamais posé", async () => {
        let resolve: (value: string) => void = () => {}
        const pending = new Promise<string>((r) => {
            resolve = r
        })

        const { result, unmount } = renderHook(() =>
            useWidgetData(() => pending, [], "Test")
        )

        unmount()
        resolve("trop tard")
        await pending

        expect(result.current.data).toBeNull()
        expect(result.current.loading).toBe(true)
    })

    test("un changement de dépendance relance la requête sans repasser en chargement", async () => {
        const fetcher = rstest.fn((n: number) => Promise.resolve(n * 10))

        const { result, rerender } = renderHook(
            ({ n }) => useWidgetData(() => fetcher(n), [n], "Test"),
            { initialProps: { n: 1 } }
        )

        await waitFor(() => expect(result.current.data).toBe(10))

        rerender({ n: 2 })
        // La donnée précédente reste affichée pendant la relance : pas de
        // squelette qui clignote à chaque poignée tirée.
        expect(result.current.loading).toBe(false)
        await waitFor(() => expect(result.current.data).toBe(20))
        expect(fetcher).toHaveBeenCalledTimes(2)
    })
})
