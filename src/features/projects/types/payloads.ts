import type { UseProjectPermissionsReturn } from "@/features/projects/hooks/context/Project/useProjectPermissions"
import type { UseProjectsReturn } from "@/features/projects/hooks/Projects/useProjects"
import type { ProjectSelection, ProjectSprint, ProjectTask, ProjectTeam } from "./models"
import type { ProjectStatus, SprintStatus, TaskPriority, TaskStatus } from "./enums"

export interface NotificationPayload {
    userIds: string[]
    title: string
    message: string
    url?: string
}

export interface CreateTeamPayload {
    name: string
    description?: string
    memberIds?: string[]
    actorName?: string | null
    sendProjectNotifications: (payload: NotificationPayload) => Promise<void>
    fetchBoards: () => Promise<void>
    broadcastRefresh: () => Promise<void>
}

export interface ModifyMemberPayload {
    teamId: string
    userId: string
    projectName?: string
    actorName?: string | null
    sendProjectNotifications: (payload: NotificationPayload) => Promise<void>
    fetchBoards: () => Promise<void>
    broadcastRefresh: () => Promise<void>
}

export interface DeleteTeamPayload {
    teamId: string
    memberIds?: string[]
    projectName?: string
    actorName?: string | null
    sendProjectNotifications: (payload: NotificationPayload) => Promise<void>
    fetchBoards: () => Promise<void>
    broadcastRefresh: () => Promise<void>
}

export interface CreateSprintPayload {
    teamId: string
    name: string
    goal?: string
    startDate?: string | null
    endDate?: string | null
    actorName?: string | null
    sendProjectNotifications: (payload: NotificationPayload) => Promise<void>
    fetchBoards: () => Promise<void>
    broadcastRefresh: () => Promise<void>
    teams: ProjectTeam[]
}

export interface DeleteSprintPayload {
    sprintId: string
    teamId: string
    memberIds?: string[]
    sprintName?: string
    actorName?: string | null
    fetchBoards: () => Promise<void>
    findSprint: (sprintId: string) => ProjectSprint | undefined
    teams: ProjectTeam[]
    sendProjectNotifications: (payload: NotificationPayload) => Promise<void>
    broadcastRefresh: () => Promise<void>
}

export interface UpdateSprintStatusPayload {
    sprintId: string
    status: SprintStatus
    actorName?: string | null
    fetchBoards: () => Promise<void>
    findSprint: (sprintId: string) => ProjectSprint | undefined
    teams: ProjectTeam[]
    sendProjectNotifications: (payload: NotificationPayload) => Promise<void>
    broadcastRefresh: () => Promise<void>
}

export interface UpdateProjectStatusPayload {
    teamId: string
    status: ProjectStatus
    memberIds?: string[]
    projectName?: string
    actorName?: string | null
    priority?: string
    actorIsGlobalAdmin?: boolean
    sendProjectNotifications: (payload: NotificationPayload) => Promise<void>
    fetchBoards: () => Promise<void>
    broadcastRefresh: () => Promise<void>
}

export interface CreateTaskPayload {
    sprintId: string
    title: string
    description?: string
    assigneeId?: string | null
    status?: TaskStatus
    dueDate?: string | null
    priority?: TaskPriority
    /** Pièces jointes, envoyées une fois la tâche créée. */
    files?: File[]
    fetchBoards: () => Promise<void>
    broadcastRefresh: () => Promise<void>
    getNextPosition: (sprintId: string, status: TaskStatus) => number
}

export interface DeleteTaskPayload {
    taskId: string
    memberIds?: string[]
    taskTitle?: string
    actorName?: string | null
    fetchBoards: () => Promise<void>
    findTask: (taskId: string) => ProjectTask | undefined
    teams: ProjectTeam[]
    sendProjectNotifications: (payload: NotificationPayload) => Promise<void>
    broadcastRefresh: () => Promise<void>
}

export interface UpdateTaskStatusPayload {
    taskId: string
    status: TaskStatus
    fetchBoards: () => Promise<void>
    broadcastRefresh: () => Promise<void>
    findTask: (taskId: string) => ProjectTask | undefined
    getNextPosition: (sprintId: string, status: TaskStatus) => number
}

export interface UpdateTaskPayload {
    taskId: string
    fetchBoards: () => Promise<void>
    broadcastRefresh: () => Promise<void>
    findTask: (taskId: string) => ProjectTask | undefined
    updates: Partial<Omit<ProjectTask, "id" | "sprint_id" | "created_at">>
    getNextPosition: (sprintId: string, status: TaskStatus) => number
}

export interface UpdateTaskPriorityPayload {
    taskId: string
    priority: TaskPriority
    fetchBoards: () => Promise<void>
    broadcastRefresh: () => Promise<void>
    findTask: (taskId: string) => ProjectTask | undefined
}

export interface MoveTaskToSprintPayload {
    taskId: string
    targetSprintId: string
    fetchBoards: () => Promise<void>
    broadcastRefresh: () => Promise<void>
    findTask: (taskId: string) => ProjectTask | undefined
    getNextPosition: (sprintId: string, status: TaskStatus) => number
}

export interface UpdateSprintPayload {
    sprintId: string
    updates: Partial<Pick<ProjectSprint, "start_date" | "end_date" | "name" | "goal">>
    actorName?: string | null
    fetchBoards: () => Promise<void>
    findSprint: (sprintId: string) => ProjectSprint | undefined
    teams: ProjectTeam[]
    sendProjectNotifications: (payload: NotificationPayload) => Promise<void>
    broadcastRefresh: () => Promise<void>
}

export interface UseDragAndDropPayload {
    selection: ProjectSelection
    projectApi: UseProjectsReturn
    permissions: UseProjectPermissionsReturn
}

export interface UseDragAndDropReturn {
    handleDragStart: (taskId: string) => void
    handleDragOver: (status: TaskStatus) => void
    handleDrop: (status: TaskStatus) => void
    handleDragEnd: () => void
}
