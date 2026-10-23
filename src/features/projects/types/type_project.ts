import type { Database } from "@/integrations/supabase/types"

// ─── Enums ───────────────────────────────────────────────────────────────────
export type ProjectStatus = Database["public"]["Enums"]["project_team_status"]
export type SprintStatus = Database["public"]["Enums"]["project_sprint_status"]
export type TaskStatus = Database["public"]["Enums"]["project_task_status"]
export type TaskPriority = Database["public"]["Enums"]["Priorities"]

export const TECH_SERVICE_ID = "6d68bcce-fa82-4020-9e16-714f9a64e5f4"

// ─── Member ───────────────────────────────────────────────────────────────────
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

// ─── Task ─────────────────────────────────────────────────────────────────────
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
    /** Absent hors chargement des tableaux (ex. widget « Mes tâches »). */
    attachments?: ProjectTaskAttachmentSummary[]
}

// ─── Task attachment ─────────────────────────────────────────────────────────
export type ProjectTaskAttachment =
    Database["public"]["Tables"]["project_task_attachments"]["Row"]

/** Ce que chargent les tableaux : de quoi afficher l'indicateur de la carte. */
export type ProjectTaskAttachmentSummary = Pick<
    ProjectTaskAttachment,
    "id" | "file_name" | "size_bytes"
>

// ─── Sprint ───────────────────────────────────────────────────────────────────
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

// ─── Team ─────────────────────────────────────────────────────────────────────
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
