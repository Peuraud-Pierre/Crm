import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import * as fournisseurService from "@/features/stock_handpick/services/fournisseurHandpickService"
import type { FournisseurWritable } from "@/features/stock_handpick/services/fournisseurHandpickService"
import type {
    FournisseurCategoryLink,
    FournisseurHandpick,
} from "@/features/stock_handpick/types/referential.types"

/**
 * Hook bas niveau — fetch + mutations via la couche service.
 * La couche optimiste est gérée par useOptimisticCrud dans
 * ReferentialHandpickContext.
 *
 * Les liaisons fournisseur ↔ catégorie sont chargées ici plutôt que dans un
 * hook séparé : elles n'ont pas de cycle de vie propre, elles ne sont lues
 * qu'avec les fournisseurs, et deux hooks auraient produit deux chargements
 * désynchronisés au montage.
 */
export function useFournisseurHandpick() {
    const [fournisseurs, setFournisseurs] = useState<FournisseurHandpick[]>([])
    const [links, setLinks] = useState<FournisseurCategoryLink[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    // ─── Fetch ─────────────────────────────────────────────────────────────────

    const fetchFournisseurs = useCallback(async () => {
        try {
            const [data, linkRows] = await Promise.all([
                fournisseurService.fetchFournisseurs(),
                fournisseurService.fetchFournisseurCategoryLinks(),
            ])
            setFournisseurs(data)
            setLinks(linkRows)
        } catch (error) {
            toast.error("Erreur lors du chargement des usines")
            console.error(error)
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchSingleFournisseur = useCallback(
        async (id: string): Promise<FournisseurHandpick | null> => {
            try {
                return await fournisseurService.fetchSingleFournisseur(id)
            } catch {
                return null
            }
        },
        [],
    )

    // ─── Mutations — throw on error (gérées par useOptimisticCrud) ────────────

    const createFournisseur = useCallback(
        (payload: FournisseurWritable) => fournisseurService.insertFournisseur(payload),
        [],
    )

    const updateFournisseur = useCallback(
        async (id: string, payload: Partial<FournisseurWritable>): Promise<void> => {
            await fournisseurService.patchFournisseur(id, payload)
        },
        [],
    )

    const deleteFournisseur = useCallback(async (id: string): Promise<void> => {
        await fournisseurService.removeFournisseur(id)
    }, [])

    /**
     * Aligne les catégories d'un fournisseur puis recharge les liaisons : la
     * table de liaison n'a pas d'état optimiste, les puces affichées viennent
     * directement de `links`.
     */
    const syncCategories = useCallback(
        async (fournisseurId: string, categoryIds: string[]): Promise<void> => {
            const current = links
                .filter((link) => link.fournisseur_id === fournisseurId)
                .map((link) => link.category_id)

            await fournisseurService.syncFournisseurCategories(fournisseurId, categoryIds, current)
            setLinks(await fournisseurService.fetchFournisseurCategoryLinks())
        },
        [links],
    )

    // ─── Init ──────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (!user?.user_id) return
        fetchFournisseurs()
    }, [user?.user_id, fetchFournisseurs])

    return {
        fournisseurs,
        links,
        loading,
        fetchFournisseurs,
        fetchSingleFournisseur,
        createFournisseur,
        updateFournisseur,
        deleteFournisseur,
        syncCategories,
    }
}
