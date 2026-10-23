import { useMemo, useState } from "react"
import type { ProjectTask, TaskPriority } from "@/features/projects/types"
import type { ProjectSprint } from "@/features/projects/types"

interface TasksBucket {
    todo: ProjectTask[]
    in_progress: ProjectTask[]
    review: ProjectTask[]
    done: ProjectTask[]
}

const EMPTY_BUCKET: TasksBucket = { todo: [], in_progress: [], review: [], done: [] }

export function useTaskFilters(
    tasksByStatus: TasksBucket | undefined,
    selectedSprint: ProjectSprint | null
) {
    const safeTasksByStatus = tasksByStatus ?? EMPTY_BUCKET
    const [searchQuery, setSearchQuery] = useState("")
    const [filterPriority, setFilterPriority] = useState<TaskPriority | "Normal" | "all">("all")
    const [filterAssignee, setFilterAssignee] = useState<string>("all")

    const activeFilterCount = useMemo(() => {
        let count = 0
        if (searchQuery.trim()) count++
        if (filterPriority !== "all") count++
        if (filterAssignee !== "all") count++
        return count
    }, [searchQuery, filterPriority, filterAssignee])

    const filteredTasksByStatus = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        const filterBucket = <T extends { id: string; title: string; priority: TaskPriority | "Normal"; assignee_id: string | null }>(
            tasks: T[]
        ): T[] =>
            tasks.filter((task) => {
                if (query && !task.title.toLowerCase().includes(query)) return false
                if (filterPriority !== "all" && task.priority !== filterPriority) return false
                if (filterAssignee !== "all" && task.assignee_id !== filterAssignee) return false
                return true
            })

        return {
            todo: filterBucket(safeTasksByStatus.todo),
            in_progress: filterBucket(safeTasksByStatus.in_progress),
            review: filterBucket(safeTasksByStatus.review),
            done: filterBucket(safeTasksByStatus.done),
        }
    }, [safeTasksByStatus, searchQuery, filterPriority, filterAssignee])

    const assigneeOptions = useMemo(() => {
        if (!selectedSprint) return []
        const seen = new Map<string, string>()
        for (const task of selectedSprint.tasks) {
            if (task.assignee_id && !seen.has(task.assignee_id)) {
                const name =
                    task.assignee?.full_name ??
                    task.assignee?.email ??
                    task.assignee_id
                seen.set(task.assignee_id, name)
            }
        }
        return Array.from(seen.entries()).map(([id, label]) => ({ id, label }))
    }, [selectedSprint])

    function resetFilters() {
        setSearchQuery("")
        setFilterPriority("all")
        setFilterAssignee("all")
    }

    return {
        // Filter state
        searchQuery,
        setSearchQuery,
        filterPriority,
        setFilterPriority,
        filterAssignee,
        setFilterAssignee,
        activeFilterCount,
        resetFilters,
        // Derived data
        filteredTasksByStatus,
        assigneeOptions,
    }
}

export type UseTaskFiltersReturn = ReturnType<typeof useTaskFilters>
