import type { DeleteTeamPayload } from "@/features/projects/types"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

import { getErrorMessage, isRlsViolation } from "../errorUtils"

export const deleteTeam = async ({
    teamId,
    memberIds = [],
    projectName,
    actorName,
    sendProjectNotifications,
    fetchBoards,
    broadcastRefresh,
}: DeleteTeamPayload) => {
    try {
        const recipients = Array.from(
            new Set((memberIds || []).filter(Boolean))
        )
        if (recipients.length > 0) {
            await sendProjectNotifications({
                userIds: recipients,
                title: "Projet supprimé",
                message: `${
                    actorName ?? "Un responsable"
                } a supprimé le projet "${projectName ?? "ce projet"}"`,
            })
        }

        const { error } = await supabase
            .from("project_teams")
            .delete()
            .eq("id", teamId)

        if (error) throw error
        toast.success("Projet supprimé")
        await fetchBoards()
        await broadcastRefresh()
        return { success: true }
    } catch (error: unknown) {
        console.error("deleteTeam", error)
        if (isRlsViolation(error)) {
            toast.error("Vous n'avez pas les droits pour supprimer ce projet.")
        } else {
            toast.error("Impossible de supprimer le projet")
        }
        return { success: false, error: getErrorMessage(error) }
    }
}
