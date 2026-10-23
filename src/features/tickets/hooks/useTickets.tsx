import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { toast } from "sonner"
import type { Ticket } from "../components/types"
import * as ticketsService from "../services/ticketsService"
import { subscribeToTable } from "../services/ticketRealtimeService"

export function useTickets() {
    const { user } = useAuth()
    const [tickets, setTickets] = useState<Ticket[]>([])

    const fetchSingleTicket = useCallback(ticketsService.fetchSingleTicket, [])

    const fetchTickets = useCallback(async () => {
        try {
            const data = await ticketsService.fetchTickets()
            setTickets(data)
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erreur inconnue")
        }
    }, [])

    const createTicket = useCallback(async (ticket: Ticket) => {
        if (!user?.user_id) return null
        return ticketsService.createTicket(ticket, user.user_id)
    }, [user])

    const updateTicket = useCallback(ticketsService.updateTicket, [])

    const deleteTicket = useCallback(ticketsService.deleteTicket, [])

    useEffect(() => {
        if (!user?.user_id) return
        fetchTickets()

        const unsubscribe = subscribeToTable<Ticket>(
            `tickets_realtime_${user.user_id}`,
            "ticket_table",
            undefined,
            async ({ eventType, newRow, oldRow }) => {
                if (eventType === "DELETE") {
                    setTickets((prev) => prev.filter((t) => t.id !== oldRow.id))
                } else if (newRow.id) {
                    const freshTicket = await fetchSingleTicket(newRow.id)
                    if (freshTicket) {
                        setTickets((prev) => {
                            if (eventType === "INSERT") {
                                if (prev.some((t) => t.id === freshTicket.id)) return prev
                                return [freshTicket, ...prev]
                            }
                            return prev.map((t) => t.id === freshTicket.id ? freshTicket : t)
                        })
                    }
                }
            }
        )

        return unsubscribe
    }, [user?.user_id, fetchTickets, fetchSingleTicket])

    return { tickets, fetchTickets, fetchSingleTicket, createTicket, updateTicket, deleteTicket }
}