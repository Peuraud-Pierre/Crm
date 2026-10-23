import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { subscribeToTable } from "@/shared/services/realtimeService"
import { MAINTENANCE_CHANNEL, MAINTENANCE_TABLE } from "../../constants"
import {
    deleteMaintenanceWindow,
    fetchMaintenanceWindows,
    insertMaintenanceWindow,
    updateMaintenanceWindow,
} from "../../services/maintenanceService"
import type {
    MaintenanceDraft,
    MaintenanceState,
    MaintenanceUpdate,
    MaintenanceWindow,
} from "../../types/maintenance.types"

/**
 * Orchestration des fenêtres de maintenance.
 *
 * Deux différences de fond avec le hook qu'il remplace
 * (`features/manager/hooks/Manager_hook/useMaintenance.ts`) :
 *
 * 1. **Realtime.** L'ancien hook chargeait la ligne une seule fois au
 *    montage. Activer la maintenance ne mettait donc personne dehors
 *    avant un rechargement — l'exact inverse de ce qu'on attend d'un
 *    mode maintenance. La table est désormais publiée (migration
 *    20260824103000) et l'abonnement bascule les sessions ouvertes.
 *
 * 2. **Erreurs visibles.** L'ancien hook rangeait l'erreur dans un state
 *    que personne n'affichait : une activation de maintenance qui
 *    échouait avait l'apparence d'un succès. Convention maison
 *    désormais appliquée : `console.error` + `toast.error`.
 *
 * Note sur `ends_at` : c'est une information affichée (compte à rebours,
 * communication aux utilisateurs), pas une condition d'application. Ce
 * qui coupe l'accès est `active`, et lui seul — une fenêtre ne se lève
 * pas toute seule. Lever la maintenance est un geste explicite de
 * l'administrateur, immédiatement propagé par le Realtime.
 */
export function useMaintenance() {
    const { user } = useAuth()
    // On dépend de l'identifiant, pas de l'objet `user` : une nouvelle
    // référence à chaque rendu du provider relancerait le chargement et
    // re-souscrirait le canal Realtime en boucle.
    const userId = user?.user_id
    const [windows, setWindows] = useState<MaintenanceWindow[]>([])
    const [loading, setLoading] = useState(true)

    // Garde dernier-arrivé-gagnant : une réponse lente ne doit pas
    // écraser un état plus récent (motif de
    // administration/hooks/data/usePermissions.ts).
    const requestIdRef = useRef(0)

    const refetch = useCallback(async () => {
        const requestId = ++requestIdRef.current
        try {
            const rows = await fetchMaintenanceWindows()
            if (requestIdRef.current !== requestId) return
            setWindows(rows)
        } catch (err) {
            console.error("[useMaintenance] refetch:", err)
            toast.error("Erreur lors du chargement du mode maintenance")
        } finally {
            if (requestIdRef.current === requestId) setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!userId) return
        void refetch()
    }, [userId, refetch])

    // Realtime : toute écriture sur la table rafraîchit l'état complet.
    // La table compte quelques lignes et n'est écrite que rarement — un
    // refetch global est plus sûr qu'un patch par événement, et évite de
    // reconstruire à la main les cas INSERT/UPDATE/DELETE.
    useEffect(() => {
        if (!userId) return
        return subscribeToTable<MaintenanceWindow>(
            MAINTENANCE_CHANNEL,
            MAINTENANCE_TABLE,
            undefined,
            () => {
                void refetch()
            }
        )
    }, [userId, refetch])

    const state: MaintenanceState = useMemo(() => {
        const byFeature: Record<string, MaintenanceWindow> = {}
        let global: MaintenanceWindow | null = null

        for (const w of windows) {
            if (w.scope === "global") {
                global = w
            } else if (w.feature_key) {
                byFeature[w.feature_key] = w
            }
        }

        return { global, byFeature }
    }, [windows])

    /** Une maintenance globale coupe-t-elle l'application ? */
    const isGlobalDown = state.global?.active === true

    /**
     * La feature `key` est-elle coupée ? Une maintenance globale ne rend
     * pas cette fonction vraie : les deux portes sont distinctes et
     * l'appelant (AuthGuardLayout) teste la globale en premier.
     */
    const isFeatureDown = useCallback(
        (key: string | undefined | null): boolean =>
            !!key && state.byFeature[key]?.active === true,
        [state]
    )

    const createWindow = useCallback(
        async (draft: MaintenanceDraft): Promise<boolean> => {
            try {
                await insertMaintenanceWindow(draft)
                await refetch()
                return true
            } catch (err) {
                console.error("[useMaintenance] createWindow:", err)
                toast.error("Erreur lors de la création de la maintenance")
                return false
            }
        },
        [refetch]
    )

    const editWindow = useCallback(
        async (id: string, updates: MaintenanceUpdate): Promise<boolean> => {
            try {
                await updateMaintenanceWindow(id, updates)
                await refetch()
                return true
            } catch (err) {
                console.error("[useMaintenance] editWindow:", err)
                toast.error("Erreur lors de la modification de la maintenance")
                return false
            }
        },
        [refetch]
    )

    const removeWindow = useCallback(
        async (id: string): Promise<boolean> => {
            try {
                await deleteMaintenanceWindow(id)
                await refetch()
                return true
            } catch (err) {
                console.error("[useMaintenance] removeWindow:", err)
                toast.error("Erreur lors de la suppression de la maintenance")
                return false
            }
        },
        [refetch]
    )

    return {
        windows,
        state,
        loading,
        isGlobalDown,
        isFeatureDown,
        refetch,
        createWindow,
        editWindow,
        removeWindow,
    }
}
