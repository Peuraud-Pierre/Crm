import { useCallback, useEffect, useRef, useState } from "react"
import { wikiService } from "../../services/wikiService"
import { applyMoves, byPositionThenName } from "../../utils/wikiTree"
import type {
    WikiCategory,
    WikiCategoryFormInput,
    WikiCategoryMove,
} from "../../types/wiki-category.types"

/**
 * Orchestre wikiService pour les catégories de wiki (CRUD + état local).
 * Aucun appel Supabase direct : tout passe par le service.
 */
export function useWikiCategories() {
    const [categories, setCategories] = useState<WikiCategory[]>([])
    // Miroir de `categories` pour le rollback optimiste : lire l'état dans
    // l'updater de setState n'est pas fiable (un updater peut être rejoué).
    const categoriesRef = useRef<WikiCategory[]>([])
    useEffect(() => {
        categoriesRef.current = categories
    }, [categories])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchCategories = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            setCategories(await wikiService.listCategories())
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)))
        } finally {
            setLoading(false)
        }
    }, [])

    const createCategory = useCallback(async (input: WikiCategoryFormInput) => {
        const created = await wikiService.createCategory(input)
        setCategories((prev) => [...prev, created].sort(byPositionThenName))
        return created
    }, [])

    const updateCategory = useCallback(
        async (id: string, input: Partial<WikiCategoryFormInput>) => {
            await wikiService.updateCategory(id, input)
            // Fusion des seuls champs définis (renommage = { name }).
            const patch = Object.fromEntries(
                Object.entries(input).filter(([, v]) => v !== undefined)
            )
            setCategories((prev) =>
                prev
                    .map((c) => (c.id === id ? { ...c, ...patch } : c))
                    .sort(byPositionThenName)
            )
        },
        []
    )

    /**
     * Applique un déplacement de catégories. Optimiste : le drop doit être
     * instantané à l'écran, donc on réécrit l'état local avant l'aller-retour
     * réseau, et on restaure le snapshot si le serveur refuse (cycle, droits).
     */
    const reorderCategories = useCallback(async (moves: WikiCategoryMove[]) => {
        if (moves.length === 0) return
        const snapshot = categoriesRef.current
        setCategories(applyMoves(snapshot, moves))
        try {
            await wikiService.reorderCategories(moves)
        } catch (err) {
            setCategories(snapshot)
            throw err
        }
    }, [])

    // Refetch volontaire ici : supprimer une catégorie a un effet de bord
    // côté serveur sur les articles rattachés (FK), qu'une mise à jour locale
    // ne peut pas refléter de façon fiable.
    const deleteCategory = useCallback(
        async (id: string) => {
            await wikiService.deleteCategory(id)
            await fetchCategories()
        },
        [fetchCategories]
    )

    useEffect(() => {
        fetchCategories()
    }, [fetchCategories])

    return {
        categories,
        loading,
        error,
        fetchCategories,
        createCategory,
        updateCategory,
        reorderCategories,
        deleteCategory,
    }
}
