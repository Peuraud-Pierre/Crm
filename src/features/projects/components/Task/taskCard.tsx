import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/atoms/avatar"
import { Card, CardContent } from "@/shared/ui/atoms/card"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/shared/ui/atoms/tooltip"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/shared/ui/atoms/dropdown-menu"
import { cn } from "@/shared/lib/utils"
import { resolveAvatarUrl } from "@/shared/lib/avatar"
import {
    ArrowRightLeft,
    CalendarClock,
    ExternalLink,
    MoreHorizontal,
    Pencil,
    Trash2,
} from "lucide-react"
import { useCallback, useRef, useState } from "react"
import { ClampedText } from "../utils/clampedText"
import { formatDate, getTaskAge } from "@/features/projects/utils/formatDate"
import { hashToColor } from "@/features/projects/utils/hashToColor"
import { PRIORITY_META, PRIORITY_ORDER } from "@/features/projects/project_constants"
import { taskCard, dueDateChip } from "@/features/projects/project_theme"
import { AttachmentIndicator } from "./taskAttachments"
import type { ProjectTask, TaskPriority } from "@/features/projects/types"

interface TaskCardContentProps {
    task: ProjectTask
    interactable: boolean
    isOverlay?: boolean
    onDetail?: (task: ProjectTask) => void
    onEdit: (task: ProjectTask) => void
    onDelete: (task: ProjectTask) => void
    onMove?: (taskId: string, sprintId: string) => void
    onPriorityChange: (task: ProjectTask, priority: TaskPriority) => void
    onTitleSave?: (taskId: string, title: string) => void
    availableSprints?: { id: string; name: string }[]
    currentSprintId?: string
}

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

