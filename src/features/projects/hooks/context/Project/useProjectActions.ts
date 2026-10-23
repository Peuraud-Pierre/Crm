// context/project/useProjectActions.ts
import type { MemberProfile } from "@/features/projects/types"
import { toast } from "sonner"
import type { UseProjectsReturn } from "@/features/projects/hooks/Projects/useProjects"
import type { AppUser } from "@/features/auth/hooks/useAuth"
import { useState } from "react"

import type { UseProjectFormsReturn } from "./useProjectForms"
import type { UseProjectPermissionsReturn } from "./useProjectPermissions"
import type { UseProjectSelectionReturn } from "./useProjectSelection"

export function useProjectActions(
    selection: UseProjectSelectionReturn,
    forms: UseProjectFormsReturn,
    projectApi: UseProjectsReturn,
    permissions: UseProjectPermissionsReturn,
    user: AppUser
) {
    const { selectedProject, setSelectedProjectId } = selection
    const {
        createTeam,
        removeTeamMember,
        addTeamMember,
        updateProjectStatus,
        deleteTeam,
    } = projectApi
    const { projectForm, setProjectForm, setCreateProjectOpen } = forms
    const { isSuperAdmin } = permissions

    const [submitting, setSubmitting] = useState<string | null>(null)

    const handleCreateProject = async () => {
        if (!projectForm.name.trim()) {
            toast.error("Nom requis", { description: "Veuillez nommer le projet" })
            return
        }

        setSubmitting("project")
        const res = await createTeam({
            name: projectForm.name.trim(),
            description: projectForm.description.trim() || undefined,
            memberIds: projectForm.members,
            actorName: user?.full_name ?? user?.email ?? null,
        })
        setSubmitting(null)

        if (res.success) {
            setProjectForm({ name: "", description: "", members: [] })
            setCreateProjectOpen(false)
        }
    }

    const addMemberToProjectForm = (userId: string) => {
        setProjectForm((prev) => {
            if (prev.members.includes(userId)) return prev
            return { ...prev, members: [...prev.members, userId] }
        })
    }

    const removeMemberFromForm = (userId: string) => {
        setProjectForm((prev) => ({
            ...prev,
            members: prev.members.filter((item) => item !== userId),
        }))
    }

    const handleInviteFromDirectory = async (member: MemberProfile) => {
        if (!selectedProject) return
        const memberId = member.user_id
        setSubmitting(`invite:${memberId}`)
        const result = await addTeamMember({
            teamId: selectedProject.id,
            userId: memberId,
            projectName: selectedProject.name,
            actorName: user?.full_name ?? user?.email ?? null,
        })
        setSubmitting(null)
        if (!result.success) return
    }

    const handleArchiveProject = async () => {
        if (!selectedProject) return

        setSubmitting("archive")
        const res = await updateProjectStatus({
            teamId: selectedProject.id,
            status: "archived",
            memberIds: selectedProject.members.map((m) => m.user_id),
            projectName: selectedProject.name,
            actorName: user?.full_name ?? user?.email ?? null,
            actorIsGlobalAdmin: isSuperAdmin,
        })
        setSubmitting(null)

        if (res.success) {
            setSelectedProjectId(null)
        }
    }

    const handleRestoreProject = async () => {
        if (!selectedProject) return

        setSubmitting("restore")
        const res = await updateProjectStatus({
            teamId: selectedProject.id,
            status: "active",
            memberIds: selectedProject.members.map((m) => m.user_id),
            projectName: selectedProject.name,
            actorName: user?.full_name ?? user?.email ?? null,
            actorIsGlobalAdmin: isSuperAdmin,
        })
        setSubmitting(null)

        if (res.success) setSelectedProjectId(selectedProject.id)
    }

    const handleDeleteProject = async () => {
        if (!selectedProject) return

        setSubmitting("delete-project")
        await deleteTeam({
            teamId: selectedProject.id,
            memberIds: selectedProject.members.map((m) => m.user_id),
            projectName: selectedProject.name,
            actorName: user?.full_name ?? user?.email ?? null,
        })
        setSubmitting(null)
    }

    const handleRemoveMember = async (memberId: string) => {
        if (!selectedProject) return

        if (memberId === selectedProject.owner_id) {
            toast.error("Action interdite", { description: "Le responsable du projet ne peut pas être retiré" })
            return
        }

        setSubmitting(`remove:${memberId}`)

        const result = await removeTeamMember({
            teamId: selectedProject.id,
            userId: memberId,
            projectName: selectedProject.name,
            actorName: user?.full_name ?? user?.email ?? null,
        })

        setSubmitting(null)

        return result.success
    }

    return {
        addMemberToProjectForm,
        removeMemberFromForm,
        handleRemoveMember,
        submitting,
        handleInviteFromDirectory,
        handleCreateProject,
        handleArchiveProject,
        handleRestoreProject,
        handleDeleteProject,
    }
}

export type UseProjectActionsReturn = ReturnType<typeof useProjectActions>
