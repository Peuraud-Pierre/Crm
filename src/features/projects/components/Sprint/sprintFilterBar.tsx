import {
    Archive,
    ArrowLeft,
    ChevronDown,
    GitBranch,
    Plus,
    Trash2,
} from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Badge } from "@/shared/ui/atoms/badge"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/shared/ui/atoms/popover"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/ui/atoms/dropdown-menu"
import { cn } from "@/shared/lib/utils"
import { useState } from "react"
import { useProjectListContext } from "@/features/projects/hooks/context/projectListContext"
import { useSprintContext } from "@/features/projects/hooks/context/sprintContext"

interface SprintFilterBarProps {
    onBackToProjects: () => void
}

export function SprintFilterBar({ onBackToProjects }: SprintFilterBarProps) {
    const {
        selectedProject,
        selectedSprint,
        selectedSprintId,
        setSelectedSprintId,
        sortedSprints,
        activeSprints,
        archivedSprintsList,
        canInteractWithProject,
        isProjectOwner,
        canManageProject,
    } = useProjectListContext()

    const {
        setCreateSprintOpen,
        setArchiveSprintOpen,
        setDeleteSprintOpen,
        submitting,
    } = useSprintContext()

    const [sprintOpen, setSprintOpen] = useState(false)

    if (!selectedProject) return null

    const isSprintArchived = selectedSprint?.status === "archived"

    return (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-2.5 shadow-sm">
            {/* Back to projects */}
            <button
                type="button"
                onClick={onBackToProjects}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Retour aux projets"
            >
                <ArrowLeft className="h-3.5 w-3.5" />
            </button>

            <div className="h-4 w-px bg-border" />

            {/* Sprint selector — branch-like */}
            <Popover open={sprintOpen} onOpenChange={setSprintOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                            "hover:bg-muted",
                            sprintOpen && "bg-muted"
                        )}
                    >
                        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="max-w-[100px] truncate sm:max-w-[160px]">
                            {selectedSprint?.name ?? "Choisir un sprint"}
                        </span>
                        {isSprintArchived && (
                            <Badge variant="secondary" className="text-[9px] py-0 px-1">
                                Archivé
                            </Badge>
                        )}
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </button>
                </PopoverTrigger>

                <PopoverContent className="w-56 p-1 sm:w-64" align="start">
                    {activeSprints.length > 0 && (
                        <>
                            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Sprints actifs
                            </p>
                            {activeSprints.map((s) => (
                                <SprintOption
                                    key={s.id}
                                    label={s.name}
                                    active={s.id === selectedSprintId}
                                    onSelect={() => {
                                        setSelectedSprintId(s.id)
                                        setSprintOpen(false)
                                    }}
                                />
                            ))}
                        </>
                    )}

                    {archivedSprintsList.length > 0 && (
                        <>
                            {activeSprints.length > 0 && (
                                <div className="my-1 border-t" />
                            )}
                            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Archivés
                            </p>
                            {archivedSprintsList.map((s) => (
                                <SprintOption
                                    key={s.id}
                                    label={s.name}
                                    active={s.id === selectedSprintId}
                                    archived
                                    onSelect={() => {
                                        setSelectedSprintId(s.id)
                                        setSprintOpen(false)
                                    }}
                                />
                            ))}
                        </>
                    )}

                    {sortedSprints.length === 0 && (
                        <p className="px-2 py-2 text-xs text-muted-foreground">
                            Aucun sprint
                        </p>
                    )}

                    {canInteractWithProject && (
                        <>
                            <div className="my-1 border-t" />
                            <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                onClick={() => {
                                    setSprintOpen(false)
                                    setCreateSprintOpen(true)
                                }}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Nouveau sprint
                            </button>
                        </>
                    )}
                </PopoverContent>
            </Popover>

            {/* Sprint status hints */}
            {selectedSprint && (
                <span className="text-xs text-muted-foreground hidden sm:block">
                    {selectedSprint.start_date?.split("T")[0] ?? "—"}
                    {" → "}
                    {selectedSprint.end_date?.split("T")[0] ?? "—"}
                </span>
            )}

            {/* Create sprint — quick button when no sprints */}
            {sortedSprints.length === 0 && canInteractWithProject && (
                <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => setCreateSprintOpen(true)}
                >
                    <Plus className="h-3.5 w-3.5" />
                    Créer un sprint
                </Button>
            )}

            {/* Sprint actions menu */}
            {selectedSprint && canManageProject && (
                <div className="ml-auto">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                                Actions
                                <ChevronDown className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="text-xs">
                            {!isSprintArchived && isProjectOwner && (
                                <DropdownMenuItem
                                    className="gap-2 text-xs"
                                    onSelect={() => setArchiveSprintOpen(true)}
                                    disabled={!!submitting}
                                >
                                    <Archive className="h-3.5 w-3.5" />
                                    Archiver le sprint
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="gap-2 text-xs text-destructive focus:text-destructive"
                                onSelect={() => setDeleteSprintOpen(true)}
                                disabled={!!submitting}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Supprimer le sprint
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        </div>
    )
}

function SprintOption({
    label,
    active,
    archived,
    onSelect,
}: {
    label: string
    active: boolean
    archived?: boolean
    onSelect: () => void
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-muted",
                archived && "opacity-60"
            )}
        >
            <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{label}</span>
            {active && (
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            )}
        </button>
    )
}
