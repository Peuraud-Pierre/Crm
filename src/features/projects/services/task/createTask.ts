import type { CreateTaskPayload } from "@/features/projects/types"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

import { getErrorMessage, isRlsViolation } from "../errorUtils"
import { DEFAULT_PRIORITY } from "../constants"
import { uploadTaskAttachment } from "./taskAttachmentService"

export const createTask = async ({
    sprintId,
    title,
    description,
    assigneeId,
    status,
    dueDate,
    priority,
    files = [],
    fetchBoards,
    broadcastRefresh,
    getNextPosition,
}: CreateTaskPayload) => {
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

    const nextPosition = getNextPosition(sprintId, status || "todo")

    try {
        const { data, error } = await supabase.from("project_tasks").insert({
            sprint_id: sprintId,
            title,
            description: description || null,
            assignee_id: assigneeId || null,
            status: status || "todo",
            due_date: dueDate || null,
            position: nextPosition,
            priority: priority || DEFAULT_PRIORITY,
            last_moved_by: user.id,
            last_moved_at: new Date().toISOString(),
            created_by: user.id,
        })
            .select("id")
            .single()

        if (error) throw error

        // La tâche est créée : un fichier refusé ne doit pas l'annuler.
        for (const file of files) {
            try {
                await uploadTaskAttachment(data.id, file)
            } catch (uploadError) {
                console.error("createTask attachment", uploadError)
                toast.error(`Échec de l'envoi de « ${file.name} »`)
            }
        }

        await fetchBoards()
        await broadcastRefresh()
        return { success: true, taskId: data.id }
    } catch (error: unknown) {
        console.error("createTask", error)
        if (isRlsViolation(error)) {
            toast.error(
                "Vous n'avez pas les droits pour créer une tâche dans ce sprint."
            )
        } else {
            toast.error("Impossible de créer la tâche")
        }
        return { success: false, error: getErrorMessage(error) }
    }
}
