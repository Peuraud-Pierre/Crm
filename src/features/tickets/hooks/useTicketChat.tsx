import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useCallback, useEffect, useState } from "react"
import type { TicketChat } from "../components/types"
import { toast } from "sonner"
import * as ticketChatService from "../services/ticketChatService"
import { subscribeToTable } from "../services/ticketRealtimeService"

export function useTicketChat() {
    const { user } = useAuth()
    const [chats, setChats] = useState<TicketChat[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const fetchSingleChat = useCallback(async (ticketId: string) => {
        setIsLoading(true)
        try {
            return await ticketChatService.fetchSingleChat(ticketId)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const createChat = useCallback(
        async (ticketId: string, ownerId: string, assignedId?: string) => {
            if (!user?.user_id) return null
            return ticketChatService.createChat(
                ticketId,
                ownerId,
                assignedId || user.user_id
            )
        },
        [user]
    )

    const updateChat = useCallback(
        async (chatId: string, closedAt: string | null) => {
            try {
                await ticketChatService.updateChat(chatId, closedAt)
            } catch {
                toast.error("Erreur update chat")
            }
        },
        []
    )

    // REALTIME
    useEffect(() => {
        if (!user?.user_id) return

        const unsubscribe = subscribeToTable<TicketChat>(
            `ticket_chat_realtime_${user.user_id}`,
            "ticket_chat_table",
            undefined,
            async ({ eventType, newRow, oldRow }) => {
                if (eventType === "DELETE") {
                    setChats((prev) =>
                        prev.filter((c) => c.id !== oldRow.id)
                    )
                } else if (newRow && "ticket_id" in newRow) {
                    const freshChat = await fetchSingleChat(
                        newRow.ticket_id as string
                    )
                    if (freshChat) {
                        setChats((prev) => {
                            const exists = prev.some(
                                (c) => c.id === freshChat.id
                            )
                            if (eventType === "INSERT")
                                return exists ? prev : [freshChat, ...prev]
                            return prev.map((c) =>
                                c.id === freshChat.id ? freshChat : c
                            )
                        })
                    }
                }
            }
        )

        return unsubscribe
    }, [user?.user_id, fetchSingleChat])

    return { chats, isLoading, fetchSingleChat, createChat, updateChat }
}
