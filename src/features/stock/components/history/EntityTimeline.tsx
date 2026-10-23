import { useMemo } from "react"
import { useEntityHistory } from "@/features/stock/hooks/data/useEntityHistory"
import { groupLogs } from "@/features/stock/utils/historyHelpers"
import type { ActivityEntityType } from "@/features/stock/types/history.types"
import { ActivityFeed } from "./ActivityFeed"

interface EntityTimelineProps {
    entityType: ActivityEntityType
    /** Une entité (une fiche) ou plusieurs (les cartons d'une livraison). */
    entityIds: readonly string[]
    /** Change à chaque mise à jour de l'objet affiché : relit le journal. */
    version?: string
}

/**
 * Ce qui est arrivé à un objet précis, dans le dessin du journal du stock :
 * les fiches de détail montrent leur propre histoire sans renvoyer vers
 * l'onglet Historique. Mêmes regroupements, même sheet de détail.
 */
export function EntityTimeline({ entityType, entityIds, version }: EntityTimelineProps) {
    const { logs, userNames, loading } = useEntityHistory(entityType, entityIds, version)
    const groups = useMemo(() => groupLogs(logs), [logs])
    return <ActivityFeed groups={groups} userMap={userNames} loading={loading} />
}
