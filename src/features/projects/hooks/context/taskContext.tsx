import { createContext, use, useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useProjectListContext } from "./projectListContext"
import { useTaskActions } from "./Project/useTaskActions"
import { useDragAndDrop } from "./Project/useDragAndDrop"
import { useProjectComputed } from "./Project/useProjectComputed"
import { useTaskFilters } from "./Project/useTaskFilters"
import { hashToColor } from "./Project/utils"
import type { UseProjectFormsReturn } from "./Project/useProjectForms"
import type { ProjectTask, TaskPriority } from "@/features/projects/types"

function useTaskState() {
    const { selection, projectApi, permissions, user, selectedProject } =
        useProjectListContext()

    // Task UI state
    const [taskToDelete, setTaskToDelete] = useState<ProjectTask | null>(null)
    const [createTaskOpen, setCreateTaskOpen] = useState(false)

    // Sheet de détail : piloté par le segment `taskId` de l'URL
    // (/projects/:projectId/:view/:taskId — docs/ROUTING.md), donc deep-linkable.
    const { taskId, go, selectedSprint } = selection

    const detailTask = useMemo(
        () =>
            taskId
                ? selectedSprint?.tasks.find((t) => t.id === taskId) ?? null
                : null,
        [taskId, selectedSprint]
    )

    const setDetailTask = useCallback(
        (task: ProjectTask | null) => {
            go({ taskId: task?.id ?? null })
        },
        [go]
    )

    // Garde : tâche introuvable dans le sprint courant une fois chargé
    // (supprimée, ou id bidon dans l'URL) → on referme sans casser la page.
    useEffect(() => {
        if (taskId && selectedSprint && !detailTask) {
            go({ taskId: null }, { replace: true })
        }
    }, [taskId, selectedSprint, detailTask, go])

    // Task creation form
    const currentUserId = user?.user_id ?? user?.id ?? ""
    const [taskForm, setTaskForm] = useState({
        title: "",
        description: "",
        priority: "Normal" as TaskPriority,
        dueDate: "",
        assigneeId: currentUserId,
    })

    // Task edit form
    const [editTask, setEditTask] = useState<ProjectTask | null>(null)
    const [editTaskForm, setEditTaskForm] = useState({
        title: "",
        description: "",
        priority: "Normal" as TaskPriority,
        dueDate: "",
        assigneeId: "",
    })

    useEffect(() => {
        // Resync the controlled edit form to the selected task entity
        if (!editTask) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setEditTaskForm({
                title: "",
                description: "",
                priority: "Normal",
                dueDate: "",
                assigneeId: "",
            })
            return
        }
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setEditTaskForm({
            title: editTask.title,
            description: editTask.description ?? "",
            priority: editTask.priority,
            dueDate: editTask.due_date ? editTask.due_date.split("T")[0] : "",
            assigneeId: editTask.assignee_id ?? "",
        })
    }, [editTask])

    const getTaskColor = useCallback(
        (task: ProjectTask) => {
            const base =
                task.last_moved_by ??
                task.assignee_id ??
                selectedProject?.owner_id ??
                null
            return hashToColor(base)
        },
        [selectedProject?.owner_id]
    )

    // Forms adapter for useTaskActions (only uses task form fields)
    const formsForTaskActions: UseProjectFormsReturn = {
        taskForm,
        setTaskForm,
        editTask,
        setEditTask,
        editTaskForm,
        setEditTaskForm,
        createProjectOpen: false,
        setCreateProjectOpen: () => {},
        selectedCreationMembers: [],
        projectForm: { name: "", description: "", members: [] },
        setProjectForm: () => {},
        sprintForm: { name: "", goal: "", startDate: "", endDate: "" },
        setSprintForm: () => {},
    }

    const taskActions = useTaskActions({
        selection,
        forms: formsForTaskActions,
        projectApi,
        permissions,
        user,
    })

    const dnd = useDragAndDrop({ selection, projectApi, permissions })
    const computed = useProjectComputed(selection, dnd.pendingMove)
    const taskFilters = useTaskFilters(computed.tasksByStatus, selection.selectedSprint)

    return {
        // Task UI
        taskToDelete,
        setTaskToDelete,
        detailTask,
        setDetailTask,
        createTaskOpen,
        setCreateTaskOpen,
        getTaskColor,
        // Task forms
        taskForm,
        setTaskForm,
        editTask,
        setEditTask,
        editTaskForm,
        setEditTaskForm,
        // Task actions
        ...taskActions,
        // DnD
        ...dnd,
        // Computed
        ...computed,
        // Filters (filteredTasksByStatus overrides tasksByStatus)
        ...taskFilters,
        tasksByStatus: taskFilters.filteredTasksByStatus,
    }
}

type TaskCtx = ReturnType<typeof useTaskState>
const TaskContext = createContext<TaskCtx | null>(null)

export function TaskProvider({ children }: { children: ReactNode }) {
    const value = useTaskState()
    return <TaskContext value={value}>{children}</TaskContext>
}

export function useTaskContext() {
    const ctx = use(TaskContext)
    if (!ctx)
        throw new Error("useTaskContext must be used within <TaskProvider>")
    return ctx
}
