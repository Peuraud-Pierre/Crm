import { useMemo } from "react"
import { AlertTriangle, CalendarCheck } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useWidgetData } from "@/shared/hooks/useWidgetData"
import { isRouteAllowed } from "@/shared/lib/routeAccess"
import type { WidgetProps } from "@/shared/types/widget.types"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonList } from "@/shared/ui/molecules/skeleton-presets"
import { WidgetList, WidgetRow } from "@/shared/ui/molecules/widget-list"
import {
    fetchTodayEvents,
    type TodayEvent,
} from "../services/todayEventsService"

/** Bornes de la journée en cours, dans le fuseau du navigateur. */
function todayBounds(): { from: string; to: string } {
    const start = new Date()
    start.setHours(0, 0, 0, 0)

    const end = new Date(start)
    end.setDate(end.getDate() + 1)

    return { from: start.toISOString(), to: end.toISOString() }
}

/**
 * Les rendez-vous du jour de l'utilisateur.
 *
 * C'est le module qui a motivé la refonte : un commercial doit voir ses
 * RDV du jour à l'ouverture de l'application, à côté des annonces.
 */
export default function TodayEventsWidget({ compact }: WidgetProps) {
    const { user, allowedRoutes } = useAuth()
    const userId = user?.user_id

    // Calculé une fois par montage : recalculer à chaque rendu relancerait
    // l'effet en boucle (les bornes changent à la milliseconde près).
    const bounds = useMemo(todayBounds, [])

    const { data, loading, error } = useWidgetData(
        userId ? () => fetchTodayEvents(userId, bounds.from, bounds.to) : null,
        [userId, bounds],
        "TodayEventsWidget"
    )
    const events: TodayEvent[] = data ?? []

    if (loading) {
        return (
            <div className="p-3">
                <SkeletonList rows={3} label="Chargement de vos rendez-vous" />
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
                description="Vos rendez-vous n'ont pas pu être récupérés."
            />
        )
    }

    if (events.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={CalendarCheck}
                title="Aucun rendez-vous aujourd'hui"
                description="Votre journée est libre."
            />
        )
    }

    const target = isRouteAllowed("/crm/agenda", allowedRoutes)
        ? "/crm/agenda"
        : undefined

    return (
        <WidgetList>
            {events.map((event) => (
                <WidgetRow
                    key={event.id}
                    to={target}
                    compact={compact}
                    // L'heure remplace l'icône : c'est elle qu'on parcourt
                    // pour situer sa journée, et `tabular-nums` la garde
                    // alignée d'une ligne à l'autre.
                    leading={
                        <span className="inline-block w-12 text-sm font-semibold tabular-nums text-primary">
                            {event.debut
                                ? format(new Date(event.debut), "HH'h'mm", {
                                      locale: fr,
                                  })
                                : "—"}
                        </span>
                    }
                    title={event.nom || event.client || "Rendez-vous"}
                    meta={event.lieu}
                />
            ))}
        </WidgetList>
    )
}
