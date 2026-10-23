// Pièces jointes des tâches : bucket privé + table project_task_attachments
// (cf. supabase/migrations/20260929100000_project_task_attachments.sql).
//
// Le premier segment du chemin est l'id de la tâche : c'est ce que testent
// les policies du bucket. Ne pas changer ce format sans elles.

import type { ProjectTaskAttachment } from "@/features/projects/types"
import { supabase } from "@/integrations/supabase/client"

const BUCKET = "project-task-attachments"
/** Durée de validité d'un lien de téléchargement, en secondes. */
const SIGNED_URL_TTL = 60

export async function fetchTaskAttachments(
    taskId: string
): Promise<ProjectTaskAttachment[]> {
    const { data, error } = await supabase
        .from("project_task_attachments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true })
    if (error) throw error
    return data ?? []
}

export async function uploadTaskAttachment(
    taskId: string,
    file: File
): Promise<ProjectTaskAttachment> {
    // Le nom d'origine est gardé en base ; la clé Storage n'accepte pas
    // tous les caractères (accents, espaces…).
    const safeName = file.name.replace(/[^\w.-]+/g, "_")
    const path = `${taskId}/${crypto.randomUUID()}-${safeName}`

    const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || undefined })
    if (uploadError) throw uploadError

    const { data, error } = await supabase
        .from("project_task_attachments")
        .insert({
            task_id: taskId,
            storage_path: path,
            file_name: file.name,
            mime_type: file.type || null,
            size_bytes: file.size,
        })
        .select()
        .single()

    if (error) {
        // Sans ligne, le fichier ne serait plus ni visible ni supprimable.
        await supabase.storage.from(BUCKET).remove([path])
        throw error
    }
    return data
}

/**
 * Fichier d'abord, ligne ensuite : dans l'ordre inverse, une interruption
 * laisserait un fichier que plus rien ne référence.
 */
export async function deleteTaskAttachment(
    attachment: Pick<ProjectTaskAttachment, "id" | "storage_path">
): Promise<void> {
    const { error: storageError } = await supabase.storage
        .from(BUCKET)
        .remove([attachment.storage_path])
    if (storageError) throw storageError

    const { error } = await supabase
        .from("project_task_attachments")
        .delete()
        .eq("id", attachment.id)
    if (error) throw error
}

/**
 * Fichiers d'une tâche sur le point d'être supprimée. À appeler AVANT la
 * suppression : la cascade SQL emporte les lignes, et les policies du bucket
 * exigent que la tâche existe encore.
 */
export async function removeTaskAttachmentFiles(taskId: string): Promise<void> {
    const attachments = await fetchTaskAttachments(taskId)
    if (attachments.length === 0) return
    const { error } = await supabase.storage
        .from(BUCKET)
        .remove(attachments.map((a) => a.storage_path))
    if (error) throw error
}

/** Lien signé court, qui force le téléchargement sous le nom d'origine. */
export async function getTaskAttachmentUrl(
    attachment: Pick<ProjectTaskAttachment, "storage_path" | "file_name">
): Promise<string> {
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(attachment.storage_path, SIGNED_URL_TTL, {
            download: attachment.file_name,
        })
    if (error) throw error
    return data.signedUrl
}
