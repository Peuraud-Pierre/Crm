import { supabase } from "@/integrations/supabase/client"

export type TypingPayload = {
    user_id: string
    is_typing: boolean
}

export type TypingSubscription = {
    sendTyping: (userId: string, isTyping: boolean) => void
    unsubscribe: () => void
}

/**
 * Channel realtime broadcast "typing" d'une conversation. Déplacé depuis
 * hooks/useTypingIndicator.ts (déplacement mécanique) — seule la couche
 * service est autorisée à importer le client Supabase (règle ESLint
 * no-restricted-imports).
 */
export function subscribeToTyping(
    chatId: string,
    onTyping: (payload: TypingPayload) => void
): TypingSubscription {
    // Canal `broadcast` : le nom est le point de rendez-vous entre les deux
    // interlocuteurs. Ne pas le passer par `uniqueChannelTopic` — chacun se
    // retrouverait seul dans son canal et l'indicateur de frappe ne
    // traverserait plus (voir shared/services/realtimeService.ts).
    const channel = supabase.channel(`typing:${chatId}`)

    channel
        .on("broadcast", { event: "typing" }, ({ payload }) => {
            onTyping(payload as TypingPayload)
        })
        .subscribe()

    return {
        sendTyping: (userId, isTyping) => {
            void channel.send({
                type: "broadcast",
                event: "typing",
                payload: { user_id: userId, is_typing: isTyping },
            })
        },
        unsubscribe: () => {
            supabase.removeChannel(channel)
        },
    }
}
