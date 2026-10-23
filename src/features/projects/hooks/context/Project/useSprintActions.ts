// context/project/useSprintActions.ts
import { toast } from "sonner"
import { useState } from "react"
import type { UseProjectSelectionReturn } from "./useProjectSelection"
import type { UseProjectFormsReturn } from "./useProjectForms"
import type { UseProjectsReturn } from "@/features/projects/hooks/Projects/useProjects"
import type { UseProjectPermissionsReturn } from "./useProjectPermissions"
import type { AppUser } from "@/features/auth/hooks/useAuth"

export interface SprintActionsProps {
    selection: UseProjectSelectionReturn
    forms: UseProjectFormsReturn
    projectApi: UseProjectsReturn
    permissions: UseProjectPermissionsReturn
    user: AppUser
    setCreateSprintOpen: (open: boolean) => void
}

export function useSprintActions({
    selection,
    forms,
    projectApi,
    permissions,
    user,
    setCreateSprintOpen,
}: SprintActionsProps) {
    const { selectedProject, selectedSprint, setSelectedSprintId } = selection
    const { sprintForm, setSprintForm } = forms
    const { createSprint, deleteSprint, updateSprint, updateSprintStatus } = projectApi
    const { isProjectOwner, canInteractWithProject } = permissions

    const [submitting, setSubmitting] = useState<string | null>(null)

    const handleCreateSprint = async () => {
        if (!selectedProject) return

        if (!canInteractWithProject) {
            toast.error("Droit insuffisant", { description: "Vous ne pouvez pas créer de sprint." })
            return
        }

        if (!sprintForm.name.trim()) {
            toast.error("Nom requis", { description: "Veuillez nommer le sprint" })
            return
        }

        setSubmitting("sprint")
        try {
            const res = await createSprint({
                teamId: selectedProject.id,
                name: sprintForm.name.trim(),
                goal: sprintForm.goal.trim() || undefined,
                startDate: sprintForm.startDate || null,
                endDate: sprintForm.endDate || null,
                actorName: user?.full_name ?? user?.email ?? null,
            })

            if (res.success) {
                setSprintForm({ name: "", goal: "", startDate: "", endDate: "" })
                setCreateSprintOpen(false)
            }
        } catch {
            toast.error("Erreur", { description: "Impossible de créer le sprint." })
        } finally {
            setSubmitting(null)
        }
    }

    const handleArchiveSprint = async () => {
        if (!selectedSprint || !isProjectOwner) return

        setSubmitting("archive-sprint")
        try {
            await updateSprintStatus({
                sprintId: selectedSprint.id,
                status: "archived",
                actorName: user?.full_name ?? user?.email ?? null,
            })
        } catch {
            toast.error("Erreur", { description: "Impossible d'archiver le sprint." })
        } finally {
            setSubmitting(null)
        }
    }

    const handleReactivateSprint = async () => {
        if (!selectedSprint || !isProjectOwner) return

        setSubmitting("reactivate-sprint")
        try {
            await updateSprintStatus({
                sprintId: selectedSprint.id,
                status: "active",
                actorName: user?.full_name ?? user?.email ?? null,
            })
            setSelectedSprintId(selectedSprint.id)
        } catch {
            toast.error("Erreur", { description: "Impossible de réactiver le sprint." })
        } finally {
            setSubmitting(null)
        }
    }

    const handleDeleteSprint = async () => {
        if (!selectedSprint || !selectedProject) return

        setSubmitting("delete-sprint")
        try {
            const res = await deleteSprint({
                sprintId: selectedSprint.id,
                teamId: selectedProject.id,
            })

            if (res.success) {
                setSelectedSprintId(null)
            }
        } catch {
            toast.error("Erreur", { description: "Impossible de supprimer le sprint." })
        } finally {
            setSubmitting(null)
        }
    }

    const handleUpdateSprintDates = async (updates: {
        start_date?: string | null
        end_date?: string | null
    }) => {
        if (!selectedSprint || !canInteractWithProject) return

        setSubmitting("update-sprint")
        try {
            await updateSprint({
                sprintId: selectedSprint.id,
                updates,
                actorName: user?.full_name ?? user?.email ?? null,
            })
        } catch {
            toast.error("Erreur", { description: "Impossible de modifier les dates du sprint." })
        } finally {
            setSubmitting(null)
        }
    }

    const handleUpdateSprintGoal = async (goal: string) => {
        if (!selectedSprint || !canInteractWithProject) return

        const trimmed = goal.trim()
        if ((selectedSprint.goal ?? "") === trimmed) return

        setSubmitting("update-sprint-goal")
        try {
            await updateSprint({
                sprintId: selectedSprint.id,
                updates: { goal: trimmed || null },
                actorName: user?.full_name ?? user?.email ?? null,
            })
        } catch {
            toast.error("Erreur", { description: "Impossible de modifier l'objectif du sprint." })
        } finally {
            setSubmitting(null)
        }
    }

    return {
        submitting,
        handleCreateSprint,
        handleArchiveSprint,
        handleReactivateSprint,
        handleDeleteSprint,
        handleUpdateSprintDates,
        handleUpdateSprintGoal,
    }
}

export type UseSprintActionsReturn = ReturnType<typeof useSprintActions>
