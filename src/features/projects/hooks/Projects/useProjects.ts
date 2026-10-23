import type {
    CreateTeamPayload,
    DeleteTeamPayload,
    ModifyMemberPayload,
    UpdateProjectStatusPayload,
    CreateSprintPayload,
    DeleteSprintPayload,
    UpdateSprintStatusPayload,
    UpdateSprintPayload,
    CreateTaskPayload,
    UpdateTaskStatusPayload,
    UpdateTaskPayload,
    TaskPriority,
} from "@/features/projects/types"
import { useCallback } from "react"

import { sendProjectNotifications } from "../../services/notifications/sendProjectNotifications"
import { createSprint } from "../../services/sprint/createSprint"
import { deleteSprint } from "../../services/sprint/deleteSprint"
import { updateSprint } from "../../services/sprint/updateSprint"
import { updateSprintStatus } from "../../services/sprint/updateSprintStatus"
import { useProjectState } from "./state/useProjectState"
import { useProjectRealtime } from "./sync/useProjectRealtime"
import { createTask } from "../../services/task/createTask"
import { deleteTask } from "../../services/task/deleteTask"
import { updateTask } from "../../services/task/updateTask"
import { updateTaskPriority } from "../../services/task/updateTaskPriority"
import { updateTaskStatus } from "../../services/task/updateTaskStatus"
import { moveTaskToSprint } from "../../services/task/moveTaskToSprint"
import { addTeamMember } from "../../services/team/addTeamMember"
import { createTeam } from "../../services/team/createTeam"
import { deleteTeam } from "../../services/team/deleteTeam"
import { updateProjectStatus } from "../../services/project/updateProjectStatus"
import { removeTeamMember } from "../../services/team/removeTeamMember"
export { DEFAULT_PRIORITY } from "../../services/constants"

/** Deps injected by this hook — consumers only pass data props */
type TeamDeps = "sendProjectNotifications" | "fetchBoards" | "broadcastRefresh"
type SprintDeps = TeamDeps | "teams"
type SprintFindDeps = SprintDeps | "findSprint"

