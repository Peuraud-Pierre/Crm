import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import * as balleService from "@/features/stock_handpick/services/balleHandpickService"
import { useEmplacementHandpick } from "./useEmplacementHandpick"
import { buildPlanIndex } from "@/features/stock_handpick/utils/planLayout"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"

/**
 * Données de l'onglet Plan : l'arbre de l'entrepôt, et TOUTES les balles
 * rangées, groupées par emplacement.
 *
 * Pas d'abonnement realtime propre : le canal des balles est déjà ouvert par
 * l'inventaire, sous un nom fixe — en ouvrir un second du même nom le
 * fermerait. `refreshKey` (le palier de l'inventaire, recalculé à chaque
 * événement) sert donc de signal de rechargement.
 */
export function usePlanHandpick(refreshKey: unknown) {
    const { zones, emplacements, loading: planLoading, pathFor, fetchPlan } = useEmplacementHandpick()
    const [balles, setBalles] = useState<BalleHandpick[]>([])
    const [ballesLoading, setBallesLoading] = useState(true)
    const requestRef = useRef(0)

    const fetchPlaced = useCallback(async () => {
        const request = ++requestRef.current
        try {
            const rows = await balleService.fetchPlacedBalles()
            if (request === requestRef.current) setBalles(rows)
        } catch (error) {
            if (request !== requestRef.current) return
            toast.error("Erreur lors du chargement des balles du plan")
            console.error(error)
        } finally {
            if (request === requestRef.current) setBallesLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchPlaced()
    }, [fetchPlaced, refreshKey])

    const index = useMemo(() => buildPlanIndex(zones, emplacements), [zones, emplacements])

    const ballesByEmplacement = useMemo(() => {
        const map = new Map<string, BalleHandpick[]>()
        for (const balle of balles) {
            if (!balle.emplacement_id) continue
            const list = map.get(balle.emplacement_id) ?? []
            list.push(balle)
            map.set(balle.emplacement_id, list)
        }
        return map
    }, [balles])

    /** Balles d'un ensemble d'emplacements, dans l'ordre donné. */
    const ballesIn = useCallback(
        (ids: readonly (string | undefined)[]) =>
            ids.flatMap((id) => (id ? ballesByEmplacement.get(id) ?? [] : [])),
        [ballesByEmplacement],
    )

    return {
        index,
        ballesByEmplacement,
        ballesIn,
        pathFor,
        zones,
        emplacements,
        planLoading,
        fetchPlan,
        loading: planLoading || ballesLoading,
        /** Vrai quand aucun emplacement du dessin n'existe en base. */
        isEmpty: index.byPath.size === 0,
    }
}
