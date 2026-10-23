import { createContext, use, useMemo } from "react"
import type { ReactNode } from "react"
import { useProjectListContext } from "./projectListContext"
import { useProjectMembers } from "./Project/useProjectMembers"
import type { MemberProfile } from "@/features/projects/types"

function useProjectMembersState() {
    const { projectApi, selection, projectForm } = useProjectListContext()
    const members = useProjectMembers({ projectApi, selection })

    // Members selected for project creation form
    const selectedCreationMembers = useMemo((): MemberProfile[] => {
        return projectForm.members
            .map((userId) =>
                members.directoryMembers.find((m) => m.user_id === userId)
            )
            .filter((m): m is MemberProfile => Boolean(m))
    }, [projectForm.members, members.directoryMembers])

    return {
        ...members,
        selectedCreationMembers,
    }
}

type ProjectMembersCtx = ReturnType<typeof useProjectMembersState>
const ProjectMembersContext = createContext<ProjectMembersCtx | null>(null)

export function ProjectMembersProvider({ children }: { children: ReactNode }) {
    const value = useProjectMembersState()
    return <ProjectMembersContext value={value}>{children}</ProjectMembersContext>
}

export function useProjectMembersContext() {
    const ctx = use(ProjectMembersContext)
    if (!ctx)
        throw new Error(
            "useProjectMembersContext must be used within <ProjectMembersProvider>"
        )
    return ctx
}
