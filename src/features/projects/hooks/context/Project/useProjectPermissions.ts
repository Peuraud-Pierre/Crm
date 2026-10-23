import { useMemo } from "react"
import type { AppUser } from "@/features/auth/hooks/useAuth"
import type { UseProjectSelectionReturn } from "./useProjectSelection"
import type {
    ProjectTeamMember,
} from "@/features/projects/types"

export function useProjectPermissions(
    selection: UseProjectSelectionReturn,
    user: AppUser
) {
    const { selectedProject, selectedSprint } = selection
    const currentUserId = user?.user_id || null

    const roleSlug = (user?.role ?? "").toLowerCase().replace(/\s+/g, "")
    const serviceSlug = (user?.service ?? "").toLowerCase().replace(/\s+/g, "")

    const isSuperAdmin = roleSlug === "superadmin"

    // Temporary: grant access to specific services until permission codes are assigned in DB
    const ALLOWED_SERVICES = ["tech", "marketing"]
    const hasServiceAccess = ALLOWED_SERVICES.includes(serviceSlug) || isSuperAdmin

    const canCreateProjects = hasServiceAccess
    const canViewAll = hasServiceAccess

    const isProjectArchived = selectedProject?.status === "archived"
    const isSprintArchived = selectedSprint?.status === "archived"

    const isInvolved = useMemo(() => {
        if (!selectedProject || !currentUserId) return false
        return (
            selectedProject.owner_id === currentUserId ||
            selectedProject.members.some(
                (m: ProjectTeamMember) => m.user_id === currentUserId
            )
        )
    }, [selectedProject, currentUserId])

    const isProjectOwner = selectedProject?.owner_id === currentUserId
    const canReactivateProject = isProjectOwner

    const canInteractWithProject = useMemo(() => {
        if (!selectedProject) return false
        if (isProjectArchived) return false
        return isInvolved
    }, [selectedProject, isProjectArchived, isInvolved])

    const canManageProject = useMemo(() => {
        if (!selectedProject || !currentUserId) return false
        if (!isInvolved) return false
        if (isProjectOwner) return true
        return canCreateProjects
    }, [selectedProject, isInvolved, currentUserId, canCreateProjects])

    const sprintInteractable = canInteractWithProject && !isSprintArchived

    const restrictedAccess = !hasServiceAccess

    return {
        roleSlug,
        isSuperAdmin,
        canCreateProjects,
        canViewAll,
        restrictedAccess,
        isInvolved,
        isProjectOwner,
        canManageProject,
        canInteractWithProject,
        canReactivateProject,
        sprintInteractable,
        isProjectArchived,
        isSprintArchived,
        currentUserId,
        serviceSlug,
    }
}

export type UseProjectPermissionsReturn = ReturnType<
    typeof useProjectPermissions
>
