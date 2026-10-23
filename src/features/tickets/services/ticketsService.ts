import { supabase } from "@/integrations/supabase/client"
import type { Ticket } from "../components/types"

const TICKET_SELECT_QUERY = `
    *,
    profiles!created_by(*),
    assigned_profile:profiles!assigned_to(*)
`

export async function fetchSingleTicket(id: string): Promise<Ticket | null> {
    try {
        const { data, error } = await supabase
            .from("ticket_table")
            .select(TICKET_SELECT_QUERY)
            .eq("id", id)
            .single()

        if (error) throw error
        return data as Ticket
    } catch {
        return null
    }
}

export async function fetchTickets(): Promise<Ticket[]> {
    const { data, error } = await supabase
        .from("ticket_table")
        .select(TICKET_SELECT_QUERY)
        .order("created_at", { ascending: false })

    if (error) throw error
    return data as Ticket[]
}

export async function createTicket(
    ticket: Ticket,
    createdBy: string,
): Promise<Ticket> {
    const { data, error } = await supabase
        .from("ticket_table")
        .insert([
            {
                title: ticket.title,
                description: ticket.description,
                status: ticket.status || "ouvert",
                priority: ticket.priority || "moyenne",
                category: ticket.category || "bug",
                created_by: createdBy,
                from: ticket.from || "Nokk_project",
                type: ticket.type ?? null,
            },
        ])
        .select(TICKET_SELECT_QUERY)
        .single()

    if (error) throw error
    return data as Ticket
}

export async function updateTicket(ticket: Ticket): Promise<void> {
    if (!ticket.id) return
    const { error } = await supabase
        .from("ticket_table")
        .update({
            title: ticket.title,
            description: ticket.description,
            status: ticket.status,
            priority: ticket.priority,
            category: ticket.category,
            assigned_to: ticket.assigned_to,
            from: ticket.from,
            type: ticket.type ?? null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", ticket.id)

    if (error) throw error
}

export async function deleteTicket(ticketId: string): Promise<void> {
    const { error } = await supabase
        .from("ticket_table")
        .delete()
        .eq("id", ticketId)
    if (error) throw error
}
