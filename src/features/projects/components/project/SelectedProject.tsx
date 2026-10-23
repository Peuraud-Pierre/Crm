import React from "react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { formatDateRange } from "@/features/projects/utils/formatDate"
import {
    BarChart2,
    Calendar,
    CalendarDays,
    ChevronDown,
    KanbanSquare,
    LayoutList,
    ListTodo,
    Pencil,
    Target,
} from "lucide-react"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/shared/ui/atoms/collapsible"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/shared/ui/atoms/popover"
import { Label } from "@/shared/ui/atoms/label"
import { Input } from "@/shared/ui/atoms/input"
import { cn } from "@/shared/lib/utils"
import {
    sprintCard,
    viewToggle as viewToggleTheme,
} from "@/features/projects/project_theme"
import { Manage } from "./SelectedProject/Manage"
import { SprintDistributionChart } from "../Sprint/sprintDistributionChart"
import { SprintStats } from "../Sprint/sprintStats"
import { KanbanView } from "../Task/kanbanView"
import { ListView } from "../Task/listView"
import { CalendarView } from "../Task/calendarView"
import { SprintFilterBar } from "../Sprint/sprintFilterBar"
import { useProjectListContext } from "@/features/projects/hooks/context/projectListContext"
import { useSprintContext } from "@/features/projects/hooks/context/sprintContext"
import { useTaskContext } from "@/features/projects/hooks/context/taskContext"
import type { ProjectView } from "@/features/projects/routes/projectRoutes"

