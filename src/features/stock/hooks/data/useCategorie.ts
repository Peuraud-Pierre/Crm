import { useCallback, useEffect, useState } from "react"
import type { BalleCategory } from "@/features/stock/types/stock.types"
import * as categorieService from "@/features/stock/services/categorieService"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { toast } from "sonner"

/**
 * Hook bas niveau — fetch + mutations via la couche service.
 * La couche optimiste est gérée par useOptimisticCrud dans ReferentialContext.
 */
export function useCategorie() {
    const [categories, setCategories] = useState<BalleCategory[]>([])
    const { user } = useAuth()

    // ─── Fetch all ─────────────────────────────────────────────────────────────

    const fetchCategories = useCallback(async () => {
        try {
            const data = await categorieService.fetchCategories()
            setCategories(data)
        } catch (error) {
            toast.error("Erreur lors du chargement des catégories")
            console.error(error)
        }
    }, [user?.user_id])

    // ─── Fetch single ──────────────────────────────────────────────────────────

    const fetchSingleCategory = useCallback(async (id: string): Promise<BalleCategory | null> => {
        try {
            return await categorieService.fetchSingleCategory(id)
        } catch {
            return null
        }
    }, [user?.user_id])

    // ─── Create — throws on error ──────────────────────────────────────────────

    const createCategory = useCallback(async (
        payload: Omit<BalleCategory, "id">
    ): Promise<BalleCategory | null> => {
        return categorieService.insertCategory(payload)
    }, [user?.user_id])

    // ─── Update — throws on error ──────────────────────────────────────────────

    const updateCategory = useCallback(async (
        id: string,
        payload: Partial<Omit<BalleCategory, "id">>
    ): Promise<void> => {
        await categorieService.patchCategory(id, payload)
    }, [user?.user_id])

    // ─── Delete — throws on error ──────────────────────────────────────────────

    const deleteCategory = useCallback(async (id: string): Promise<void> => {
        await categorieService.removeCategory(id)
    }, [user?.user_id])

    // ─── Init ──────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!user?.user_id) return
        fetchCategories()
    }, [user?.user_id, fetchCategories])

    return {
        categories,
        fetchCategories,
        fetchSingleCategory,
        createCategory,
        updateCategory,
        deleteCategory,
    }
}
