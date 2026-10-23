// src/modules/projects/state/mapTeams.ts
import type {
    MemberProfile,
    ProjectSprint,
    ProjectStatus,
    ProjectTask,
    ProjectTaskAttachmentSummary,
    ProjectTeam,
    ProjectTeamMember,
    SprintStatus,
    TaskPriority,
    TaskStatus,
} from "@/features/projects/types"

/** Shape of profile data returned by Supabase joins */
interface RawProfile {
    user_id: string
    full_name: string | null
    email: string | null
    avatar_url: string | null
}

/** Shape of a task row from the Supabase nested select */
interface RawTask {
    id: string
    sprint_id: string
    title: string
    description: string | null
    status: TaskStatus
    assignee_id: string | null
    assignee: RawProfile | null
    created_by: string
    due_date: string | null
    position: number
    priority: TaskPriority | "Normal"
    last_moved_by: string | null
    last_moved_at: string | null
    last_moved_by_profile: RawProfile | null
    created_at: string
    attachments?: ProjectTaskAttachmentSummary[]
}

/** Shape of a sprint row from the Supabase nested select */
interface RawSprint {
    id: string
    team_id: string
    name: string
    goal: string | null
    status: SprintStatus
    start_date: string | null
    end_date: string | null
    created_by: string
    created_at: string
    project_tasks: RawTask[]
}

/** Shape of a member row from the Supabase nested select */
interface RawMember {
    id: string
    team_id: string
    user_id: string
    role: string
    profile: RawProfile | null
}

/** Shape of a team row from the Supabase nested select */
export interface RawTeamRow {
    id: string
    name: string
    description: string | null
    owner_id: string
    created_at: string
    status: ProjectStatus | null
    project_team_members: RawMember[]
    project_sprints: RawSprint[]
}

function mapProfile(raw: RawProfile): MemberProfile {
    return {
        user_id: raw.user_id,
        full_name: raw.full_name,
        email: raw.email,
        avatar_url: raw.avatar_url,
    }
}

export function mapTeams(rows: RawTeamRow[]): ProjectTeam[] {
    return (rows || []).map((team) => {
        const members: ProjectTeamMember[] = (
            team.project_team_members || []
        ).map((member) => ({
            id: member.id,
            team_id: member.team_id,
            user_id: member.user_id,
            role: member.role,
            profile: member.profile ? mapProfile(member.profile) : undefined,
        }))

        const sprints: ProjectSprint[] = (team.project_sprints || []).map(
            (sprint) => ({
                id: sprint.id,
                team_id: sprint.team_id,
                name: sprint.name,
                goal: sprint.goal,
                status: sprint.status,
                start_date: sprint.start_date,
                end_date: sprint.end_date,
                created_by: sprint.created_by,
                created_at: sprint.created_at,

                tasks: (sprint.project_tasks || []).map(
                    (task): ProjectTask => ({
                        id: task.id,
                        sprint_id: task.sprint_id,
                        title: task.title,
                        description: task.description,
                        status: task.status,
                        assignee_id: task.assignee_id,
                        assignee: task.assignee
                            ? mapProfile(task.assignee)
                            : undefined,
                        created_by: task.created_by,
                        due_date: task.due_date,
                        position: task.position,
                        priority: task.priority,
                        last_moved_by: task.last_moved_by,
                        last_moved_at: task.last_moved_at,
                        last_moved_by_profile: task.last_moved_by_profile
                            ? mapProfile(task.last_moved_by_profile)
                            : undefined,
                        created_at: task.created_at,
                        attachments: task.attachments ?? [],
                    })
                ),
            })
        )

        return {
            id: team.id,
            name: team.name,
            description: team.description,
            owner_id: team.owner_id,
            created_at: team.created_at,
            status: team.status ?? "active",
            members,
            sprints,
        }
    })
}
