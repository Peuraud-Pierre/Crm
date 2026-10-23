import { createContext, use, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useProjects } from "@/features/projects/hooks/Projects/useProjects"
import { useProjectSelection } from "./Project/useProjectSelection"
import { useProjectActions } from "./Project/useProjectActions"
import { useProjectPermissions } from "./Project/useProjectPermissions"
import { useProjectOthers } from "./Project/useProjectOthers"
import { PRIORITY_META, PRIORITY_ORDER, TASK_STATUS_COLUMNS } from "@/features/projects/project_constants"
import { hashToColor } from "@/features/projects/utils/hashToColor"
import type { UseProjectsReturn } from "@/features/projects/hooks/Projects/useProjects"
import type { UseProjectSelectionReturn } from "./Project/useProjectSelection"
import type { UseProjectPermissionsReturn } from "./Project/useProjectPermissions"
import type { UseProjectFormsReturn } from "./Project/useProjectForms"
import type { TaskPriority } from "@/features/projects/types"

type ProjectForm = { name: string; description: string; members: string[] }

function useProjectListState() {
    const { user } = useAuth()
    const projectApi = useProjects(user?.service_id ?? null)
    const selection = useProjectSelection(projectApi, user)
    const permissions = useProjectPermissions(selection, user)
    const others = useProjectOthers({
        canViewAll: permissions.canViewAll,
        activeTeams: selection.activeTeams,
        projectsInvolved: selection.projectsInvolved,
    })

    const [projectForm, setProjectForm] = useState<ProjectForm>({
        name: "",
        description: "",
        members: [],
    })
    const [createProjectOpen, setCreateProjectOpen] = useState(false)

    // Minimal forms adapter for useProjectActions (only uses projectForm fields)
    const formsForProjectActions = useMemo(
        () =>
            ({
                projectForm,
                setProjectForm,
                setCreateProjectOpen,
                createProjectOpen,
                selectedCreationMembers: [],
                sprintForm: { name: "", goal: "", startDate: "", endDate: "" },
                setSprintForm: () => {},
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
            }) as UseProjectFormsReturn,
        [projectForm, createProjectOpen]
    )

    const projectActions = useProjectActions(
        selection,
        formsForProjectActions,
        projectApi,
        permissions,
        user
    )

    return {
        user,
        // Raw typed objects exposed for child contexts
        projectApi,
        selection,
        permissions,
        // Spread selection
        ...selection,
        // Spread permissions
        ...permissions,
        // Full project API (CRUD methods + loading state)
        ...projectApi,
        // Others
        ...others,
        // Project actions
        ...projectActions,
        // Project create form
        projectForm,
        setProjectForm,
        createProjectOpen,
        setCreateProjectOpen,
        // Constants
        PRIORITY_META,
        PRIORITY_ORDER,
        TASK_STATUS_COLUMNS,
        hashToColor,
    }
}

type ProjectListCtx = ReturnType<typeof useProjectListState>
const ProjectListContext = createContext<ProjectListCtx | null>(null)

export function ProjectListProvider({ children }: { children: ReactNode }) {
    const value = useProjectListState()
    return <ProjectListContext value={value}>{children}</ProjectListContext>
}

export function useProjectListContext() {
    const ctx = use(ProjectListContext)
    if (!ctx)
        throw new Error("useProjectListContext must be used within <ProjectListProvider>")
    return ctx
}

export type { UseProjectsReturn, UseProjectSelectionReturn, UseProjectPermissionsReturn }
