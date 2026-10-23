import { type MemberProfile, type ProjectTeam } from "@/features/projects/types"
import { useCallback, useEffect, useState } from "react"

import * as projectStateService from "../../../services/state/projectStateService"

export function useProjectState(serviceId?: string | null) {
    const [teams, setTeams] = useState<ProjectTeam[]>([])
    const [serviceMembers, setServiceMembers] = useState<MemberProfile[]>([])
    const [loading, setLoading] = useState(true)

    // -----------------------------
    // FETCH BOARDS (projects + sprints + tasks)
    // -----------------------------
    const fetchBoards = useCallback(async () => {
        setLoading(true)
        try {
            setTeams(await projectStateService.fetchBoards())
        } catch (err) {
            console.error("fetchBoards error:", err)
        } finally {
            setLoading(false)
        }
    }, [])

    // -----------------------------
    // FETCH MEMBERS (user's service)
    // -----------------------------
    const fetchServiceMembers = useCallback(async () => {
        if (!serviceId) return
        try {
            setServiceMembers(await projectStateService.fetchServiceMembers(serviceId))
        } catch (err) {
            console.error("fetchServiceMembers error:", err)
        }
    }, [serviceId])

    // -----------------------------
    // FIND TASK IN ALL TEAMS
    // -----------------------------
    const findTask = useCallback(
        (taskId: string) =>
            teams
                .flatMap((t) => t.sprints)
                .flatMap((s) => s.tasks)
                .find((task) => task.id === taskId),
        [teams]
    )

    // -----------------------------
    // COMPUTE NEXT POSITION IN A COLUMN
    // -----------------------------
    const getNextPosition = useCallback(
        (sprintId: string, status: string) => {
            const sprint = teams
                .flatMap((t) => t.sprints)
                .find((s) => s.id === sprintId)

            if (!sprint) return 1

            const positions = sprint.tasks
                .filter((task) => task.status === status)
                .map((task) => task.position ?? 0)

            if (positions.length === 0) return 1

            return Math.max(...positions) + 1
        },
        [teams]
    )

    // -----------------------------
    // AUTO LOAD DATA ON MOUNT
    // -----------------------------
    useEffect(() => {
        fetchBoards()
        fetchServiceMembers()
    }, [fetchBoards, fetchServiceMembers])

    // -----------------------------
    // RETURN STORE API
    // -----------------------------
    return {
        teams,
        serviceMembers,
        loading,
        fetchBoards,
        refreshMembers: fetchServiceMembers,
        findTask,
        getNextPosition,
    }
}
