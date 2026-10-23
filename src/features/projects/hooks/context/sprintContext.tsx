import { createContext, use, useState } from "react"
import type { ReactNode } from "react"
import { useProjectListContext } from "./projectListContext"
import { useSprintActions } from "./Project/useSprintActions"
import type { UseProjectFormsReturn } from "./Project/useProjectForms"
import type { TaskPriority } from "@/features/projects/types"

type SprintForm = { name: string; goal: string; startDate: string; endDate: string }

function useSprintState() {
    const { selection, projectApi, permissions, user } = useProjectListContext()

    // Dialog states
    const [createSprintOpen, setCreateSprintOpen] = useState(false)
    const [archiveSprintOpen, setArchiveSprintOpen] = useState(false)
    const [deleteSprintOpen, setDeleteSprintOpen] = useState(false)
    const [archiveProjectOpen, setArchiveProjectOpen] = useState(false)
    const [deleteProjectOpen, setDeleteProjectOpen] = useState(false)

    // Sprint creation form
    const [sprintForm, setSprintForm] = useState<SprintForm>({
        name: "",
        goal: "",
        startDate: "",
        endDate: "",
    })

    // Minimal forms adapter for useSprintActions (only uses sprintForm fields)
    const formsForSprintActions: UseProjectFormsReturn = {
        sprintForm,
        setSprintForm,
        createProjectOpen: false,
        setCreateProjectOpen: () => {},
        selectedCreationMembers: [],
        projectForm: { name: "", description: "", members: [] },
        setProjectForm: () => {},
        taskForm: {
            title: "",
            description: "",
            priority: "Normal" as TaskPriority,
            dueDate: "",
            assigneeId: "",
        },
        setTaskForm: () => {},
        editTask: null,
        setEditTask: () => {},
        editTaskForm: {
            title: "",
            description: "",
            priority: "Normal" as TaskPriority,
            dueDate: "",
            assigneeId: "",
        },
        setEditTaskForm: () => {},
    }

    const sprintActions = useSprintActions({
        selection,
        forms: formsForSprintActions,
        projectApi,
        permissions,
        user,
        setCreateSprintOpen,
    })

    return {
        // Dialog states
        createSprintOpen,
        setCreateSprintOpen,
        archiveSprintOpen,
        setArchiveSprintOpen,
        deleteSprintOpen,
        setDeleteSprintOpen,
        archiveProjectOpen,
        setArchiveProjectOpen,
        deleteProjectOpen,
        setDeleteProjectOpen,
        // Sprint form
        sprintForm,
        setSprintForm,
        // Sprint actions
        ...sprintActions,
    }
}

type SprintCtx = ReturnType<typeof useSprintState>
const SprintContext = createContext<SprintCtx | null>(null)

export function SprintProvider({ children }: { children: ReactNode }) {
    const value = useSprintState()
    return <SprintContext value={value}>{children}</SprintContext>
}

export function useSprintContext() {
    const ctx = use(SprintContext)
    if (!ctx)
        throw new Error("useSprintContext must be used within <SprintProvider>")
    return ctx
}
