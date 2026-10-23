import { supabase } from "@/integrations/supabase/client"
import type { activites, ActiviteInput } from "@/features/crm/types"

export async function fetchActivites(
    clientId?: string | null
): Promise<activites[]> {
    let query = supabase
        .from("Client_activite")
        .select("*, owner:profiles!owner(user_id, full_name)")

    if (clientId) {
        query = query.eq("client", clientId)
    }

    const { data, error } = await query
    if (error) throw error
    return data as activites[]
}

export async function touchClientTimestamp(clientId: string): Promise<void> {
    await supabase
        .from("client_crm")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", clientId)
        .then()
}

export async function createActivite(payload: activites): Promise<activites> {
    const { data, error } = await supabase
        .from("Client_activite")
        .insert([payload])
        .select()
        .single()
    if (error) throw error
    return data as activites
}

export async function updateActivite(
    id: string,
    fields: Pick<Partial<activites>, "date" | "title" | "content">
): Promise<void> {
    const { error } = await supabase
        .from("Client_activite")
        .update({
            date: fields.date,
            title: fields.title,
            content: fields.content,
        })
        .eq("id", id)
    if (error) throw error
}

export async function deleteActivite(id: string): Promise<void> {
    const { error } = await supabase
        .from("Client_activite")
        .delete()
        .eq("id", id)
    if (error) throw error
}

export type { activites, ActiviteInput }