export function TaskCardContent({
    task,
    interactable,
    isOverlay = false,
    onDetail,
    onEdit,
    onDelete,
    onMove,
    onPriorityChange,
    onTitleSave,
    availableSprints = [],
    currentSprintId,
}: TaskCardContentProps) {
    const [isEditingTitle, setIsEditingTitle] = useState(false)
    const [editTitle, setEditTitle] = useState(task.title)
    const inputRef = useRef<HTMLInputElement>(null)

    const overdueStatus = getOverdueStatus(task.due_date)
    const assigneeColor = hashToColor(task.assignee_id)
    const otherSprints = availableSprints.filter((s) => s.id !== currentSprintId)
    const accentColor = PRIORITY_META[task.priority].color

    const handleTitleClick = useCallback(() => {
        if (!interactable || isOverlay) return
        setEditTitle(task.title)
        setIsEditingTitle(true)
        setTimeout(() => inputRef.current?.focus(), 0)
    }, [interactable, isOverlay, task.title])

    const handleTitleSave = useCallback(() => {
        setIsEditingTitle(false)
        const trimmed = editTitle.trim()
        if (trimmed && trimmed !== task.title && onTitleSave) {
            onTitleSave(task.id, trimmed)
        }
    }, [editTitle, task.id, task.title, onTitleSave])

    const handleTitleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === "Enter") {
                e.preventDefault()
                handleTitleSave()
            } else if (e.key === "Escape") {
                setIsEditingTitle(false)
                setEditTitle(task.title)
            }
        },
        [handleTitleSave, task.title]
    )

    return (
        <Card
            className={cn(
                taskCard.root,
                overdueStatus === "overdue" && taskCard.overdue,
                isOverlay && taskCard.overlay
            )}
            style={{ borderLeft: `3px solid ${accentColor}` }}
            onDoubleClick={(e) => {
                if (!interactable || isOverlay) return
                e.stopPropagation()
                onEdit(task)
            }}
        >
            <CardContent className={cn("p-0", taskCard.body)}>
                {/* Row 1: priority badge + actions */}
                <div className="flex items-center gap-2">
                    {/* Priority — interactive dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            disabled={!interactable || isOverlay}
                            onPointerDown={(e) => e.stopPropagation()}
                            asChild
                        >
                            <button
                                type="button"
                                className={cn(
                                    "flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors",
                                    PRIORITY_META[task.priority].badgeClass,
                                    interactable && !isOverlay
                                        ? "cursor-pointer hover:opacity-80"
                                        : "cursor-default"
                                )}
                            >
                                <span
                                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: accentColor }}
                                />
                                {PRIORITY_META[task.priority].label}
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-36">
                            {PRIORITY_ORDER.filter((p) => p !== task.priority).map(
                                (priority) => (
                                    <DropdownMenuItem
                                        key={priority}
                                        className="gap-2 text-xs"
                                        onPointerDown={(e) => e.stopPropagation()}
                                        onClick={() => onPriorityChange(task, priority)}
                                    >
                                        <span
                                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                                            style={{ backgroundColor: PRIORITY_META[priority].color }}
                                        />
                                        {PRIORITY_META[priority].label}
                                    </DropdownMenuItem>
                                )
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="flex-1" />

                    {/* Action menu — revealed on hover */}
                    {!isOverlay && (
                        <div
                            className={taskCard.actionsWrapper}
                            onDoubleClick={(e) => e.stopPropagation()}
                        >
                            {onDetail && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            className={taskCard.actionBtn}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            onClick={() => onDetail(task)}
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Voir le détail</TooltipContent>
                                </Tooltip>
                            )}

                            {interactable && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            className={taskCard.actionBtn}
                                            onPointerDown={(e) => e.stopPropagation()}
                                        >
                                            <MoreHorizontal className="h-3.5 w-3.5" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="w-44"
                                        onPointerDown={(e) => e.stopPropagation()}
                                    >
                                        <DropdownMenuItem
                                            className="gap-2 text-xs"
                                            onClick={() => onEdit(task)}
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                            Modifier
                                        </DropdownMenuItem>

                                        {otherSprints.length > 0 && (
                                            <DropdownMenuSub>
                                                <DropdownMenuSubTrigger className="gap-2 text-xs">
                                                    <ArrowRightLeft className="h-3.5 w-3.5" />
                                                    Déplacer vers
                                                </DropdownMenuSubTrigger>
                                                <DropdownMenuSubContent className="w-44">
                                                    {otherSprints.map((sprint) => (
                                                        <DropdownMenuItem
                                                            key={sprint.id}
                                                            className="text-xs"
                                                            onClick={() =>
                                                                onMove?.(task.id, sprint.id)
                                                            }
                                                        >
                                                            {sprint.name}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                        )}

                                        <DropdownMenuSeparator />

                                        <DropdownMenuItem
                                            className="gap-2 text-xs text-destructive focus:text-destructive"
                                            onClick={() => onDelete(task)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Supprimer
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    )}
                </div>

                {/* Title */}
                {isEditingTitle && !isOverlay ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onBlur={handleTitleSave}
                        onKeyDown={handleTitleKeyDown}
                        onPointerDown={(e) => e.stopPropagation()}
                        className={taskCard.titleEditing}
                    />
                ) : (
                    <p
                        className={cn(
                            taskCard.titleDisplay,
                            interactable && !isOverlay && taskCard.titleInteractive
                        )}
                        onClick={handleTitleClick}
                        onDoubleClick={(e) => e.stopPropagation()}
                    >
                        {task.title}
                    </p>
                )}

                {/* Description */}
                {task.description && !isOverlay && (
                    <ClampedText text={task.description} lines={2} />
                )}

                {/* Footer: assignee + due date + created at */}
                {!isOverlay && (
                    <div className={taskCard.footer}>
                        <div className={taskCard.footerRow}>
                            <div className="flex min-w-0 items-center gap-1.5">
                                {task.assignee ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Avatar className="h-5 w-5 shrink-0 ring-1 ring-card">
                                                <AvatarImage
                                                    src={resolveAvatarUrl(task.assignee.avatar_url)}
                                                    alt={task.assignee.full_name ?? ""}
                                                />
                                                <AvatarFallback
                                                    // eslint-disable-next-line nokk-project/no-restricted-syntax -- texte/média posé sur un aplat de couleur dynamique (donnée ou visuel) : blanc requis pour le contraste, indépendant du thème (design system §12.4)
                                                    className="text-[9px] font-semibold text-white"
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
                                        <TooltipContent side="bottom">
                                            {task.assignee.full_name ?? task.assignee.email}
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (
                                    <div className="h-5 w-5 shrink-0 rounded-full border border-dashed border-muted-foreground/30" />
                                )}
                                <span className="truncate text-[10px] text-muted-foreground">
                                    {task.assignee?.full_name ??
                                        task.assignee?.email ??
                                        "Non assigné"}
                                </span>
                            </div>

                            {task.due_date && (
                                <DueDateChip dueDate={task.due_date} status={overdueStatus} />
                            )}
                        </div>

                        <div
                            className={cn(
                                taskCard.footerMeta,
                                "flex items-center justify-between"
                            )}
                        >
                            <span>Créé · {getTaskAge(task.created_at)}</span>
                            <AttachmentIndicator attachments={task.attachments} />
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

/* ─── Due date chip ───────────────────────────────────────────── */

function DueDateChip({
    dueDate,
    status,
}: {
    dueDate: string
    status: "overdue" | "today" | "soon" | null
}) {
    return (
        <div
            className={cn(
                dueDateChip.root,
                status === "overdue" && dueDateChip.overdue,
                status === "today" && dueDateChip.today,
                status === "soon" && dueDateChip.soon,
                !status && dueDateChip.none
            )}
        >
            <CalendarClock className="h-3 w-3" />
            {status === "overdue" && "En retard · "}
            {status === "today" && "Aujourd'hui · "}
            {formatDate(dueDate)}
        </div>
    )
}
