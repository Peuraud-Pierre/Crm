import type { UpdateSprintPayload } from "@/features/projects/types"
import { supabase } from "@/integrations/supabase/client"
import { buildProjectPath } from "@/features/projects/routes/projectRoutes"
import { toast } from "sonner"

import { getErrorMessage, isRlsViolation } from "../errorUtils"

export const updateSprint = async ({
    sprintId,
    updates,
    actorName,
    fetchBoards,
    teams,
    sendProjectNotifications,
    broadcastRefresh,
}: UpdateSprintPayload) => {
    try {
        const { error } = await supabase
            .from("project_sprints")
            .update(updates)
            .eq("id", sprintId)

        if (error) throw error

        const sprintTeam = teams.find((team) =>
            team.sprints.some((sprint) => sprint.id === sprintId)
        )

        if (sprintTeam) {
            const sprint = sprintTeam.sprints.find(
                (item) => item.id === sprintId
            )
            const recipients = new Set<string>()
            recipients.add(sprintTeam.owner_id)
            sprintTeam.members.forEach((member) =>
                recipients.add(member.user_id)
            )

            const sprintName = sprint?.name ?? "ce sprint"
            const userIds = Array.from(recipients).filter(Boolean)
            if (userIds.length > 0) {
                await sendProjectNotifications({
                    userIds,
                    title: "Sprint mis à jour",
                    message: `${
                        actorName ?? "Un responsable"
                    } a modifié les dates du sprint "${sprintName}"`,
                    url: buildProjectPath({
                        projectId: sprintTeam.id,
                        sprintId,
                    }),
                })
            }
        }

        toast.success("Sprint mis à jour")
        await fetchBoards()
        await broadcastRefresh()
        return { success: true }
    } catch (error: unknown) {
        console.error("updateSprint", error)
        if (isRlsViolation(error)) {
            toast.error("Vous n'avez pas les droits pour modifier ce sprint.")
        } else {
            toast.error("Impossible de mettre à jour le sprint")
        }
        return { success: false, error: getErrorMessage(error) }
    }
}
