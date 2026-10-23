import { type MemberProfile, type ProjectTeam } from "@/features/projects/types"
import { supabase } from "@/integrations/supabase/client"

import { mapTeams } from "./mapTeams"

export async function fetchBoards(): Promise<ProjectTeam[]> {
    const { data, error } = await supabase
        .from("project_teams")
        .select(
            `
            *,
            project_team_members (
                id,
                team_id,
                user_id,
                role,
                created_at,
                profile:profiles!project_team_members_user_id_fkey (
                    user_id,
                    full_name,
                    email,
                    avatar_url
                )
            ),
            project_sprints (
                *,
                project_tasks (
                    *,
                    assignee:profiles!project_tasks_assignee_id_fkey (
                        user_id,
                        full_name,
                        email,
                        avatar_url
                    ),
                    last_moved_by_profile:profiles!project_tasks_last_moved_by_fkey (
                        user_id,
                        full_name,
                        email,
                        avatar_url
                    ),
                    attachments:project_task_attachments (id, file_name, size_bytes)
                )
            )
        `
        )
        .order("created_at", { ascending: true })
        .order("created_at", {
            ascending: true,
            foreignTable: "project_sprints",
        })
        .order("position", {
            ascending: true,
            foreignTable: "project_sprints.project_tasks",
        })

    if (error) throw error
    return mapTeams(data || [])
}

export async function fetchServiceMembers(
    serviceId: string,
): Promise<MemberProfile[]> {
    const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url, service_id")
        .eq("service_id", serviceId)
        .order("full_name", { ascending: true })
        .order("email", { ascending: true })

    if (error) throw error

    return (data || []).map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        avatar_url: p.avatar_url,
    }))
}
