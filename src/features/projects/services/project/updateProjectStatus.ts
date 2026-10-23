import type { UpdateProjectStatusPayload } from "@/features/projects/types"
import { supabase } from "@/integrations/supabase/client"
import { buildProjectPath } from "@/features/projects/routes/projectRoutes"
import { toast } from "sonner"

import { getErrorMessage, isRlsViolation } from "../errorUtils"

export const updateProjectStatus = async ({
    teamId,
    status,
    memberIds = [],
    projectName,
    actorName,
    actorIsGlobalAdmin = false,
    sendProjectNotifications,
    fetchBoards,
    broadcastRefresh,
}: UpdateProjectStatusPayload) => {
    try {
        const { data, error } = await supabase
            .from("project_teams")
            .update({ status })
            .eq("id", teamId)
            .select("id")
            .maybeSingle()

        if (error) throw error

        let updated = Boolean(data?.id)

        if (!updated && actorIsGlobalAdmin) {
            const { error: adminError } = await supabase.rpc(
                "update_project_status_as_admin",
                {
                    p_team_id: teamId,
                    p_status: status,
                }
            )

            if (adminError) throw adminError
            updated = true
        }

        if (!updated) {
            const unauthorized = Object.assign(
                new Error("Vous n'avez pas les droits pour modifier ce projet."),
                { code: "42501" }
            )
            throw unauthorized
        }

        const message =
            status === "archived"
                ? `${actorName ?? "Un responsable"} a terminé le projet "${
                      projectName ?? "ce projet"
                  }"`
                : `${actorName ?? "Un responsable"} a réactivé le projet "${
                      projectName ?? "ce projet"
                  }"`

        const recipients = Array.from(
            new Set((memberIds || []).filter(Boolean))
        )
        if (recipients.length > 0) {
            await sendProjectNotifications({
                userIds: recipients,
                title:
                    status === "archived"
                        ? "Projet terminé"
                        : "Projet réactivé",
                message,
                url: buildProjectPath({ projectId: teamId }),
            })
        }

        toast.success(
            status === "archived" ? "Projet archivé" : "Projet réactivé"
        )
        await fetchBoards()
        await broadcastRefresh()
        return { success: true }
    } catch (error: unknown) {
        console.error("updateProjectStatus", error)
        if (isRlsViolation(error)) {
            toast.error("Vous n'avez pas les droits pour modifier ce projet")
        } else {
            toast.error("Impossible de mettre à jour le projet")
        }
        return { success: false, error: getErrorMessage(error) }
    }
}
