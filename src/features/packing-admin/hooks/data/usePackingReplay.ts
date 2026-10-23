import { useCallback } from "react"
import { REPLAY_LIMIT } from "@/features/packing-admin/constants"
import {
    fetchPackingReplay,
    packingApiConfigured,
    type GuardOverrides,
} from "@/features/packing-admin/services/packingAdminApi"
import { useAbortableResource } from "@/features/packing-admin/hooks/useAbortableResource"
import type { PackingReplayReport } from "@/features/packing-admin/types"

/**
 * Le rejeu de l'historique validé : ce que le classement aurait fait, conteneur
 * après conteneur.
 *
 * C'est la seule source honnête de la courbe de progrès. `classifier_meta`
 * consigne ce que le moteur a réellement fait AU MOMENT de chaque import, donc
 * mélange plusieurs états successifs du modèle — le tracer donnerait une courbe
 * qui parle autant des versions du code que de l'apprentissage. Le rejeu, lui,
 * recalcule un contrefactuel cohérent avec les réglages d'aujourd'hui.
 *
 * Pas de sondage : le résultat ne change qu'à la validation d'une packing
 * entière, un événement rare. Le service le met en cache 5 minutes.
 */
export function usePackingReplay(overrides?: GuardOverrides, limit: number = REPLAY_LIMIT) {
    const load = useCallback(
        (signal: AbortSignal) => fetchPackingReplay(limit, overrides, signal),
        [limit, overrides],
    )

    const resource = useAbortableResource<PackingReplayReport>(load, {
        enabled: packingApiConfigured(),
    })

    return {
        replay: resource.data,
        loading: resource.loading,
        error: resource.error,
        refetch: resource.refetch,
    }
}
