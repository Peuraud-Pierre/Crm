import type { ModifyMemberPayload } from "@/features/projects/types"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

import { getErrorMessage, isRlsViolation } from "../errorUtils"

export const removeTeamMember = async ({
    teamId,
    userId,
    projectName,
    actorName,
    sendProjectNotifications,
    fetchBoards,
    broadcastRefresh,
}: ModifyMemberPayload) => {
    try {
        const { error } = await supabase
            .from("project_team_members")
            .delete()
            .eq("team_id", teamId)
            .eq("user_id", userId)

        if (error) throw error

        await sendProjectNotifications({
            userIds: [userId],
            title: "Projet",
            message: `${
                actorName ?? "Un responsable"
            } vous a retiré du projet "${projectName ?? "ce projet"}"`,
        })

        toast.success("Membre retiré")
        await fetchBoards()
        await broadcastRefresh()
        return { success: true }
    } catch (error: unknown) {
        console.error("removeTeamMember", error)
        if (isRlsViolation(error)) {
            toast.error(
                "Seul un chef de service ou un super admin peut retirer des collaborateurs de cette équipe."
            )
        } else {
            toast.error("Impossible de retirer ce membre")
        }
        return { success: false, error: getErrorMessage(error) }
    }
}
