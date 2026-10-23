import type { ModifyMemberPayload } from "@/features/projects/types"
import { supabase } from "@/integrations/supabase/client"
import { buildProjectPath } from "@/features/projects/routes/projectRoutes"
import { toast } from "sonner"

import { getErrorMessage, isErrorWithCode, isRlsViolation } from "../errorUtils"

interface AddMemberArgs extends ModifyMemberPayload {
    fetchBoards: () => Promise<void>
    broadcastRefresh: () => Promise<void>
    sendProjectNotifications: (args: {
        userIds: string[]
        title: string
        message: string
        url?: string
    }) => Promise<void>
}

export async function addTeamMember({
    teamId,
    userId,
    projectName,
    actorName,

    fetchBoards,
    broadcastRefresh,
    sendProjectNotifications,
}: AddMemberArgs) {
    try {
        const { error } = await supabase.from("project_team_members").insert({
            team_id: teamId,
            user_id: userId,
        })

        if (error) {
            if (isErrorWithCode(error) && error.code === "23505") {
                toast.error("Ce membre appartient déjà à l'équipe")
            } else if (isRlsViolation(error)) {
                toast.error(
                    "Seul un chef de service ou un super admin peut ajouter des collaborateurs à l'équipe."
                )
            } else {
                toast.error("Impossible d'ajouter ce membre")
            }

            return { success: false, error: getErrorMessage(error) }
        }

        await sendProjectNotifications({
            userIds: [userId],
            title: "Projet",
            message: `${
                actorName ?? "Un responsable"
            } vous a ajouté au projet "${projectName ?? "ce projet"}"`,
            url: buildProjectPath({ projectId: teamId }),
        })

        toast.success("Membre ajouté")

        await fetchBoards()
        await broadcastRefresh()

        return { success: true }
    } catch (error: unknown) {
        console.error("addTeamMember", error)

        if (isRlsViolation(error)) {
            toast.error(
                "Seul un chef de service ou un super admin peut gérer les membres de cette équipe."
            )
        } else {
            toast.error("Impossible d'ajouter ce membre")
        }

        return { success: false, error: getErrorMessage(error) }
    }
}
