import { supabase } from "@/integrations/supabase/client"
import { uniqueChannelTopic } from "@/shared/services/realtimeService"

const MAX_ROWS = 400

/**
 * Récence des conversations 1-à-1 d'un utilisateur : `Record<partnerUserId, lastMessageISO>`.
 * Voir src/features/messages/hooks/useRecentConversations.ts pour le contexte d'usage
 * (aucune agrégation côté serveur, déduction du dernier message par partenaire côté client).
 */
export async function listRecentConversations(
    currentUserId: string,
): Promise<Record<string, string>> {
    const { data, error } = await supabase
        .from("cryptedmessage")
        .select("sender_id, recipient_id, created_at")
        .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
        .not("recipient_id", "is", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(MAX_ROWS)

    if (error) {
        console.error("Erreur chargement conversations récentes:", error)
        return {}
    }

    const next: Record<string, string> = {}
    for (const row of data ?? []) {
        const partner =
            row.sender_id === currentUserId ? row.recipient_id : row.sender_id
        if (!partner || next[partner]) continue
        next[partner] = row.created_at
    }
    return next
}

/**
 * Abonnement realtime aux messages envoyés OU reçus par l'utilisateur courant.
 * Les filtres Postgres ne supportent pas le OR, on écoute donc séparément les
 * messages reçus et envoyés ; tout event déclenche `onEvent`.
 * Déplacé depuis hooks/useRecentConversations.ts (déplacement mécanique, règle
 * no-restricted-imports). Retourne la fonction de désabonnement (removeChannel).
 */
export function subscribeToConversationEvents(
    currentUserId: string,
    onEvent: () => void
): () => void {
    const channel = supabase
        .channel(uniqueChannelTopic(`cryptedmessage-recent-${currentUserId}`))
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "cryptedmessage",
                filter: `recipient_id=eq.${currentUserId}`,
            },
            onEvent
        )
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "cryptedmessage",
                filter: `sender_id=eq.${currentUserId}`,
            },
            onEvent
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
