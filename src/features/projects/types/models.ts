import type { ProjectStatus, SprintStatus, TaskPriority, TaskStatus } from "./enums"

export interface MemberProfile {
    user_id: string
    full_name: string | null
    email: string | null
    avatar_url?: string | null
}

export interface ProjectTeamMember {
    id: string
    team_id: string
    user_id: string
    role: string
    profile?: MemberProfile
}

export interface ProjectTask {
    id: string
    sprint_id: string
    title: string
    description: string | null
    status: TaskStatus
    assignee_id: string | null
    assignee?: MemberProfile
    created_by: string
    due_date: string | null
    position: number
    priority: TaskPriority | "Normal"
    last_moved_by: string | null
    last_moved_at: string | null
    last_moved_by_profile?: MemberProfile
    created_at: string
}

export interface ProjectSprint {
    id: string
    team_id: string
    name: string
    goal: string | null
    status: SprintStatus
    start_date: string | null
    end_date: string | null
    created_by: string
    created_at: string
    tasks: ProjectTask[]
}

export interface ProjectTeam {
    id: string
    name: string
    description: string | null
    owner_id: string
    created_at: string
    status: ProjectStatus
    members: ProjectTeamMember[]
    sprints: ProjectSprint[]
}

export interface ProjectSelection {
    selectedSprint: ProjectSprint | null
}
