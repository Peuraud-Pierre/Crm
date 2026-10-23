import { expect, rstest, test } from "@rstest/core"
import { act, renderHook } from "@testing-library/react"
import { useOptimisticCrud } from "./useOptimisticCrud"

/**
 * Ce que le CRUD optimiste doit garantir à ses appelants : un élément créé
 * apparaît sans rechargement, et chaque écriture dit si elle a abouti — c'est
 * ce qui permet à un formulaire de rester ouvert quand la base refuse.
 */

type Item = { id: string; name: string }
type ItemInput = { name: string }

// Constantes de module : le hook resynchronise sur l'identité de `serverItems`
// et dépend de celle de `api`. Les recréer à chaque rendu fausserait le test.
const SERVER: Item[] = [{ id: "a", name: "Alpha" }]

function makeApi(over: Partial<Record<"create" | "update" | "delete" | "refetch", unknown>> = {}) {
    return {
        create: rstest.fn(async (input: ItemInput): Promise<Item | null> => ({ id: "new", ...input })),
        update: rstest.fn(async () => {}),
        delete: rstest.fn(async () => {}),
        refetch: rstest.fn(async () => {}),
        ...over,
    } as {
        create: (input: ItemInput) => Promise<Item | null>
        update: (id: string, item: Partial<Item>) => Promise<void>
        delete: (id: string) => Promise<void>
        refetch: () => Promise<void>
    }
}

test("un élément créé apparaît dans la liste sans attendre de rechargement", async () => {
    // Régression : `create` rendait l'élément sans l'ajouter. Sur une table
    // sans realtime (les référentiels), il restait invisible jusqu'au reload.
    const api = makeApi()
    const { result } = renderHook(() => useOptimisticCrud<Item, ItemInput>(SERVER, api))

    let created: Item | null = null
    await act(async () => {
        created = await result.current.create({ name: "Bravo" })
    })

    expect(created).toEqual({ id: "new", name: "Bravo" })
    expect(result.current.items.map((item) => item.id)).toEqual(["new", "a"])
})

test("une création refusée rend null, signale l'erreur et ne touche pas la liste", async () => {
    const onError = rstest.fn()
    const api = makeApi({ create: rstest.fn(async () => { throw new Error("23505") }) })
    const { result } = renderHook(() => useOptimisticCrud<Item, ItemInput>(SERVER, api, onError))

    let created: Item | null = { id: "sentinel", name: "" }
    await act(async () => {
        created = await result.current.create({ name: "Alpha" })
    })

    expect(created).toBeNull()
    expect(onError).toHaveBeenCalledWith("create", expect.any(Error))
    expect(result.current.items).toEqual(SERVER)
})

test("une modification refusée rend false et restaure la valeur précédente", async () => {
    const api = makeApi({ update: rstest.fn(async () => { throw new Error("42501") }) })
    const { result } = renderHook(() => useOptimisticCrud<Item, ItemInput>(SERVER, api))

    let ok = true
    await act(async () => {
        ok = await result.current.update("a", { name: "Changé" })
    })

    expect(ok).toBe(false)
    expect(result.current.items).toEqual(SERVER)
})

test("une modification aboutie rend true et garde la nouvelle valeur", async () => {
    const api = makeApi()
    const { result } = renderHook(() => useOptimisticCrud<Item, ItemInput>(SERVER, api))

    let ok = false
    await act(async () => {
        ok = await result.current.update("a", { name: "Changé" })
    })

    expect(ok).toBe(true)
    expect(result.current.items).toEqual([{ id: "a", name: "Changé" }])
})

test("une suppression refusée rend false et remet l'élément", async () => {
    const api = makeApi({ delete: rstest.fn(async () => { throw new Error("23503") }) })
    const { result } = renderHook(() => useOptimisticCrud<Item, ItemInput>(SERVER, api))

    let ok = true
    await act(async () => {
        ok = await result.current.remove("a")
    })

    expect(ok).toBe(false)
    expect(result.current.items).toEqual(SERVER)
})
