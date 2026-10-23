import { useCallback, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import type { ProjectTaskAttachment } from "@/features/projects/types"
import * as attachmentService from "@/features/projects/services/task/taskAttachmentService"

/** `onChange` : appelé après un ajout ou une suppression réussis. */
export function useTaskAttachments(taskId: string, onChange?: () => void) {
    const queryClient = useQueryClient()
    const [uploading, setUploading] = useState(false)

    const {
        data: attachments = [],
        isLoading: loading,
        isError: loadError,
    } = useQuery({
        queryKey: ["project-task-attachments", taskId],
        queryFn: () => attachmentService.fetchTaskAttachments(taskId),
    })

    const setList = useCallback(
        (update: (prev: ProjectTaskAttachment[]) => ProjectTaskAttachment[]) =>
            queryClient.setQueryData<ProjectTaskAttachment[]>(
                ["project-task-attachments", taskId],
                (prev) => update(prev ?? [])
            ),
        [queryClient, taskId]
    )

    const upload = useCallback(
        async (files: FileList | File[]) => {
            setUploading(true)
            let added = 0
            try {
                for (const file of Array.from(files)) {
                    try {
                        const attachment = await attachmentService.uploadTaskAttachment(
                            taskId,
                            file
                        )
                        setList((prev) => [...prev, attachment])
                        added++
                    } catch (err) {
                        console.error("[useTaskAttachments] upload:", err)
                        toast.error(`Échec de l'envoi de « ${file.name} »`)
                    }
                }
            } finally {
                setUploading(false)
                if (added > 0) onChange?.()
            }
        },
        [taskId, setList, onChange]
    )

    const remove = useCallback(
        async (attachment: ProjectTaskAttachment) => {
            try {
                await attachmentService.deleteTaskAttachment(attachment)
                setList((prev) => prev.filter((a) => a.id !== attachment.id))
                onChange?.()
            } catch (err) {
                console.error("[useTaskAttachments] delete:", err)
                toast.error("Impossible de supprimer la pièce jointe")
            }
        },
        [setList, onChange]
    )

    const download = useCallback(async (attachment: ProjectTaskAttachment) => {
        try {
            const url = await attachmentService.getTaskAttachmentUrl(attachment)
            // Lien en Content-Disposition: attachment : télécharge sans quitter
            // la page. window.open après un await serait bloqué comme popup.
            window.location.assign(url)
        } catch (err) {
            console.error("[useTaskAttachments] download:", err)
            toast.error("Impossible d'ouvrir la pièce jointe")
        }
    }, [])

    return { attachments, loading, loadError, uploading, upload, remove, download }
}
