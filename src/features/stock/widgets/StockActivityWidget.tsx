import { AlertTriangle, History } from "lucide-react"
import { formatDistanceToNowStrict } from "date-fns"
import { fr } from "date-fns/locale"
import { useWidgetData } from "@/shared/hooks/useWidgetData"
import { cn } from "@/shared/lib/utils"
import type { WidgetProps } from "@/shared/types/widget.types"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonList } from "@/shared/ui/molecules/skeleton-presets"
import { WidgetList, WidgetRow } from "@/shared/ui/molecules/widget-list"
import { fetchRecentActivityLogs } from "../services/dashboardWidgetService"
import {
    ACTION_LABEL,
    ENTITY_LABEL,
    type ActivityLog,
} from "../types/history.types"
import { ACTION_COLORS } from "../utils/activityHelpers"

/**
 * Le module montre les dix dernières écritures, quelle que soit sa
 * hauteur : « les dix dernières » est ce qu'il annonce, et un nombre qui
 * changerait avec la taille de la carte rendrait le module illisible d'un
 * jour à l'autre.
 */
const LOG_COUNT = 10

/**
 * Le journal d'activité du stock, en lecture rapide.
 *
 * Les lignes ne sont **pas cliquables**, et c'est délibéré : il n'existe
 * pas de route de détail d'une écriture — tout pointait vers
 * `/stock/historique`, c'est-à-dire vers la même page que le bouton
 * « voir tout » de l'en-tête de carte. Dix liens qui font tous ce que
 * fait déjà la flèche du coin, ce sont dix promesses de précision qui
 * n'en apportent aucune. L'en-tête suffit.
 *
 * L'action porte la couleur (`ACTION_COLORS`), en pastille plutôt qu'en
 * capitales nues : c'est ce qu'on parcourt en diagonale pour repérer une
 * suppression au milieu de neuf modifications.
 */
export default function StockActivityWidget({ compact }: WidgetProps) {
    const { data, loading, error } = useWidgetData(
        () => fetchRecentActivityLogs(LOG_COUNT),
        [],
        "StockActivityWidget"
    )
    const logs: ActivityLog[] = data ?? []

    if (loading) {
        return (
            <div className="p-3">
                <SkeletonList rows={4} label="Chargement du journal" />
            </div>
        )
    }

    if (error) {
        return (
            <EmptyState
                size="sm"
                variant="error"
                icon={AlertTriangle}
                title="Chargement impossible"
                description="Le journal d'activité n'a pas pu être récupéré."
            />
        )
    }

    if (logs.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={History}
                title="Aucune activité"
                description="Le journal du stock est encore vide."
            />
        )
    }

    return (
        <WidgetList>
            {logs.map((log) => (
                <WidgetRow
                    key={log.id}
                    compact={compact}
                    title={
                        <span className="flex items-center gap-2">
                            <span
                                className={cn(
                                    "shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-3xs font-semibold tracking-wide uppercase",
                                    ACTION_COLORS[log.action]
                                )}
                            >
                                {ACTION_LABEL[log.action]}
                            </span>
                            <span className="min-w-0 truncate">
                                {log.entity_label ?? log.description ?? "—"}
                            </span>
                        </span>
                    }
                    meta={ENTITY_LABEL[log.entity_type]}
                    trailing={
                        // Forme stricte (« 3 h », « 2 j ») plutôt que
                        // « il y a environ 3 heures » : en fin de ligne,
                        // à côté de neuf autres, c'est l'écart entre les
                        // valeurs qu'on lit, pas la phrase.
                        formatDistanceToNowStrict(new Date(log.created_at), {
                            locale: fr,
                        })
                    }
                />
            ))}
        </WidgetList>
    )
}
