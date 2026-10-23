// context/project/useProjectMembers.ts
import { useEffect, useMemo, useState } from "react"
import type { UseProjectsReturn } from "@/features/projects/hooks/Projects/useProjects"
import type { UseProjectSelectionReturn } from "./useProjectSelection"

export function useProjectMembers({
    projectApi,
    selection,
}: {
    projectApi: UseProjectsReturn
    selection: UseProjectSelectionReturn
}) {
    const { selectedProject } = selection
    const { serviceMembers } = projectApi

    const [projectDirectorySearch, setProjectDirectorySearch] = useState("")
    const [inviteSearch, setInviteSearch] = useState("")
    const [inviteMemberOpen, setInviteMemberOpen] = useState(false)

    useEffect(() => {
        // Reset invite UI state when the selected project changes (resync on entity change)
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setInviteSearch("")
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setInviteMemberOpen(false)
    }, [selectedProject])

    const directoryMembers = useMemo(
        () => serviceMembers.filter((m) => Boolean(m.email)),
        [serviceMembers]
    )

    const availableInviteMembers = useMemo(() => {
        if (!selectedProject) return directoryMembers

        const existing = new Set()
        existing.add(selectedProject.owner_id)
        selectedProject.members.forEach((m) => existing.add(m.user_id))

        return directoryMembers.filter(
            (m) => m.user_id && !existing.has(m.user_id)
        )
    }, [directoryMembers, selectedProject])

    const filteredCreationDirectory = useMemo(() => {
        const term = projectDirectorySearch.toLowerCase().trim()
        if (!term) return directoryMembers
        return directoryMembers.filter(
            (m) =>
                (m.full_name ?? "").toLowerCase().includes(term) ||
                (m.email ?? "").toLowerCase().includes(term)
        )
    }, [directoryMembers, projectDirectorySearch])

    const filteredInviteMembers = useMemo(() => {
        const term = inviteSearch.toLowerCase().trim()
        if (!term) return availableInviteMembers
        return availableInviteMembers.filter(
            (m) =>
                (m.full_name ?? "").toLowerCase().includes(term) ||
                (m.email ?? "").toLowerCase().includes(term)
        )
    }, [availableInviteMembers, inviteSearch])

    const projectMembers = useMemo(() => {
        if (!selectedProject) return []
        return selectedProject.members.map((m) => ({
            userId: m.user_id,
            label: m.profile?.full_name ?? m.profile?.email ?? "Collaborateur",
            email: m.profile?.email ?? null,
            avatar_url: m.profile?.avatar_url ?? null,
            role: m.role,
        }))
    }, [selectedProject])

    return {
        projectDirectorySearch,
        setProjectDirectorySearch,
        inviteSearch,
        setInviteSearch,
        inviteMemberOpen,
        setInviteMemberOpen,
        filteredCreationDirectory,
        filteredInviteMembers,
        projectMembers,
        directoryMembers,
    }
}

export type UseProjectMembersReturn = ReturnType<typeof useProjectMembers>
