// context/project/useTaskActions.ts
import { toast } from "sonner"
import { useState } from "react"
import type { UseProjectFormsReturn } from "./useProjectForms"
import type { UseProjectPermissionsReturn } from "./useProjectPermissions"
import type { UseProjectsReturn } from "@/features/projects/hooks/Projects/useProjects"
import type { UseProjectSelectionReturn } from "./useProjectSelection"
import type { AppUser } from "@/features/auth/hooks/useAuth"
import type { ProjectTask } from "@/features/projects/types"

export function useTaskActions({
    selection,
    forms,
    projectApi,
    permissions,
    user,
}: {
    selection: UseProjectSelectionReturn
    forms: UseProjectFormsReturn
    projectApi: UseProjectsReturn
    permissions: UseProjectPermissionsReturn
    user: AppUser
}) {
    const { selectedSprint } = selection
    const { taskForm, setTaskForm, editTask, editTaskForm, setEditTask } = forms
    const { createTask, deleteTask, updateTask, moveTaskToSprint } = projectApi
    const { canInteractWithProject, isSprintArchived } = permissions

    const [submitting, setSubmitting] = useState<string | null>(null)

    const handleCreateTask = async (
        setCreateTaskOpen: (open: boolean) => void,
        files: File[] = []
    ) => {
        if (!selectedSprint) return

        if (isSprintArchived) {
            toast.error("Sprint archivé", { description: "Impossible de créer une tâche." })
            return
        }

        if (!canInteractWithProject) {
            toast.error("Droit insuffisant", { description: "Vous ne pouvez pas créer de tâche." })
            return
        }

        if (!taskForm.title.trim()) {
            toast.error("Nom requis", { description: "Veuillez nommer la tâche" })
            return
        }

        setSubmitting("task")
        try {
            const res = await createTask({
                sprintId: selectedSprint.id,
                title: taskForm.title.trim(),
                description: taskForm.description.trim() || undefined,
                priority: taskForm.priority,
                dueDate: taskForm.dueDate || null,
                assigneeId: taskForm.assigneeId || undefined,
                files,
            })
            setCreateTaskOpen(false)

            if (res.success) {
                setTaskForm({
                    title: "",
                    description: "",
                    priority: "Normal",
                    dueDate: "",
                    assigneeId: user?.user_id ?? user?.id ?? "",
                })
            }
        } catch {
            toast.error("Erreur", { description: "Impossible de créer la tâche." })
        } finally {
            setSubmitting(null)
        }
    }

    const startEditingTask = (task: ProjectTask) => {
        if (isSprintArchived) return
        setEditTask(task)
    }

    const handleEditTaskSubmit = async () => {
        if (!editTask) return

        if (!editTaskForm.title.trim()) {
            toast.error("Titre requis", { description: "Veuillez nommer la tâche" })
            return
        }

        setSubmitting("edit-task")
        try {
            await updateTask(editTask.id, {
                title: editTaskForm.title.trim(),
                description: editTaskForm.description.trim() || null,
                priority: editTaskForm.priority,
                due_date: editTaskForm.dueDate || null,
                assignee_id: editTaskForm.assigneeId || null,
            })
            setEditTask(null)
            toast.success("Tâche mise à jour")
        } catch {
            toast.error("Erreur", { description: "Impossible de mettre à jour la tâche." })
        } finally {
            setSubmitting(null)
        }
    }

    const handleDeleteTask = async ({
        taskToDelete,
        setTaskToDelete,
    }: {
        taskToDelete: ProjectTask | null
        setTaskToDelete: (task: ProjectTask | null) => void
    }) => {
        if (!taskToDelete) return
        if (isSprintArchived) {
            toast.error("Sprint archivé", { description: "Réactivez le sprint pour supprimer des tâches." })
            setTaskToDelete(null)
            return
        }

        setSubmitting(`delete-task:${taskToDelete.id}`)
        try {
            const result = await deleteTask(
                taskToDelete.id,
                user?.full_name ?? user?.email ?? ""
            )
            if (result.success) setTaskToDelete(null)
        } catch {
            toast.error("Erreur", { description: "Impossible de supprimer la tâche." })
        } finally {
            setSubmitting(null)
        }
    }

    const handleMoveTask = async (taskId: string, targetSprintId: string) => {
        if (!canInteractWithProject) {
            toast.error("Droit insuffisant", { description: "Vous ne pouvez pas déplacer cette tâche." })
            return
        }

        setSubmitting(`move-task:${taskId}`)
        try {
            await moveTaskToSprint(taskId, targetSprintId)
        } catch {
            toast.error("Erreur", { description: "Impossible de déplacer la tâche." })
        } finally {
            setSubmitting(null)
        }
    }

    return {
        submitting,
        handleCreateTask,
        startEditingTask,
        handleEditTaskSubmit,
        handleDeleteTask,
        handleMoveTask,
    }
}

export type UseTaskActionsReturn = ReturnType<typeof useTaskActions>
