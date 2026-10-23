// context/project/useDragAndDrop.ts — @dnd-kit implementation
import {
    type DragEndEvent,
    type DragStartEvent,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core"
import { useCallback, useState } from "react"
import type { ProjectTask, TaskStatus } from "@/features/projects/types"
import type { UseProjectsReturn } from "@/features/projects/hooks/Projects/useProjects"
import type { UseProjectPermissionsReturn } from "./useProjectPermissions"
import type { UseProjectSelectionReturn } from "./useProjectSelection"

export function useDragAndDrop({
    selection,
    projectApi,
    permissions,
}: {
    selection: UseProjectSelectionReturn
    projectApi: UseProjectsReturn
    permissions: UseProjectPermissionsReturn
}) {
    const { selectedSprint } = selection
    const { updateTaskStatus } = projectApi
    const { sprintInteractable } = permissions

    const [activeTask, setActiveTask] = useState<ProjectTask | null>(null)
    const [pendingMove, setPendingMove] = useState<{ taskId: string; status: TaskStatus } | null>(null)

    // Sensors: pointer (desktop) + touch (mobile)
    // Le drag ne part que depuis la poignée dédiée de la carte (cf.
    // DraggableTaskCard), donc une simple contrainte de distance suffit : pas
    // besoin d'appui long, et le scroll natif n'est jamais intercepté ailleurs.
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(TouchSensor, {
            activationConstraint: { distance: 8 },
        })
    )

    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            if (!sprintInteractable || !selectedSprint) return
            const task = selectedSprint.tasks.find(
                (t) => t.id === event.active.id
            )
            if (task) setActiveTask(task)
        },
        [sprintInteractable, selectedSprint]
    )

    const handleDragEnd = useCallback(
        async (event: DragEndEvent) => {
            const { active, over } = event
            setActiveTask(null)

            if (!over || !sprintInteractable || !selectedSprint) return

            const taskId = active.id as string
            const newStatus = over.id as TaskStatus

            const current = selectedSprint.tasks.find((t) => t.id === taskId)
            if (!current || current.status === newStatus) return

            setPendingMove({ taskId, status: newStatus })
            try {
                await updateTaskStatus(taskId, newStatus)
            } finally {
                setPendingMove(null)
            }
        },
        [sprintInteractable, selectedSprint, updateTaskStatus]
    )

    return {
        sensors,
        activeTask,
        pendingMove,
        sprintInteractable,
        handleDragStart,
        handleDragEnd,
    }
}

export type UseDragAndDropReturn = ReturnType<typeof useDragAndDrop>
