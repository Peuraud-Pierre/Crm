import type { UpdateTaskPayload } from "@/features/projects/types"
import type { Database } from "@/integrations/supabase/types"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

import { getErrorMessage, isRlsViolation } from "../errorUtils"

export const updateTask = async ({
    taskId,
    updates,
    fetchBoards,
    broadcastRefresh,
    findTask,
    getNextPosition,
}: UpdateTaskPayload) => {
    try {
        const payload: Database["public"]["Tables"]["project_tasks"]["Update"] =
            {}
        if (typeof updates.title === "string") payload.title = updates.title
        if (updates.description !== undefined)
            payload.description = updates.description
        if (updates.assignee_id !== undefined)
            payload.assignee_id = updates.assignee_id
        if (updates.due_date !== undefined) payload.due_date = updates.due_date
        if (updates.priority) payload.priority = updates.priority

        let requiresMoverTracking = false

        if (updates.status) {
            payload.status = updates.status
            const task = findTask(taskId)
            if (task) {
                payload.position = getNextPosition(
                    task.sprint_id,
                    updates.status
                )
            }
            requiresMoverTracking = true
        }

        if (Object.keys(payload).length === 0) return { success: true }

        if (requiresMoverTracking) {
            const {
                data: { user },
            } = await supabase.auth.getUser()
            payload.last_moved_by = user?.id ?? null
            payload.last_moved_at = new Date().toISOString()
        }

        const { error } = await supabase
            .from("project_tasks")
            .update(payload)
            .eq("id", taskId)

        if (error) throw error
        await fetchBoards()
        await broadcastRefresh()
        return { success: true }
    } catch (error: unknown) {
        console.error("updateTask", error)
        if (isRlsViolation(error)) {
            toast.error("Vous n'avez pas les droits pour modifier cette tâche.")
        } else {
            toast.error("Impossible de mettre à jour la tâche")
        }
        return { success: false, error: getErrorMessage(error) }
    }
}
