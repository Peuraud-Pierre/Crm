// src/modules/projects/task/helpers.ts
import type { ProjectTask } from "@/features/projects/types"

export function getNextPositionInList(
    tasks: Pick<ProjectTask, "status" | "position">[],
    status: string
): number {
    const positions = tasks
        .filter((task) => task.status === status)
        .map((task) => task.position ?? 0)

    return positions.length ? Math.max(...positions) + 1 : 1
}

export function sanitizeTaskUpdatePayload(
    updates: Partial<Omit<ProjectTask, "id" | "sprint_id" | "created_at">>
): Record<string, unknown> {
    const payload: Record<string, unknown> = {}

    if (updates.title !== undefined) payload.title = updates.title
    if (updates.description !== undefined)
        payload.description = updates.description
    if (updates.assignee_id !== undefined)
        payload.assignee_id = updates.assignee_id
    if (updates.due_date !== undefined) payload.due_date = updates.due_date
    if (updates.priority !== undefined) payload.priority = updates.priority
    if (updates.status !== undefined) payload.status = updates.status

    return payload
}

export function taskBelongsToSprint(
    task: Pick<ProjectTask, "sprint_id"> | null | undefined,
    sprintId: string
): boolean {
    return task?.sprint_id === sprintId
}
