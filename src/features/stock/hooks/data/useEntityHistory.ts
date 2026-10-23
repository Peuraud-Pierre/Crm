import { useEffect, useState } from "react"
import { fetchEntityLogs, fetchUserNameMap } from "@/features/stock/services/historyService"
import type { ActivityLog } from "@/features/stock/types/history.types"

interface Loaded {
    key: string
    logs: ActivityLog[]
    userNames: Map<string, string>
}

const NO_NAMES = new Map<string, string>()

/**
 * Historique d'une ou plusieurs entités (une fiche de tri ; une livraison et
 * ses cartons), pour les fiches de détail. Relu quand `version` change :
 * l'appelant le fait varier à chaque mise à jour de l'objet affiché.
 *
 * Le chargement est DÉRIVÉ (la clé chargée n'est pas celle demandée) plutôt
 * que posé dans l'effet : une relecture garde l'historique précédent affiché
 * jusqu'à l'arrivée du nouveau, sans clignotement.
 */
export function useEntityHistory(entityType: string, entityIds: readonly string[], version?: string) {
    const ids = entityIds.join(",")
    const key = `${entityType}:${ids}`
    const [loaded, setLoaded] = useState<Loaded | null>(null)

    useEffect(() => {
        if (!ids) return
        let cancelled = false
        Promise.all([fetchEntityLogs(entityType, ids.split(",")), fetchUserNameMap()])
            .then(([logs, userNames]) => {
                if (!cancelled) setLoaded({ key, logs, userNames })
            })
            .catch((error: unknown) => {
                console.error(error)
                if (!cancelled) setLoaded({ key, logs: [], userNames: NO_NAMES })
            })
        return () => {
            cancelled = true
        }
    }, [entityType, ids, key, version])

    const current = ids && loaded?.key === key ? loaded : null
    return {
        logs: current?.logs ?? [],
        userNames: current?.userNames ?? NO_NAMES,
        loading: !!ids && current === null,
    }
}
