import { useDroppable } from "@dnd-kit/core"
import { Badge } from "@/shared/ui/atoms/badge"
import { cn } from "@/shared/lib/utils"
import type { TaskStatus } from "@/features/projects/types"

interface KanbanColumnProps {
    status: TaskStatus
    label: string
    hint: string
    count: number
    children: React.ReactNode
    onCreateTask?: () => void
}

export function KanbanColumn({
    status,
    label,
    hint,
    count,
    children,
    onCreateTask,
}: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({ id: status })

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex min-h-[260px] flex-col gap-3 rounded-lg border bg-muted/30 p-3 transition-[background-color,border-color,box-shadow]",
                isOver && "ring-2 ring-primary/50 border-primary bg-primary/5",
                onCreateTask && "cursor-default"
            )}
            onDoubleClick={onCreateTask}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {label}
                    </h4>
                    <Badge
                        variant="secondary"
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                    >
                        {count}
                    </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground/60">
                    {hint}
                </span>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto pr-0.5" style={{ maxHeight: "min(520px, calc(100vh - 380px))" }}>
                {children}
            </div>
        </div>
    )
}
