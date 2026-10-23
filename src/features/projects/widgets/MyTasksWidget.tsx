import { AlertTriangle, CheckCircle2, SquareKanban } from "lucide-react"
import { format, isBefore, startOfToday } from "date-fns"
import { fr } from "date-fns/locale"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useWidgetData } from "@/shared/hooks/useWidgetData"
import { isRouteAllowed } from "@/shared/lib/routeAccess"
import type { WidgetProps } from "@/shared/types/widget.types"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonList } from "@/shared/ui/molecules/skeleton-presets"
import { WidgetList, WidgetRow } from "@/shared/ui/molecules/widget-list"
import { TASK_STATUS_COLUMNS } from "../project_constants"
import { buildProjectPath } from "../routes/projectRoutes"
import { fetchMyOpenTasks, type MyTaskRow } from "../services/task/fetchMyTasks"

const ROWS_PER_UNIT = 1.2

const STATUS_LABEL = new Map(
    TASK_STATUS_COLUMNS.map((column) => [column.key, column.label])
)

/**
 * Les tâches de projet assignées à l'utilisateur et pas encore terminées.
 *
 * Chaque ligne dit **d'où elle vient** — projet, sprint, statut : une
 * liste de titres de tâches sans leur contexte oblige à ouvrir chacune
 * pour savoir de quoi il retourne, ce qui annule l'intérêt du module.
 *
 * L'échéance reste le seul repère mis en avant : c'est ce qui distingue
 * « à faire » de « à faire maintenant ».
 *
 * Le clic ouvre la **sheet de la tâche**, pas la page projets. Le chemin
 * est construit par `buildProjectPath()` et jamais concaténé à la main :
 * `docs/ROUTING.md` (§ modèle hiérarchique) explique que ce constructeur
 * existe précisément pour éviter que dix composants réinventent chacun
 * leur assemblage d'URL. Une tâche sans sprint n'a pas de projet
 * résoluble — la route de détail réclamant l'identifiant du projet, elle
 * retombe alors sur l'accueil de la feature.
 */
export default function MyTasksWidget({ height, compact }: WidgetProps) {
    const { user, allowedRoutes } = useAuth()
    const userId = user?.user_id

    const limit = Math.max(3, Math.floor(height * ROWS_PER_UNIT))

    const { data, loading, error } = useWidgetData(
        userId ? () => fetchMyOpenTasks(userId, limit) : null,
        [userId, limit],
        "MyTasksWidget"
    )
    const tasks: MyTaskRow[] = data ?? []

    if (loading) {
        return (
            <div className="p-3">
                <SkeletonList rows={3} label="Chargement de vos tâches" />
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
                description="Vos tâches n'ont pas pu être récupérées."
            />
        )
    }

    if (tasks.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={CheckCircle2}
                title="Aucune tâche en cours"
                description="Rien ne vous est assigné sur les projets."
            />
        )
    }

    const today = startOfToday()

    return (
        <WidgetList>
            {tasks.map((task) => {
                const due = task.due_date ? new Date(task.due_date) : null
                const late = due !== null && isBefore(due, today)

                const target = buildProjectPath({
                    projectId: task.sprint?.team?.id ?? null,
                    taskId: task.id,
                    sprintId: task.sprint?.id ?? null,
                })

                return (
                    <WidgetRow
                        key={task.id}
                        to={
                            isRouteAllowed(target, allowedRoutes)
                                ? target
                                : undefined
                        }
                        icon={SquareKanban}
                        accent="chart-6"
                        compact={compact}
                        title={task.title}
                        meta={contextOf(task)}
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

/**
 * D'où vient cette tâche : projet, sprint, statut — dans cet ordre, du
 * plus large au plus précis. Les niveaux absents sont simplement omis
 * plutôt que remplacés par un « — » : une tâche hors sprint est un cas
 * normal, pas une donnée manquante à signaler.
 */
function contextOf(task: MyTaskRow): string {
    const parts = [
        task.sprint?.team?.name,
        task.sprint?.name,
        STATUS_LABEL.get(task.status) ?? task.status,
    ].filter((part): part is string => Boolean(part))

    return parts.join(" · ")
}
