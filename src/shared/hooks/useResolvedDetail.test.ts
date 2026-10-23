import { expect, rstest, test } from "@rstest/core"
import { renderHook, waitFor } from "@testing-library/react"
import { useResolvedDetail } from "./useResolvedDetail"

/**
 * Un écran chargé par paliers ne doit pas prendre pour un lien mort une
 * ressource réelle mais plus ancienne que son palier. Ce fichier fixe l'ordre :
 * chercher d'abord à l'unité, ne laisser conclure la garde qu'ensuite.
 */

type Row = { id: string }

// Stables : `items` est une dépendance de relecture, un tableau recréé à
// chaque rendu relancerait la lecture en boucle.
const PAGE: Row[] = [{ id: "a" }]

test("une ressource du palier est servie sans lecture unitaire", () => {
    const fetchOne = rstest.fn(async (id: string): Promise<Row | null> => ({ id }))
    const { result } = renderHook(() =>
        useResolvedDetail({ detail: "a", items: PAGE, loaded: true, fetchOne }),
    )

    expect(result.current.loaded).toBe(true)
    expect(result.current.find("a")).toEqual({ id: "a" })
    expect(fetchOne).not.toHaveBeenCalled()
})

test("une ressource hors palier retient le chargement, puis est servie", async () => {
    const fetchOne = rstest.fn(async (id: string): Promise<Row | null> => ({ id }))
    const { result } = renderHook(() =>
        useResolvedDetail({ detail: "ancienne", items: PAGE, loaded: true, fetchOne }),
    )

    // Tant que la lecture n'a pas répondu, la garde ne doit pas conclure.
    expect(result.current.loaded).toBe(false)

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.find("ancienne")).toEqual({ id: "ancienne" })
    expect(fetchOne).toHaveBeenCalledWith("ancienne")
})

test("une ressource introuvable à l'unité laisse la garde nettoyer", async () => {
    const fetchOne = rstest.fn(async (): Promise<Row | null> => null)
    const { result } = renderHook(() =>
        useResolvedDetail({ detail: "fantome", items: PAGE, loaded: true, fetchOne }),
    )

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.find("fantome")).toBeNull()
})

test("rien n'est lu avant que le palier ne soit chargé, ni pour une création", () => {
    const fetchOne = rstest.fn(async (id: string): Promise<Row | null> => ({ id }))
    renderHook(() => useResolvedDetail({ detail: "x", items: undefined, loaded: false, fetchOne }))
    renderHook(() => useResolvedDetail({ detail: "new", items: PAGE, loaded: true, fetchOne }))

    expect(fetchOne).not.toHaveBeenCalled()
})
