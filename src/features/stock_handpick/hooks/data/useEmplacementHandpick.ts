import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import * as planService from "@/features/stock_handpick/services/planHandpickService"
import {
    buildEmplacementOptions,
    buildEmplacementPaths,
    buildZoneTree,
} from "@/features/stock_handpick/utils/planHelpers"
import type { Emplacement, ZoneNode } from "@/features/stock_handpick/types/location.types"

/**
 * Plan de l'entrepôt en lecture. Aucune UI de plan n'existe en V1 : le seul
 * consommateur est le select d'emplacement de l'Inventaire. L'arbre complet
 * est néanmoins exposé, pour que le futur éditeur 2D n'ait qu'à s'y brancher.
 */
export function useEmplacementHandpick() {
    const [zones, setZones] = useState<ZoneNode[]>([])
    const [emplacements, setEmplacements] = useState<Emplacement[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    const fetchPlan = useCallback(async () => {
        try {
            const [zoneRows, emplacementRows] = await Promise.all([
                planService.fetchZones(),
                planService.fetchEmplacements(),
            ])
            setZones(zoneRows)
            setEmplacements(emplacementRows)
        } catch (error) {
            toast.error("Erreur lors du chargement du plan de l'entrepôt")
            console.error(error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!user?.user_id) return
        fetchPlan()
    }, [user?.user_id, fetchPlan])

    const tree = useMemo(() => buildZoneTree(zones, emplacements), [zones, emplacements])
    const paths = useMemo(() => buildEmplacementPaths(zones, emplacements), [zones, emplacements])
    const options = useMemo(
        () => buildEmplacementOptions(zones, emplacements),
        [zones, emplacements],
    )

    /** Chemin lisible d'un emplacement — « A · 01 · 3 · P02 ». */
    const pathFor = useCallback(
        (emplacementId: string | null | undefined) =>
            emplacementId ? paths.get(emplacementId)?.full_code ?? null : null,
        [paths],
    )

    /** Segments du chemin d'un emplacement — ["B", "R2", "E3", "H1"]. */
    const segmentsFor = useCallback(
        (emplacementId: string | null | undefined) =>
            emplacementId ? paths.get(emplacementId)?.segments ?? null : null,
        [paths],
    )

    return { zones, emplacements, tree, options, loading, pathFor, segmentsFor, fetchPlan }
}
