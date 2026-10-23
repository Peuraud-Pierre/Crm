import type { DeleteTaskPayload } from "@/features/projects/types"
import { supabase } from "@/integrations/supabase/client"
import { buildProjectPath } from "@/features/projects/routes/projectRoutes"
import { toast } from "sonner"

import { getErrorMessage, isRlsViolation } from "../errorUtils"
import { removeTaskAttachmentFiles } from "./taskAttachmentService"

export const deleteTask = async ({
    taskId,
    actorName,
    teams,
    findTask,
    sendProjectNotifications,
    fetchBoards,
    broadcastRefresh,
}: DeleteTaskPayload) => {
    try {
        const task = findTask(taskId)
        await removeTaskAttachmentFiles(taskId)
        const { error } = await supabase
            .from("project_tasks")
            .delete()
            .eq("id", taskId)

        if (error) throw error

        if (task) {
            const sprintTeam = teams.find((team) =>
                team.sprints.some((sprint) => sprint.id === task.sprint_id)
            )
            if (sprintTeam) {
                const recipients = new Set<string>()
                recipients.add(sprintTeam.owner_id)
                sprintTeam.members.forEach((member) =>
                    recipients.add(member.user_id)
                )
                await sendProjectNotifications({
                    userIds: Array.from(recipients),
                    title: "Tâche supprimée",
                    message: `${
                        actorName ?? "Un responsable"
                    } a supprimé la tâche "${task.title}"`,
                    url: buildProjectPath({
                        projectId: sprintTeam.id,
                        sprintId: task.sprint_id,
                    }),
                })
            }
        }

        await fetchBoards()
        await broadcastRefresh()
        return { success: true }
    } catch (error: unknown) {
        console.error("deleteTask", error)
        if (isRlsViolation(error)) {
            toast.error(
                "Vous n'avez pas les droits pour supprimer cette tâche."
            )
        } else {
            toast.error("Impossible de supprimer la tâche")
        }
        return { success: false, error: getErrorMessage(error) }
    }
}