export function useProjects(serviceId?: string | null) {
    const {
        teams,
        serviceMembers,
        loading,
        fetchBoards,
        refreshMembers,
        findTask,
        getNextPosition,
    } = useProjectState(serviceId)

    const { broadcastRefresh } = useProjectRealtime(fetchBoards)

    // --- Team ---
    const boundCreateTeam = useCallback(
        (payload: Omit<CreateTeamPayload, TeamDeps>) =>
            createTeam({
                ...payload,
                fetchBoards,
                broadcastRefresh,
                sendProjectNotifications,
            }),
        [fetchBoards, broadcastRefresh]
    )

    const boundUpdateProjectStatus = useCallback(
        (payload: Omit<UpdateProjectStatusPayload, TeamDeps>) =>
            updateProjectStatus({
                ...payload,
                fetchBoards,
                broadcastRefresh,
                sendProjectNotifications,
            }),
        [fetchBoards, broadcastRefresh]
    )

    const boundDeleteTeam = useCallback(
        (payload: Omit<DeleteTeamPayload, TeamDeps>) =>
            deleteTeam({
                ...payload,
                fetchBoards,
                broadcastRefresh,
                sendProjectNotifications,
            }),
        [fetchBoards, broadcastRefresh]
    )

    const boundAddTeamMember = useCallback(
        (payload: Omit<ModifyMemberPayload, TeamDeps>) =>
            addTeamMember({
                ...payload,
                fetchBoards,
                broadcastRefresh,
                sendProjectNotifications,
            }),
        [fetchBoards, broadcastRefresh]
    )

    const boundRemoveTeamMember = useCallback(
        (payload: Omit<ModifyMemberPayload, TeamDeps>) =>
            removeTeamMember({
                ...payload,
                fetchBoards,
                broadcastRefresh,
                sendProjectNotifications,
            }),
        [fetchBoards, broadcastRefresh]
    )

    // --- Sprint ---
    const boundCreateSprint = useCallback(
        (payload: Omit<CreateSprintPayload, SprintDeps>) =>
            createSprint({
                ...payload,
                teams,
                fetchBoards,
                broadcastRefresh,
                sendProjectNotifications,
            }),
        [teams, fetchBoards, broadcastRefresh]
    )

    const boundDeleteSprint = useCallback(
        (payload: Omit<DeleteSprintPayload, SprintFindDeps>) =>
            deleteSprint({
                ...payload,
                teams,
                fetchBoards,
                broadcastRefresh,
                sendProjectNotifications,
                findSprint: (sprintId: string) =>
                    teams
                        .flatMap((t) => t.sprints)
                        .find((s) => s.id === sprintId),
            }),
        [teams, fetchBoards, broadcastRefresh]
    )

    const boundUpdateSprint = useCallback(
        (payload: Omit<UpdateSprintPayload, SprintFindDeps>) =>
            updateSprint({
                ...payload,
                teams,
                fetchBoards,
                broadcastRefresh,
                sendProjectNotifications,
                findSprint: (sprintId: string) =>
                    teams
                        .flatMap((t) => t.sprints)
                        .find((s) => s.id === sprintId),
            }),
        [teams, fetchBoards, broadcastRefresh]
    )

    const boundUpdateSprintStatus = useCallback(
        (payload: Omit<UpdateSprintStatusPayload, SprintFindDeps>) =>
            updateSprintStatus({
                ...payload,
                teams,
                fetchBoards,
                broadcastRefresh,
                sendProjectNotifications,
                findSprint: (sprintId: string) =>
                    teams
                        .flatMap((t) => t.sprints)
                        .find((s) => s.id === sprintId),
            }),
        [teams, fetchBoards, broadcastRefresh]
    )

    // --- Task ---
    const boundCreateTask = useCallback(
        (payload: Omit<CreateTaskPayload, "fetchBoards" | "broadcastRefresh" | "getNextPosition">) =>
            createTask({
                ...payload,
                getNextPosition,
                fetchBoards,
                broadcastRefresh,
            }),
        [getNextPosition, fetchBoards, broadcastRefresh]
    )

    const boundDeleteTask = useCallback(
        (taskId: string, actorName: string | undefined) =>
            deleteTask({
                taskId,
                actorName,
                teams,
                fetchBoards,
                broadcastRefresh,
                findTask,
                sendProjectNotifications,
            }),
        [teams, fetchBoards, broadcastRefresh, findTask]
    )

    const boundUpdateTaskStatus = useCallback(
        (taskId: string, status: UpdateTaskStatusPayload["status"]) =>
            updateTaskStatus({
                taskId,
                status,
                getNextPosition,
                fetchBoards,
                broadcastRefresh,
                findTask,
            }),
        [getNextPosition, fetchBoards, broadcastRefresh, findTask]
    )

    const boundUpdateTaskPriority = useCallback(
        (taskId: string, priority: TaskPriority) =>
            updateTaskPriority({
                taskId,
                priority,
                fetchBoards,
                broadcastRefresh,
                findTask,
            }),
        [fetchBoards, broadcastRefresh, findTask]
    )

    const boundUpdateTask = useCallback(
        (taskId: string, updates: UpdateTaskPayload["updates"]) =>
            updateTask({
                taskId,
                updates,
                findTask,
                getNextPosition,
                fetchBoards,
                broadcastRefresh,
            }),
        [findTask, getNextPosition, fetchBoards, broadcastRefresh]
    )

    const boundMoveTaskToSprint = useCallback(
        (taskId: string, targetSprintId: string) =>
            moveTaskToSprint({
                taskId,
                targetSprintId,
                fetchBoards,
                broadcastRefresh,
                findTask,
                getNextPosition,
            }),
        [fetchBoards, broadcastRefresh, findTask, getNextPosition]
    )

    return {
        teams,
        serviceMembers,
        loading,
        refresh: fetchBoards,
        refreshMembers,

        createTeam: boundCreateTeam,
        deleteTeam: boundDeleteTeam,
        addTeamMember: boundAddTeamMember,
        removeTeamMember: boundRemoveTeamMember,
        updateProjectStatus: boundUpdateProjectStatus,

        createSprint: boundCreateSprint,
        deleteSprint: boundDeleteSprint,
        updateSprint: boundUpdateSprint,
        updateSprintStatus: boundUpdateSprintStatus,

        createTask: boundCreateTask,
        deleteTask: boundDeleteTask,
        updateTask: boundUpdateTask,
        updateTaskStatus: boundUpdateTaskStatus,
        updateTaskPriority: boundUpdateTaskPriority,
        moveTaskToSprint: boundMoveTaskToSprint,
    }
}

export type UseProjectsReturn = ReturnType<typeof useProjects>
