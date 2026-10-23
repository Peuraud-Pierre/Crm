import { useMemo, useState } from "react"
import { HistoryIcon } from "lucide-react"
import { ActivityFeed as SharedActivityFeed } from "@/shared/ui/organisms/activity-feed"
import { GESTION_THEME } from "@/features/stock/theme"
import type { LogGroup } from "@/features/stock/types/history.types"
import { GroupDetailSheet } from "./GroupDetailSheet"
import {
    ACTION_ICON,
    ACTION_LABEL,
    ENTITY_ICON,
    ENTITY_LABEL,
    timeAgo,
} from "../../utils/activityHelpers"

const VOCABULARY = {
    entityLabel: ENTITY_LABEL as Record<string, string>,
    entityIcon: ENTITY_ICON as Record<string, React.ReactNode>,
    actionLabel: ACTION_LABEL as Record<string, string>,
    actionIcon: ACTION_ICON as Record<string, React.ReactNode>,
}

interface ActivityFeedProps {
    groups: LogGroup[]
    userMap: Map<string, string>
    loading: boolean
}

/**
 * Feed d'activité du stock : le dessin des lignes vit dans
 * `shared/ui/organisms/activity-feed`, partagé avec le stock handpick. Ne
 * restent ici que le vocabulaire du module et sa sheet de détail.
 */
export function ActivityFeed({ groups, userMap, loading }: ActivityFeedProps) {
    const [selectedGroup, setSelectedGroup] = useState<LogGroup | null>(null)

    // Le socle ignore ce qu'est un `count` ou un `entity_label` de ce module :
    // on lui présente les groupes dans sa forme à lui.
    const feedGroups = useMemo(
        () =>
            groups.map((group) => ({
                ...group,
                entityLabel: group.entity_label,
            })),
        [groups],
    )

    return (
        <>
            <SharedActivityFeed
                groups={feedGroups}
                loading={loading}
                vocabulary={VOCABULARY}
                theme={GESTION_THEME}
                userName={(userId) => (userId ? userMap.get(userId) ?? null : null)}
                formatTime={timeAgo}
                empty={{
                    icon: HistoryIcon,
                    title: "Aucune activité enregistrée",
                    description:
                        "Le journal se remplit automatiquement dès qu'une balle, livraison ou catégorie est modifiée.",
                }}
                onSelect={setSelectedGroup}
            />
            <GroupDetailSheet
                group={selectedGroup}
                userMap={userMap}
                open={selectedGroup !== null}
                onClose={() => setSelectedGroup(null)}
            />
        </>
    )
}
