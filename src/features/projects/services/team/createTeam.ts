import type { CreateTeamPayload } from "@/features/projects/types"
import { supabase } from "@/integrations/supabase/client"
import { buildProjectPath } from "@/features/projects/routes/projectRoutes"
import { toast } from "sonner"

import { getErrorMessage, isRlsViolation } from "../errorUtils"

export const createTeam = async ({
    name,
    description,
    memberIds = [],
    actorName,
    sendProjectNotifications,
    fetchBoards,
    broadcastRefresh,
}: CreateTeamPayload) => {
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
        console.error(authError)
        toast.error("Session expirée")
        return { success: false, error: authError.message }
    }

    if (!user) {
        toast.error("Vous devez être connecté pour créer un projet")
        return { success: false, error: "not_authenticated" }
    }

    try {
        const { data: insertedTeam, error: insertError } = await supabase
            .from("project_teams")
            .insert({
                name,
                description: description || null,
                owner_id: user.id,
            })
            .select("id")
            .single()

        if (insertError || !insertedTeam) throw insertError

        const teamId = insertedTeam.id
        const uniqueMemberIds = Array.from(
            new Set((memberIds || []).filter((id) => id && id !== user.id))
        )

        const membersToInsert = uniqueMemberIds.map((memberId) => ({
            team_id: teamId,
            user_id: memberId,
            role: "member",
        }))

        membersToInsert.push({
            team_id: teamId,
            user_id: user.id,
            role: "owner",
        })

        const { error: memberInsertError } = await supabase
            .from("project_team_members")
            .insert(membersToInsert)

        if (memberInsertError) throw memberInsertError

        await sendProjectNotifications({
            userIds: uniqueMemberIds,
            title: "Nouveau projet",
            message: `${
                actorName ?? "Un responsable"
            } vous a ajouté au projet "${name}"`,
            url: buildProjectPath({ projectId: teamId }),
        })

        await sendProjectNotifications({
            userIds: [user.id],
            title: "Nouveau projet",
            message: `Vous avez créé le projet "${name}"`,
            url: buildProjectPath({ projectId: teamId }),
        })

        toast.success("Projet créé")
        await fetchBoards()
        await broadcastRefresh()
        return { success: true }
    } catch (error: unknown) {
        console.error("createTeam", error)
        if (isRlsViolation(error)) {
            toast.error("Vous n'avez pas l'autorisation de créer un projet.")
        } else {
            toast.error("Impossible de créer le projet")
        }
        return { success: false, error: getErrorMessage(error) }
    }
}
