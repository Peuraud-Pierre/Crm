import { useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import type { ProjectTask } from "@/features/projects/types"

interface DraggableTaskCardProps {
    task: ProjectTask
    disabled?: boolean
    children: React.ReactNode
}

export function DraggableTaskCard({
    task,
    disabled = false,
    children,
}: DraggableTaskCardProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({
            id: task.id,
            data: { task },
            disabled,
        })

    const style = {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0 : 1,
    }

    return (
        <div ref={setNodeRef} style={style} className="relative">
            {/* Poignée de drag dédiée : seul élément qui porte les listeners
                @dnd-kit et `touch-none`. Le reste de la carte garde le scroll
                tactile natif, ce qui élimine les drags/clics déclenchés par
                erreur quand on scrolle sur mobile. */}
            {!disabled && (
                <button
                    type="button"
                    aria-label="Déplacer la tâche"
                    className="absolute left-0 top-0 z-10 flex h-full w-5 cursor-grab touch-none items-center justify-center rounded-l-xl text-muted-foreground/30 transition-colors hover:bg-muted/40 hover:text-muted-foreground active:cursor-grabbing"
                    {...listeners}
                    {...attributes}
                >
                    <GripVertical className="h-4 w-4" />
                </button>
            )}
            {children}
        </div>
    )
}
