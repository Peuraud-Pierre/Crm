import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import * as categorieService from "@/features/stock_handpick/services/categorieHandpickService"
import type { CategoryWritable } from "@/features/stock_handpick/services/categorieHandpickService"
import type { CategoryHandpick } from "@/features/stock_handpick/types/referential.types"

/**
 * Hook bas niveau — fetch + mutations via la couche service.
 * La couche optimiste est gérée par useOptimisticCrud dans
 * ReferentialHandpickContext.
 */
export function useCategorieHandpick() {
    const [categories, setCategories] = useState<CategoryHandpick[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    // ─── Fetch ─────────────────────────────────────────────────────────────────

    const fetchCategories = useCallback(async () => {
        try {
            setCategories(await categorieService.fetchCategories())
        } catch (error) {
            toast.error("Erreur lors du chargement des catégories")
            console.error(error)
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchSingleCategory = useCallback(
        async (id: string): Promise<CategoryHandpick | null> => {
            try {
                return await categorieService.fetchSingleCategory(id)
            } catch {
                return null
            }
        },
        [],
    )

    // ─── Mutations — throw on error (gérées par useOptimisticCrud) ────────────

    const createCategory = useCallback(
        (payload: CategoryWritable) => categorieService.insertCategory(payload),
        [],
    )

    const updateCategory = useCallback(
        async (id: string, payload: Partial<CategoryWritable>): Promise<void> => {
            await categorieService.patchCategory(id, payload)
        },
        [],
    )

    const deleteCategory = useCallback(async (id: string): Promise<void> => {
        await categorieService.removeCategory(id)
    }, [])

    // ─── Init ──────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!user?.user_id) return
        fetchCategories()
    }, [user?.user_id, fetchCategories])

    return {
        categories,
        loading,
        fetchCategories,
        fetchSingleCategory,
        createCategory,
        updateCategory,
        deleteCategory,
    }
}
