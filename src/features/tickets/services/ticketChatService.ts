import { supabase } from "@/integrations/supabase/client"
import type { TicketChat } from "../components/types"

// On définit la query ici pour corriger l'erreur "Type instantiation is excessively deep"
const CHAT_SELECT_QUERY = `
    *,
    owner_profile:profiles!owner_user(*),
    assigned_profile:profiles!assigned_user(*)
`

export async function fetchSingleChat(
    ticketId: string,
): Promise<TicketChat | null> {
    try {
        const { data, error } = await supabase
            .from("ticket_chat_table")
            .select(CHAT_SELECT_QUERY)
            .eq("ticket_id", ticketId)
            .maybeSingle()

        if (error) throw error
        return data as unknown as TicketChat // Double cast pour bypass l'erreur TS
    } catch (err) {
        console.error("Error fetching ticket chat:", err)
        return null
    }
}

export async function createChat(
    ticketId: string,
    ownerId: string,
    assignedId: string,
): Promise<TicketChat | null> {
    try {
        // 1. D'abord, on vérifie si un chat existe déjà pour éviter le conflit UNIQUE
        const { data: existingChat } = await supabase
            .from("ticket_chat_table")
            .select(CHAT_SELECT_QUERY)
            .eq("ticket_id", ticketId)
            .maybeSingle()

        if (existingChat) {
            return existingChat as unknown as TicketChat
        }

        // 2. Si rien n'existe, on procède à l'insertion
        const { data, error } = await supabase
            .from("ticket_chat_table")
            .insert([
                {
                    ticket_id: ticketId,
                    owner_user: ownerId,
                    assigned_user: assignedId,
                },
            ])
            .select(CHAT_SELECT_QUERY)
            .single()

        if (error) {
            // Sécurité si deux personnes cliquent en même temps
            if (error.code === "23505") {
                const { data: retryData } = await supabase
                    .from("ticket_chat_table")
                    .select(CHAT_SELECT_QUERY)
                    .eq("ticket_id", ticketId)
                    .single()
                return retryData as unknown as TicketChat
            }
            throw error
        }

        return data as unknown as TicketChat
    } catch (err) {
        console.error(
            "Erreur createChat:",
            err instanceof Error ? err.message : err,
        )
        return null
    }
}

export async function updateChat(
    chatId: string,
    closedAt: string | null,
): Promise<void> {
    const { error } = await supabase
        .from("ticket_chat_table")
        .update({ closed_at: closedAt })
        .eq("id", chatId)

    if (error) throw error
}
