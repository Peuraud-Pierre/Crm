import { useCallback, useEffect, useState } from "react"
import type { Fournisseur } from "@/features/stock/types/stock.types"
import * as fournisseurService from "@/features/stock/services/fournisseurService"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { toast } from "sonner"

/**
 * Hook bas niveau — fetch + mutations via la couche service.
 * La couche optimiste est gérée par useOptimisticCrud dans ReferentialContext.
 */
export function useFournisseur() {
    const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
    const { user } = useAuth()

    // ─── Fetch all ─────────────────────────────────────────────────────────────

    const fetchFournisseurs = useCallback(async () => {
        try {
            const data = await fournisseurService.fetchFournisseurs()
            setFournisseurs(data)
        } catch (error) {
            toast.error("Erreur lors du chargement des fournisseurs")
            console.error(error)
        }
    }, [user?.user_id])

    // ─── Fetch single ──────────────────────────────────────────────────────────

    const fetchSingleFournisseur = useCallback(async (id: string): Promise<Fournisseur | null> => {
        try {
            return await fournisseurService.fetchSingleFournisseur(id)
        } catch {
            return null
        }
    }, [user?.user_id])

    // ─── Create — throws on error (géré par useOptimisticCrud) ────────────────

    const createFournisseur = useCallback(async (
        payload: Omit<Fournisseur, "id" | "created_at">
    ): Promise<Fournisseur | null> => {
        return fournisseurService.insertFournisseur(payload)
    }, [user?.user_id])

    // ─── Update — throws on error ──────────────────────────────────────────────

    const updateFournisseur = useCallback(async (
        id: string,
        payload: Partial<Omit<Fournisseur, "id" | "created_at">>
    ): Promise<void> => {
        await fournisseurService.patchFournisseur(id, payload)
    }, [user?.user_id])

    // ─── Delete — throws on error ──────────────────────────────────────────────

    const deleteFournisseur = useCallback(async (id: string): Promise<void> => {
        await fournisseurService.removeFournisseur(id)
    }, [user?.user_id])

    // ─── Init ──────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!user?.user_id) return
        fetchFournisseurs()
    }, [user?.user_id, fetchFournisseurs])

    return {
        fournisseurs,
        fetchFournisseurs,
        fetchSingleFournisseur,
        createFournisseur,
        updateFournisseur,
        deleteFournisseur,
    }
}
