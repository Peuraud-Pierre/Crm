import { AlertTriangle, CheckCircle2, ListChecks } from "lucide-react"
import { format, isBefore, startOfToday } from "date-fns"
import { fr } from "date-fns/locale"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useWidgetData } from "@/shared/hooks/useWidgetData"
import { isRouteAllowed } from "@/shared/lib/routeAccess"
import type { WidgetProps } from "@/shared/types/widget.types"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonList } from "@/shared/ui/molecules/skeleton-presets"
import { WidgetList, WidgetRow } from "@/shared/ui/molecules/widget-list"
import { fetchUpcomingTachesByOwner } from "../services/tacheService"
import type { Tache } from "../types/task"

/** Nombre de lignes tenant dans une unité de hauteur. */
const ROWS_PER_UNIT = 1.2

/**
 * Les tâches CRM ouvertes de l'utilisateur, échéance la plus proche
 * d'abord.
 *
 * La hauteur allouée pilote le nombre de lignes demandées : un module
 * réglé sur trois unités ne doit pas charger cinquante tâches pour en
 * afficher quatre.
 */
export default function CrmTasksWidget({ height, compact }: WidgetProps) {
    const { user, allowedRoutes } = useAuth()
    const userId = user?.user_id

    const limit = Math.max(3, Math.floor(height * ROWS_PER_UNIT))

    const { data, loading, error } = useWidgetData(
        userId ? () => fetchUpcomingTachesByOwner(userId, limit) : null,
        [userId, limit],
        "CrmTasksWidget"
    )
    const tasks: Tache[] = data ?? []

    if (loading) {
        return (
            <div className="p-3">
                <SkeletonList rows={3} label="Chargement de vos tâches CRM" />
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
                description="Vos tâches CRM n'ont pas pu être récupérées."
            />
        )
    }

    if (tasks.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={CheckCircle2}
                title="Aucune tâche en attente"
                description="Rien ne vous est assigné dans le CRM."
            />
        )
    }

    const today = startOfToday()
    const target = isRouteAllowed("/crm/tache", allowedRoutes)
        ? "/crm/tache"
        : undefined

    return (
        <WidgetList>
            {tasks.map((task) => {
                const due = task.date ? new Date(task.date) : null
                const late = due !== null && isBefore(due, today)

                return (
                    <WidgetRow
                        key={task.id}
                        to={target}
                        icon={ListChecks}
                        accent="chart-4"
                        compact={compact}
                        title={task.content?.trim() || task.type}
                        meta={task.type}
                        // En retard : c'est la seule chose qui mérite
                        // d'attirer l'oeil ici.
                        emphasis={late ? "danger" : "default"}
                        trailing={
                            due
                                ? format(due, "d MMM", { locale: fr })
                                : undefined
                        }
                    />
                )
            })}
        </WidgetList>
    )
}
