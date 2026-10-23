import { useMemo, useState } from "react"
import { CalendarClock, ListChecks, User } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/ui/atoms/table"
import { Toggle } from "@/shared/ui/atoms/toggle"
import { DEFAULT_PROJECT_VIEW } from "@/features/projects/routes/projectRoutes"
import { cn } from "@/shared/lib/utils"
import { useProjectCtx } from "@/features/projects/hooks/context/Project/ProjectProvider"
import { TASK_STATUS_COLUMNS } from "@/features/projects/project_constants"
import type {
    ProjectSprint,
    ProjectTask,
    ProjectTeam,
} from "@/features/projects/types"
import type { TaskStatus } from "@/features/projects/types/enums"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

type StatusFilter = TaskStatus | "open" | "all"

interface AggregatedTask {
    task: ProjectTask
    team: ProjectTeam
    sprint: ProjectSprint
}

const OPEN_STATUSES: TaskStatus[] = ["todo", "in_progress", "review"]

const STATUS_BADGE: Record<TaskStatus, string> = {
    todo: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    in_progress:
        "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    review: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
}

const statusLabel = (s: TaskStatus) =>
    TASK_STATUS_COLUMNS.find((c) => c.key === s)?.label ?? s

const isOverdue = (task: ProjectTask) => {
    if (!task.due_date || task.status === "done") return false
    const d = new Date(task.due_date)
    if (isNaN(d.getTime())) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return d.getTime() < today.getTime()
}

const formatDate = (iso: string | null) => {
    if (!iso) return "—"
    const d = new Date(iso)
    if (isNaN(d.getTime())) return "—"
    return d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    })
}

export function AllTasksView() {
    const {
        teams,
        user,
        go,
        PRIORITY_META,
    } = useProjectCtx()

    const [statusFilter, setStatusFilter] = useState<StatusFilter>("open")
    const [projectFilter, setProjectFilter] = useState<string>("all")
    const [mineOnly, setMineOnly] = useState(false)
    const [overdueOnly, setOverdueOnly] = useState(false)

    const aggregated: AggregatedTask[] = useMemo(() => {
        const out: AggregatedTask[] = []
        for (const team of teams) {
            if (team.status === "archived") continue
            for (const sprint of team.sprints) {
                for (const task of sprint.tasks) {
                    out.push({ task, team, sprint })
                }
            }
        }
        return out
    }, [teams])

    const filtered = useMemo(() => {
        return aggregated.filter(({ task, team }) => {
            if (statusFilter === "open") {
                if (!OPEN_STATUSES.includes(task.status)) return false
            } else if (statusFilter !== "all") {
                if (task.status !== statusFilter) return false
            }
            if (projectFilter !== "all" && team.id !== projectFilter)
                return false
            if (mineOnly && task.assignee_id !== user?.user_id) return false
            if (overdueOnly && !isOverdue(task)) return false
            return true
        })
    }, [aggregated, statusFilter, projectFilter, mineOnly, overdueOnly, user])

    const sorted = useMemo(() => {
        return [...filtered].sort((a, b) => {
            const ao = isOverdue(a.task) ? 0 : 1
            const bo = isOverdue(b.task) ? 0 : 1
            if (ao !== bo) return ao - bo
            const ad = a.task.due_date ?? "￿"
            const bd = b.task.due_date ?? "￿"
            return ad.localeCompare(bd)
        })
    }, [filtered])

    // Une seule navigation : projet + sprint + tâche sont tous dans l'URL cible.
    const openTask = ({ task, team, sprint }: AggregatedTask) => {
        go({
            projectId: team.id,
            view: DEFAULT_PROJECT_VIEW,
            taskId: task.id,
            sprintId: sprint.id,
        })
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                >
                    <SelectTrigger className="w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="open">
                            À faire + En cours + Test
                        </SelectItem>
                        <SelectItem value="all">Tous les statuts</SelectItem>
                        {TASK_STATUS_COLUMNS.map((c) => (
                            <SelectItem key={c.key} value={c.key}>
                                {c.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={projectFilter} onValueChange={setProjectFilter}>
                    <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Projet" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tous les projets</SelectItem>
                        {teams
                            .filter((t) => t.status !== "archived")
                            .map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                </SelectItem>
                            ))}
                    </SelectContent>
                </Select>

                <Toggle
                    pressed={mineOnly}
                    onPressedChange={setMineOnly}
                    aria-label="Mes tâches"
                >
                    <User className="mr-1 h-4 w-4" />
                    Mes tâches
                </Toggle>

                <Toggle
                    pressed={overdueOnly}
                    onPressedChange={setOverdueOnly}
                    aria-label="En retard"
                >
                    <CalendarClock className="mr-1 h-4 w-4" />
                    En retard
                </Toggle>

                <div className="ml-auto text-sm text-muted-foreground">
                    {sorted.length} tâche{sorted.length > 1 ? "s" : ""}
                </div>
            </div>

            <div className="rounded-lg border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Projet</TableHead>
                            <TableHead>Sprint</TableHead>
                            <TableHead>Tâche</TableHead>
                            <TableHead>Statut</TableHead>
                            <TableHead>Priorité</TableHead>
                            <TableHead>Assigné</TableHead>
                            <TableHead>Échéance</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sorted.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="p-0">
                                    <EmptyState
                                        size="sm"
                                        variant="search"
                                        icon={ListChecks}
                                        title="Aucune tâche"
                                        description="Aucune tâche ne correspond aux filtres."
                                    />
                                </TableCell>
                            </TableRow>
                        ) : (
                            sorted.map(({ task, team, sprint }) => {
                                const overdue = isOverdue(task)
                                const priorityMeta = PRIORITY_META?.[
                                    task.priority as keyof typeof PRIORITY_META
                                ] ?? { label: task.priority, badgeClass: "" }
                                return (
                                    <TableRow
                                        key={task.id}
                                        onClick={() =>
                                            openTask({ task, team, sprint })
                                        }
                                        className="cursor-pointer hover:bg-muted/50"
                                    >
                                        <TableCell className="font-medium">
                                            {team.name}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {sprint.name}
                                        </TableCell>
                                        <TableCell>{task.title}</TableCell>
                                        <TableCell>
                                            <Badge
                                                className={cn(
                                                    "border-0",
                                                    STATUS_BADGE[task.status]
                                                )}
                                            >
                                                {statusLabel(task.status)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                className={cn(
                                                    "border-0",
                                                    priorityMeta.badgeClass
                                                )}
                                            >
                                                {priorityMeta.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {task.assignee?.full_name ?? "—"}
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                "text-sm",
                                                overdue &&
                                                    "font-semibold text-destructive"
                                            )}
                                        >
                                            {formatDate(task.due_date)}
                                            {overdue && (
                                                <span className="ml-2 text-[10px] uppercase">
                                                    en retard
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

export function AllTasksViewToggle({
    active,
    onToggle,
}: {
    active: boolean
    onToggle: (v: boolean) => void
}) {
    return (
        <Button
            variant={active ? "default" : "outline"}
            size="sm"
            onClick={() => onToggle(!active)}
        >
            <ListChecks className="mr-2 h-4 w-4" />
            {active ? "Vue projets" : "Toutes les tâches"}
        </Button>
    )
}
