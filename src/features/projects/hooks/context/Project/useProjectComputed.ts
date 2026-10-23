import type { ProjectTask, TaskStatus } from "@/features/projects/types"
import { useMemo } from "react"
import type { UseProjectSelectionReturn } from "./useProjectSelection"

interface TasksBucket {
    todo: ProjectTask[]
    in_progress: ProjectTask[]
    review: ProjectTask[]
    done: ProjectTask[]
}

export function useProjectComputed(
    selection: UseProjectSelectionReturn,
    pendingMove?: { taskId: string; status: TaskStatus } | null
) {
    const { selectedSprint } = selection

    const tasksByStatus: TasksBucket = useMemo(() => {
        const buckets: TasksBucket = {
            todo: [],
            in_progress: [],
            review: [],
            done: [],
        }

        if (!selectedSprint) return buckets

        const sorted = [...selectedSprint.tasks].sort(
            (a, b) => (a.position ?? 0) - (b.position ?? 0)
        )

        sorted.forEach((t) => {
            const effectiveStatus =
                pendingMove && t.id === pendingMove.taskId
                    ? pendingMove.status
                    : t.status
            buckets[effectiveStatus].push(t)
        })

        return buckets
    }, [selectedSprint, pendingMove])

    const sprintProgress = useMemo(() => {
        if (!selectedSprint) return null
        const tasks = selectedSprint.tasks ?? []
        const total = tasks.length
        const done = tasks.filter((t) => t.status === "done").length
        const percent = total === 0 ? 0 : Math.round((done / total) * 100)
        return { total, done, percent }
    }, [selectedSprint])

    const sprintStats = useMemo(() => {
        if (!selectedSprint) return null
        const tasks = selectedSprint.tasks ?? []
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return {
            todo: tasks.filter((t) => t.status === "todo").length,
            in_progress: tasks.filter((t) => t.status === "in_progress").length,
            review: tasks.filter((t) => t.status === "review").length,
            done: tasks.filter((t) => t.status === "done").length,
            overdue: tasks.filter((t) => {
                if (!t.due_date || t.status === "done") return false
                return new Date(t.due_date) < today
            }).length,
        }
    }, [selectedSprint])

    return { tasksByStatus, sprintProgress, sprintStats }
}

export type UseProjectComputedReturn = ReturnType<typeof useProjectComputed>
