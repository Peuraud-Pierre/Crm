import type { CreateSprintPayload } from "@/features/projects/types"
import { supabase } from "@/integrations/supabase/client"
import { buildProjectPath } from "@/features/projects/routes/projectRoutes"
import { toast } from "sonner"

import { getErrorMessage, isRlsViolation } from "../errorUtils"

export const createSprint = async ({
    teamId,
    name,
    goal,
    startDate,
    endDate,
    actorName,
    sendProjectNotifications,
    fetchBoards,
    broadcastRefresh,
    teams,
}: CreateSprintPayload) => {
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
        toast.error("Session expirée")
        return {
            success: false,
            error: authError?.message ?? "not_authenticated",
        }
    }

    try {
        const { error } = await supabase.from("project_sprints").insert({
            team_id: teamId,
            name,
            goal: goal || null,
            start_date: startDate || null,
            end_date: endDate || null,
            created_by: user.id,
        })

        if (error) throw error

        const team = teams.find((current) => current.id === teamId)
        if (team) {
            const recipients = new Set<string>()
            recipients.add(team.owner_id)
            team.members.forEach((member) => recipients.add(member.user_id))
            recipients.delete(user.id)

            await sendProjectNotifications({
                userIds: Array.from(recipients),
                title: "Nouveau sprint",
                message: `${
                    actorName ?? "Un responsable"
                } a planifié le sprint "${name}"`,
                url: buildProjectPath({ projectId: teamId }),
            })
        }

        toast.success("Sprint créé")
        await fetchBoards()
        await broadcastRefresh()
        return { success: true }
    } catch (error: unknown) {
        console.error("createSprint", error)
        if (isRlsViolation(error)) {
            toast.error(
                "Vous n'avez pas l'autorisation de créer un sprint pour cette équipe."
            )
        } else {
            toast.error("Impossible de créer le sprint")
        }
        return { success: false, error: getErrorMessage(error) }
    }
}