export function SelectedProject() {
    const [statsOpen, setStatsOpen] = React.useState(false)
    const [editDatesOpen, setEditDatesOpen] = React.useState(false)

    const {
        selectedProject,
        isProjectArchived,
        canManageProject,
        canInteractWithProject,
        selectedSprint,
        isSprintArchived,
        setSelectedProjectId,
        sprintInteractable,
        handleRestoreProject: restoreProject,
        submitting: projectSubmitting,
        view,
        go,
    } = useProjectListContext()

    // La vue active vient de l'URL (/projects/:projectId/:view) : changer d'onglet
    // = une navigation en push, pour que le retour navigateur la défasse.
    const setView = (next: ProjectView) => go({ view: next, taskId: null })

    const { handleUpdateSprintDates } = useSprintContext()
    const { setCreateTaskOpen, sprintProgress } = useTaskContext()

    if (!selectedSprint) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-3 sm:p-6">
                <SprintFilterBar onBackToProjects={() => setSelectedProjectId(null)} />
                <ProjectHeader
                    name={selectedProject?.name ?? ""}
                    description={selectedProject?.description ?? null}
                    isArchived={isProjectArchived}
                    canManage={canManageProject}
                    canInteract={canInteractWithProject}
                    onRestore={restoreProject}
                    restoreDisabled={projectSubmitting === "restore"}
                />
                <EmptyState
                    icon={KanbanSquare}
                    title="Aucun sprint sélectionné"
                    description="Créez un sprint ou sélectionnez-en un via le sélecteur ci-dessus."
                />
            </div>
        )
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-3 sm:p-6">
            {/* Sprint filter bar (back button + sprint selector) */}
            <SprintFilterBar onBackToProjects={() => setSelectedProjectId(null)} />

            {/* Project header */}
            <ProjectHeader
                name={selectedProject?.name ?? ""}
                description={selectedProject?.description ?? null}
                isArchived={isProjectArchived}
                canManage={canManageProject}
                canInteract={canInteractWithProject}
                onRestore={restoreProject}
                restoreDisabled={projectSubmitting === "restore"}
                action={
                    sprintInteractable ? (
                        <Button
                            size="sm"
                            className="shrink-0 gap-2"
                            onClick={() => setCreateTaskOpen(true)}
                        >
                            <ListTodo className="h-3.5 w-3.5" />
                            Nouvelle tâche
                        </Button>
                    ) : undefined
                }
            />

            {/* Sprint context strip */}
            <div className={sprintCard.root}>
                {/* Sprint top row */}
                <div className={sprintCard.topRow}>
                    {/* Name + status */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">
                            {selectedSprint.name}
                        </span>
                        {isSprintArchived && (
                            <Badge variant="secondary" className="text-[11px]">
                                Archivé
                            </Badge>
                        )}
                    </div>

                    {/* Goal */}
                    {selectedSprint.goal && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Target className="h-3.5 w-3.5 shrink-0" />
                            <span className="line-clamp-1">{selectedSprint.goal}</span>
                        </div>
                    )}

                    {/* Dates */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground sm:ml-auto">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>
                            {formatDateRange(
                                selectedSprint.start_date || "",
                                selectedSprint.end_date || ""
                            )}
                        </span>

                        {canInteractWithProject && !isSprintArchived && (
                            <Popover open={editDatesOpen} onOpenChange={setEditDatesOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0 text-muted-foreground/60 hover:text-muted-foreground"
                                    >
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto space-y-3 p-4" align="end">
                                    <p className="text-sm font-medium">Modifier les dates</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs">Début</Label>
                                            <Input
                                                type="date"
                                                className="h-8 text-xs"
                                                value={selectedSprint.start_date?.split("T")[0] ?? ""}
                                                onChange={async (e) => {
                                                    await handleUpdateSprintDates({
                                                        start_date: e.target.value || null,
                                                    })
                                                }}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs">Fin</Label>
                                            <Input
                                                type="date"
                                                className="h-8 text-xs"
                                                value={selectedSprint.end_date?.split("T")[0] ?? ""}
                                                onChange={async (e) => {
                                                    await handleUpdateSprintDates({
                                                        end_date: e.target.value || null,
                                                    })
                                                }}
                                            />
                                        </div>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}

                        {selectedSprint.end_date &&
                            selectedSprint.status !== "completed" &&
                            new Date(selectedSprint.end_date) <
                                new Date(new Date().toDateString()) && (
                                <Badge variant="destructive" className="text-[11px]">
                                    En retard
                                </Badge>
                            )}
                        {selectedSprint.end_date &&
                            selectedSprint.status !== "completed" &&
                            new Date(selectedSprint.end_date).toDateString() ===
                                new Date().toDateString() && (
                                <Badge className="bg-warning text-[11px] text-warning-foreground hover:bg-warning/90">
                                    Se termine aujourd'hui
                                </Badge>
                            )}
                    </div>
                </div>

                {/* Progress bar */}
                {sprintProgress && (
                    <div className={sprintCard.progressArea}>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Progression</span>
                            <span>
                                {sprintProgress.done}/{sprintProgress.total} tâches ·{" "}
                                {sprintProgress.percent}%
                            </span>
                        </div>
                        <div className={sprintCard.progressTrack}>
                            <div
                                className={sprintCard.progressFill}
                                style={{ width: `${sprintProgress.percent}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Stats collapsible */}
                <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
                    <CollapsibleTrigger className={sprintCard.statsToggle}>
                        <span className="flex items-center gap-1.5">
                            <BarChart2 className="h-3.5 w-3.5" />
                            Statistiques du sprint
                        </span>
                        <ChevronDown
                            className={cn(
                                "h-3.5 w-3.5 transition-transform duration-base",
                                statsOpen && "rotate-180"
                            )}
                        />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-[collapsible-up_0.2s_ease-out] data-[state=open]:animate-[collapsible-down_0.2s_ease-out]">
                        <div className={sprintCard.statsContent}>
                            <SprintStats />
                            <SprintDistributionChart />
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </div>

            {/* View toggle */}
            <div className="flex items-center justify-between">
                <div className={viewToggleTheme.root}>
                    <ViewButton
                        active={view === "kanban"}
                        onClick={() => setView("kanban")}
                        icon={KanbanSquare}
                        label="Kanban"
                    />
                    <ViewButton
                        active={view === "list"}
                        onClick={() => setView("list")}
                        icon={LayoutList}
                        label="Liste"
                    />
                    <ViewButton
                        active={view === "calendar"}
                        onClick={() => setView("calendar")}
                        icon={CalendarDays}
                        label="Calendrier"
                    />
                </div>
            </div>

            {/* View content */}
            {view === "kanban" && <KanbanView />}
            {view === "list" && <ListView />}
            {view === "calendar" && <CalendarView />}
        </div>
    )
}

/* ─── Shared project header ───────────────────────────────────── */

function ProjectHeader({
    name,
    description,
    isArchived,
    canManage,
    canInteract,
    onRestore,
    restoreDisabled,
    action,
}: {
    name: string
    description: string | null
    isArchived: boolean
    canManage: boolean
    canInteract: boolean
    onRestore: () => void
    restoreDisabled: boolean
    action?: React.ReactNode
}) {
    return (
        <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-semibold leading-tight text-foreground">
                        {name}
                    </h1>
                    {isArchived && (
                        <Badge variant="secondary" className="text-[11px]">
                            Archivé
                        </Badge>
                    )}
                    {canInteract && canManage && !isArchived && <Manage />}
                </div>
                {description && (
                    <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            <div className="flex items-center gap-2">
                {canManage && isArchived && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRestore}
                        disabled={restoreDisabled}
                    >
                        Réactiver
                    </Button>
                )}
                {action}
            </div>
        </div>
    )
}

/* ─── View toggle button ──────────────────────────────────────── */

function ViewButton({
    active,
    onClick,
    icon: Icon,
    label,
}: {
    active: boolean
    onClick: () => void
    icon: React.ElementType
    label: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                viewToggleTheme.button.base,
                active ? viewToggleTheme.button.active : viewToggleTheme.button.inactive
            )}
        >
            <Icon className="h-3.5 w-3.5" />
            {label}
        </button>
    )
}
