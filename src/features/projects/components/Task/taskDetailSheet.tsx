import { useEffect, useState } from "react"
import type { TaskPriority, TaskStatus } from "@/features/projects/types"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/shared/ui/atoms/sheet"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { Badge } from "@/shared/ui/atoms/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/ui/atoms/avatar"
import { Label } from "@/shared/ui/atoms/label"
import { Textarea } from "@/shared/ui/atoms/textarea"
import { Input } from "@/shared/ui/atoms/input"
import { Clock, User } from "lucide-react"
import { useProjectListContext } from "@/features/projects/hooks/context/projectListContext"
import { useProjectMembersContext } from "@/features/projects/hooks/context/projectMembersContext"
import { useTaskContext } from "@/features/projects/hooks/context/taskContext"
import {
    PRIORITY_META,
    PRIORITY_ORDER,
    TASK_STATUS_COLUMNS,
} from "@/features/projects/project_constants"
import { formatDate, getTaskAge } from "@/features/projects/utils/formatDate"
import { resolveAvatarUrl } from "@/shared/lib/avatar"
import { cn } from "@/shared/lib/utils"
import { hashToColor } from "@/features/projects/utils/hashToColor"
import { TaskAttachments } from "./taskAttachments"

export function TaskDetailSheet() {
    const { updateTask, sprintInteractable, selectedSprint } = useProjectListContext()
    const { projectMembers } = useProjectMembersContext()
    const { detailTask, setDetailTask } = useTaskContext()

    const task =
        selectedSprint?.tasks.find((t) => t.id === detailTask?.id) ??
        detailTask

    const [localDesc, setLocalDesc] = useState(task?.description ?? "")
    const [saving, setSaving] = useState<string | null>(null)

    useEffect(() => {
        // Resync local description to the task entity when it changes
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        if (task) setLocalDesc(task.description ?? "")
    }, [task?.id])

    if (!task) return null

    const interactable = sprintInteractable
    const color = hashToColor(task.assignee_id)

    const save = async (field: string, updates: Record<string, unknown>) => {
        setSaving(field)
        try {
            await updateTask(task.id, updates as Parameters<typeof updateTask>[1])
        } finally {
            setSaving(null)
        }
    }

    const handleDescBlur = () => {
        const trimmed = localDesc.trim()
        if (trimmed !== (task.description ?? "").trim()) {
            void save("description", { description: trimmed || null })
        }
    }

    return (
        <Sheet
            open={Boolean(detailTask)}
            onOpenChange={(open) => !open && setDetailTask(null)}
        >
            <SheetContent
                side="right"
                className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:w-[480px] sm:max-w-[480px]"
            >
                <div className="h-1 w-full" style={{ backgroundColor: color }} />

                <div className="flex flex-col gap-5 p-6">
                    <SheetHeader>
                        <div className="flex items-start gap-3">
                            <Badge
                                className={cn(
                                    "mt-0.5 shrink-0 border-0",
                                    PRIORITY_META[task.priority].badgeClass
                                )}
                            >
                                {PRIORITY_META[task.priority].label}
                            </Badge>
                            <SheetTitle className="text-base leading-snug">
                                {task.title}
                            </SheetTitle>
                        </div>
                    </SheetHeader>

                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Statut</Label>
                        <Select
                            disabled={!interactable || saving === "status"}
                            value={task.status}
                            onValueChange={(v) =>
                                void save("status", { status: v as TaskStatus })
                            }
                        >
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TASK_STATUS_COLUMNS.map((col) => (
                                    <SelectItem key={col.key} value={col.key}>
                                        {col.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Priorité</Label>
                        <Select
                            disabled={!interactable || saving === "priority"}
                            value={task.priority}
                            onValueChange={(v) =>
                                void save("priority", { priority: v as TaskPriority })
                            }
                        >
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PRIORITY_ORDER.map((p) => (
                                    <SelectItem key={p} value={p}>
                                        {PRIORITY_META[p].label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Assigné à</Label>
                        <Select
                            disabled={!interactable || saving === "assignee"}
                            value={task.assignee_id ?? "unassigned"}
                            onValueChange={(v) =>
                                void save("assignee", {
                                    assignee_id: v === "unassigned" ? null : v,
                                })
                            }
                        >
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Non assigné" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unassigned">Non assigné</SelectItem>
                                {projectMembers.map((m) => (
                                    <SelectItem key={m.userId} value={m.userId}>
                                        {m.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Date limite</Label>
                        <Input
                            type="date"
                            disabled={!interactable || saving === "due_date"}
                            className="h-8 text-sm"
                            value={task.due_date ? task.due_date.split("T")[0] : ""}
                            onChange={(e) =>
                                void save("due_date", { due_date: e.target.value || null })
                            }
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <Textarea
                            disabled={!interactable}
                            value={localDesc}
                            onChange={(e) => setLocalDesc(e.target.value)}
                            onBlur={handleDescBlur}
                            placeholder="Ajouter une description..."
                            className="min-h-[100px] resize-none text-sm"
                        />
                    </div>

                    <TaskAttachments taskId={task.id} editable={interactable} />

                    <div className="space-y-2 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            <span>
                                Créée le {formatDate(task.created_at)}{" "}
                                <span className="text-foreground/60">
                                    (il y a {getTaskAge(task.created_at)})
                                </span>
                            </span>
                        </div>
                        {task.last_moved_by_profile && task.last_moved_at && (
                            <div className="flex items-center gap-2">
                                <User className="h-3.5 w-3.5 shrink-0" />
                                <span>
                                    Déplacée par{" "}
                                    <strong>
                                        {task.last_moved_by_profile.full_name ??
                                            task.last_moved_by_profile.email}
                                    </strong>{" "}
                                    le {formatDate(task.last_moved_at)}
                                </span>
                            </div>
                        )}
                        {task.assignee && (
                            <div className="flex items-center gap-2">
                                <Avatar className="h-4 w-4 shrink-0">
                                    <AvatarImage
                                        src={resolveAvatarUrl(task.assignee.avatar_url)}
                                    />
                                    <AvatarFallback className="text-[8px]">
                                        {(task.assignee.full_name ?? "?")[0]?.toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <span>
                                    Assignée à{" "}
                                    {task.assignee.full_name ?? task.assignee.email}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
