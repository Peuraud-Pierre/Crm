import type { DeleteSprintPayload } from "@/features/projects/types"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

import { getErrorMessage, isRlsViolation } from "../errorUtils"

export const deleteSprint = async ({
    sprintId,
    memberIds = [],
    sprintName,
    actorName,
    sendProjectNotifications,
    fetchBoards,
    broadcastRefresh,
}: DeleteSprintPayload) => {
    try {
        const recipients = Array.from(
            new Set((memberIds || []).filter(Boolean))
        )
        if (recipients.length > 0) {
            await sendProjectNotifications({
                userIds: recipients,
                title: "Sprint supprimé",
                message: `${
                    actorName ?? "Un responsable"
                } a supprimé le sprint "${sprintName ?? "ce sprint"}"`,
            })
        }

        const { error } = await supabase
            .from("project_sprints")
            .delete()
            .eq("id", sprintId)

        if (error) throw error
        toast.success("Sprint supprimé")
        await fetchBoards()
        await broadcastRefresh()
        return { success: true }
    } catch (error: unknown) {
        console.error("deleteSprint", error)
        if (isRlsViolation(error)) {
            toast.error("Vous n'avez pas les droits pour supprimer ce sprint.")
        } else {
            toast.error("Impossible de supprimer le sprint")
        }
        return { success: false, error: getErrorMessage(error) }
    }
}
