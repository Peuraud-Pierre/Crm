import { AlertTriangle, BellOff, Dot } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { cn } from "@/shared/lib/utils"
import { useWidgetData } from "@/shared/hooks/useWidgetData"
import { isRouteAllowed } from "@/shared/lib/routeAccess"
import type { WidgetProps } from "@/shared/types/widget.types"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonList } from "@/shared/ui/molecules/skeleton-presets"
import { WidgetList, WidgetRow } from "@/shared/ui/molecules/widget-list"
import {
    fetchRecentNotifications,
    type NotificationRow,
} from "../services/notificationService"

const ROWS_PER_UNIT = 1.2

/**
 * Les notifications les plus récentes.
 *
 * Le module ne double pas le panneau de l'en-tête : il ne marque rien
 * comme lu et ne supprime rien. Il sert à voir, en arrivant sur
 * l'accueil, ce qui s'est passé — et à sauter directement au bon endroit,
 * puisque chaque notification porte sa propre destination.
 */
export default function RecentNotificationsWidget({
    height,
    compact,
}: WidgetProps) {
    const { user, allowedRoutes } = useAuth()
    const userId = user?.user_id

    const limit = Math.max(3, Math.floor(height * ROWS_PER_UNIT))

    const { data, loading, error } = useWidgetData(
        userId ? () => fetchRecentNotifications(userId, limit) : null,
        [userId, limit],
        "RecentNotificationsWidget"
    )
    const notifications: NotificationRow[] = data ?? []

    if (loading) {
        return (
            <div className="p-3">
                <SkeletonList rows={3} label="Chargement des notifications" />
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
                description="Vos notifications n'ont pas pu être récupérées."
            />
        )
    }

    if (notifications.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={BellOff}
                title="Aucune notification"
                description="Rien de neuf pour le moment."
            />
        )
    }

    return (
        <WidgetList>
            {notifications.map((notification) => {
                // L'URL d'une notification vient de la base : elle est
                // écrite par un trigger SQL ou un service, et rien ne
                // garantit que son destinataire a le droit d'ouvrir la
                // page visée — une notification d'arrivage peut atterrir
                // chez quelqu'un qui n'a pas accès au stock. On ne la
                // suit donc que si elle mène quelque part d'ouvert.
                const url = notification.url?.trim()
                const target =
                    url && isRouteAllowed(url, allowedRoutes) ? url : undefined

                return (
                    <WidgetRow
                        key={notification.id}
                        to={target}
                        compact={compact}
                        leading={
                            <Dot
                                className={cn(
                                    "-mx-1 size-5 shrink-0",
                                    notification.read
                                        ? "text-transparent"
                                        : "text-primary"
                                )}
                                aria-label={
                                    notification.read ? undefined : "Non lue"
                                }
                            />
                        }
                        title={notification.title ?? "Notification"}
                        meta={notification.type}
                        trailing={
                            notification.created_at
                                ? formatDistanceToNow(
                                      new Date(notification.created_at),
                                      { addSuffix: true, locale: fr }
                                  )
                                : undefined
                        }
                    />
                )
            })}
        </WidgetList>
    )
}
