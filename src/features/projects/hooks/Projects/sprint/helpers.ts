// src/modules/projects/sprint/helpers.ts
import type { ProjectTeam, ProjectSprint } from "@/features/projects/types"

export function validateSprintDates(
    startDate?: string | null,
    endDate?: string | null
): boolean {
    if (!startDate || !endDate) return true
    return new Date(startDate) <= new Date(endDate)
}

export function checkSprintExists(
    team: ProjectTeam | null | undefined,
    sprintId: string
): boolean {
    return team?.sprints?.some((s: ProjectSprint) => s.id === sprintId) ?? false
}

export function formatSprintPayload(payload: {
    name: string
    goal?: string
    startDate?: string | null
    endDate?: string | null
    createdBy?: string | null
}) {
    return {
        name: payload.name,
        goal: payload.goal || null,
        start_date: payload.startDate || null,
        end_date: payload.endDate || null,
        created_by: payload.createdBy || null,
    }
}
