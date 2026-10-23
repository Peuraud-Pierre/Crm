import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/atoms/avatar"
import { Badge } from "@/shared/ui/atoms/badge"
import { cn } from "@/shared/lib/utils"
import { Clock, ExternalLink, Pencil, Trash2 } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/shared/ui/atoms/tooltip"
import { useProjectListContext } from "@/features/projects/hooks/context/projectListContext"
import { useTaskContext } from "@/features/projects/hooks/context/taskContext"
import { PRIORITY_META } from "@/features/projects/project_constants"
import { hashToColor } from "@/features/projects/utils/hashToColor"
import { formatDate } from "@/features/projects/utils/formatDate"
import { resolveAvatarUrl } from "@/shared/lib/avatar"
import { TaskFilters } from "./taskFilters"
import type { ProjectTask } from "@/features/projects/types"

function getOverdueStatus(dueDate: string | null): "overdue" | "today" | "soon" | null {
    if (!dueDate) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(dueDate)
    due.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return "overdue"
    if (diffDays === 0) return "today"
    if (diffDays <= 2) return "soon"
    return null
}

export function ListView() {
    const {
        TASK_STATUS_COLUMNS,
        PRIORITY_ORDER,
        sprintInteractable,
    } = useProjectListContext()

    const {
        tasksByStatus,
        setDetailTask,
        startEditingTask,
        setTaskToDelete,
    } = useTaskContext()

    const allTasks = TASK_STATUS_COLUMNS.flatMap(
        (col) => tasksByStatus[col.key] ?? []
    )

    return (
        <div className="space-y-4">
            <TaskFilters />
            <div className="space-y-6">
                {TASK_STATUS_COLUMNS.map((col) => {
                    const tasks = (tasksByStatus[col.key] ?? [])
                        .slice()
                        .sort((a, b) => {
                            if (a.due_date && b.due_date)
                                return (
                                    new Date(a.due_date).getTime() -
                                    new Date(b.due_date).getTime()
                                )
                            if (a.due_date) return -1
                            if (b.due_date) return 1
                            return (
                                PRIORITY_ORDER.indexOf(a.priority ?? "Normal") -
                                PRIORITY_ORDER.indexOf(b.priority ?? "Normal")
                            )
                        })

                    if (tasks.length === 0) return null

                    return (
                        <div key={col.key}>
                            <div className="mb-2 flex items-center gap-2">
                                <h3 className="text-sm font-semibold">{col.label}</h3>
                                <Badge variant="secondary" className="text-[10px]">
                                    {tasks.length}
                                </Badge>
                            </div>
                            <div className="divide-y rounded-md border bg-card">
                                {tasks.map((task) => (
                                    <TaskListRow
                                        key={task.id}
                                        task={task}
                                        interactable={sprintInteractable}
                                        onDetail={() => setDetailTask(task)}
                                        onEdit={() => startEditingTask(task)}
                                        onDelete={() => setTaskToDelete(task)}
                                    />
                                ))}
                            </div>
                        </div>
                    )
                })}

                {allTasks.length === 0 && (
                    <div className="rounded-md border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                        Aucune tâche dans ce sprint
                    </div>
                )}
            </div>
        </div>
    )
}

function TaskListRow({
    task,
    interactable,
    onDetail,
    onEdit,
    onDelete,
}: {
    task: ProjectTask
    interactable: boolean
    onDetail: () => void
    onEdit: () => void
    onDelete: () => void
}) {
    const overdueStatus = getOverdueStatus(task.due_date)
    const assigneeColor = hashToColor(task.assignee_id)

    return (
        <div
            className={cn(
                "group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                overdueStatus === "overdue" && "bg-red-50/50 dark:bg-red-950/10"
            )}
        >
            <Badge
                variant="secondary"
                className={cn(
                    "shrink-0 border-0 px-2 py-0 text-[10px]",
                    PRIORITY_META[task.priority].badgeClass
                )}
            >
                {PRIORITY_META[task.priority].label}
            </Badge>

            <span
                className="flex-1 cursor-pointer truncate text-sm font-medium hover:text-primary transition-colors"
                onClick={onDetail}
            >
                {task.title}
            </span>

            <div className="shrink-0">
                {task.due_date ? (
                    <span
                        className={cn(
                            "flex items-center gap-1 text-xs",
                            overdueStatus === "overdue" && "font-medium text-red-600",
                            overdueStatus === "today" && "font-medium text-amber-600",
                            overdueStatus === "soon" && "text-amber-500",
                            !overdueStatus && "text-muted-foreground"
                        )}
                    >
                        <Clock className="h-3 w-3" />
                        {formatDate(task.due_date)}
                        {overdueStatus === "overdue" && (
                            <span className="ml-1 rounded bg-red-100 px-1 text-[10px] text-red-700">
                                En retard
                            </span>
                        )}
                        {overdueStatus === "today" && (
                            <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">
                                Aujourd'hui
                            </span>
                        )}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                )}
            </div>

            {task.assignee ? (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Avatar className="h-6 w-6 shrink-0">
                            <AvatarImage
                                src={resolveAvatarUrl(task.assignee.avatar_url)}
                                alt={task.assignee.full_name ?? ""}
                            />
                            <AvatarFallback
                                // eslint-disable-next-line nokk-project/no-restricted-syntax -- texte/média posé sur un aplat de couleur dynamique (donnée ou visuel) : blanc requis pour le contraste, indépendant du thème (design system §12.4)
                                className="text-[10px] font-semibold text-white"
                                style={{ backgroundColor: assigneeColor }}
                            >
                                {(
                                    task.assignee.full_name ??
                                    task.assignee.email ??
                                    "?"
                                )[0]?.toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                        {task.assignee.full_name ?? task.assignee.email}
                    </TooltipContent>
                </Tooltip>
            ) : (
                <div className="h-6 w-6 shrink-0" />
            )}

            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            onClick={onDetail}
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent>Voir le détail</TooltipContent>
                </Tooltip>
                {interactable && (
                    <>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                    onClick={onEdit}
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Modifier</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    type="button"
                                    className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-destructive"
                                    onClick={onDelete}
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>Supprimer</TooltipContent>
                        </Tooltip>
                    </>
                )}
            </div>
        </div>
    )
}
