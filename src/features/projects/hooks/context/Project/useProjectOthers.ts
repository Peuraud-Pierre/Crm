import type { ProjectTeam } from "@/features/projects/types"
import { useMemo } from "react"

export function useProjectOthers({
    canViewAll,
    activeTeams,
    projectsInvolved,
}: {
    canViewAll: boolean
    activeTeams: ProjectTeam[]
    projectsInvolved: ProjectTeam[]
}) {
    const projectsOthers = useMemo(() => {
        if (!canViewAll) return [] as ProjectTeam[]
        const involvedIds = new Set(projectsInvolved.map((t) => t.id))
        return activeTeams.filter((team) => !involvedIds.has(team.id))
    }, [activeTeams, projectsInvolved, canViewAll])

    return {
        projectsOthers,
    }
}
