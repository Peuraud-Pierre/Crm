import type { MoveTaskToSprintPayload } from "@/features/projects/types"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

import { getErrorMessage, isRlsViolation } from "../errorUtils"

export const moveTaskToSprint = async ({
    taskId,
    targetSprintId,
    fetchBoards,
    broadcastRefresh,
    findTask,
    getNextPosition,
}: MoveTaskToSprintPayload) => {
    try {
        const task = findTask(taskId)
        if (!task) throw new Error("Tâche introuvable")

        const {
            data: { user },
        } = await supabase.auth.getUser()

        const { error } = await supabase
            .from("project_tasks")
            .update({
                sprint_id: targetSprintId,
                position: getNextPosition(targetSprintId, task.status),
                last_moved_by: user?.id ?? null,
                last_moved_at: new Date().toISOString(),
            })
            .eq("id", taskId)

        if (error) throw error

        await fetchBoards()
        await broadcastRefresh()
        toast.success("Tâche déplacée vers le sprint")
        return { success: true }
    } catch (error: unknown) {
        console.error("moveTaskToSprint", error)
        if (isRlsViolation(error)) {
            toast.error(
                "Vous n'avez pas les droits pour déplacer cette tâche."
            )
        } else {
            toast.error("Impossible de déplacer la tâche")
        }
        return { success: false, error: getErrorMessage(error) }
    }
}
