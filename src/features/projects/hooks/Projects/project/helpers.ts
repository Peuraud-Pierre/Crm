// src/modules/projects/project/helpers.ts
import type { ProjectTeam, ProjectTeamMember } from "@/features/projects/types"

export function checkTeamPermission(team: ProjectTeam | null | undefined, userId: string): boolean {
    if (!team) return false
    return (
        team.owner_id === userId ||
        team.members.some((m: ProjectTeamMember) => m.user_id === userId)
    )
}

export function extractMemberIds(team: ProjectTeam | null | undefined): string[] {
    if (!team) return []
    const ids = new Set<string>()
    ids.add(team.owner_id)
    team.members.forEach((m: ProjectTeamMember) => ids.add(m.user_id))
    return Array.from(ids)
}

export function formatProjectPayload(payload: {
    name: string
    description?: string
    ownerId?: string | null
}) {
    return {
        name: payload.name,
        description: payload.description || null,
        owner_id: payload.ownerId || null,
    }
}
