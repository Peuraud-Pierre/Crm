import type { UpdateSprintStatusPayload } from "@/features/projects/types"
import { supabase } from "@/integrations/supabase/client"
import { buildProjectPath } from "@/features/projects/routes/projectRoutes"
import { toast } from "sonner"

import { getErrorMessage, isRlsViolation } from "../errorUtils"

export const updateSprintStatus = async ({
    sprintId,
    status,
    actorName,
    fetchBoards,
    teams,
    sendProjectNotifications,
    broadcastRefresh,
}: UpdateSprintStatusPayload) => {
    try {
        const { error } = await supabase
            .from("project_sprints")
            .update({ status })
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
            const title =
                status === "archived"
                    ? "Sprint archivé"
                    : status === "active"
                    ? "Sprint réactivé"
                    : "Sprint mis à jour"
            const message =
                status === "archived"
                    ? `${
                          actorName ?? "Un responsable"
                      } a archivé le sprint "${sprintName}"`
                    : status === "active"
                    ? `${
                          actorName ?? "Un responsable"
                      } a réactivé le sprint "${sprintName}"`
                    : `${
                          actorName ?? "Un responsable"
                      } a mis à jour le sprint "${sprintName}"`

            const userIds = Array.from(recipients).filter(Boolean)
            if (userIds.length > 0) {
                await sendProjectNotifications({
                    userIds,
                    title,
                    message,
                    url: buildProjectPath({
                        projectId: sprintTeam.id,
                        sprintId,
                    }),
                })
            }
        }

        toast.success(
            status === "archived"
                ? "Sprint archivé"
                : status === "active"
                ? "Sprint réactivé"
                : "Sprint mis à jour"
        )
        await fetchBoards()
        await broadcastRefresh()
        return { success: true }
    } catch (error: unknown) {
        console.error("updateSprintStatus", error)
        if (isRlsViolation(error)) {
            toast.error("Vous n'avez pas les droits pour modifier ce sprint.")
        } else {
            toast.error("Impossible de mettre à jour le sprint")
        }
        return { success: false, error: getErrorMessage(error) }
    }
}
