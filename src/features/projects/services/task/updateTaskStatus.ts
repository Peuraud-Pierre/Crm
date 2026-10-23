import type { UpdateTaskStatusPayload } from "@/features/projects/types"
import type { Database } from "@/integrations/supabase/types"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

import { getErrorMessage, isRlsViolation } from "../errorUtils"

export const updateTaskStatus = async ({
    taskId,
    status,
    findTask,
    fetchBoards,
    getNextPosition,
    broadcastRefresh,
}: UpdateTaskStatusPayload) => {
    const task = findTask(taskId)
    if (!task) {
        toast.error("Tâche introuvable")
        return { success: false, error: "not_found" }
    }

    const nextPosition = getNextPosition(task.sprint_id, status)

    try {
        const {
            data: { user },
        } = await supabase.auth.getUser()
        const moverId = user?.id ?? null
        const { error } = await supabase
            .from("project_tasks")
            .update({
                status,
                position: nextPosition,
                last_moved_by: moverId,
                last_moved_at: new Date().toISOString(),
            } satisfies Database["public"]["Tables"]["project_tasks"]["Update"])
            .eq("id", taskId)

        if (error) throw error
        await fetchBoards()
        await broadcastRefresh()
        return { success: true }
    } catch (error: unknown) {
        console.error("updateTaskStatus", error)
        if (isRlsViolation(error)) {
            toast.error("Vous n'avez pas les droits pour modifier cette tâche.")
        } else {
            toast.error("Impossible de mettre à jour la tâche")
        }
        return { success: false, error: getErrorMessage(error) }
    }
}
