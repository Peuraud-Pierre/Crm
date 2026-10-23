import { useCallback } from "react"
import {
    fetchPackingModelReport,
    packingApiConfigured,
    type GuardOverrides,
} from "@/features/packing-admin/services/packingAdminApi"
import { useAbortableResource } from "@/features/packing-admin/hooks/useAbortableResource"
import type { PackingModelStats } from "@/features/packing-admin/types"

/**
 * Ce que le modèle sait, avec ou sans surcharge de garde.
 *
 * Sans `overrides`, c'est l'état de production. Avec, c'est une SIMULATION : la
 * réponse porte `simulated: true` et l'écran doit l'afficher comme telle. Le
 * service met les lignes d'entraînement en cache, donc faire varier un seuil ne
 * relit pas la base — seul l'entraînement est refait.
 *
 * `overrides` doit être STABLE entre deux rendus (un objet recréé à chaque rendu
 * relancerait la requête en boucle) : les appelants le mémoïsent.
 */
export function usePackingModelReport(overrides?: GuardOverrides) {
    const load = useCallback(
        (signal: AbortSignal) => fetchPackingModelReport(overrides, signal),
        [overrides],
    )

    const resource = useAbortableResource<PackingModelStats>(load, {
        enabled: packingApiConfigured(),
    })

    return {
        model: resource.data,
        loading: resource.loading,
        error: resource.error,
        refetch: resource.refetch,
    }
}
