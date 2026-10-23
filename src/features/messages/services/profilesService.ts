import { supabase } from "@/integrations/supabase/client"
import { uniqueChannelTopic } from "@/shared/services/realtimeService"
import type { CryptedUser } from "../hooks/useCryptedUsers"

export async function listProfilesExcept(
    currentUserId: string | null,
): Promise<CryptedUser[]> {
    const { data, error } = await supabase
        .from("profiles")
        .select(
            "user_id, full_name, email, avatar_url, status, service_id, services:services!profiles_service_id_fkey(nom)",
        )
        .order("full_name", { ascending: true })

    if (error) {
        console.error("Erreur chargement profiles:", error)
        return []
    }

    return (
        data as Array<CryptedUser & { services?: { nom?: string | null } | null }>
    )
        .filter((profile) => profile.user_id !== currentUserId)
        .map((profile) => ({
            ...profile,
            service_name: profile.services?.nom ?? "Aucun service",
        }))
}

export async function countUnreadByRecipient(
    recipientId: string,
): Promise<Record<string, number>> {
    const { data, error } = await supabase
        .from("cryptedmessage")
        .select("sender_id, read")
        .eq("recipient_id", recipientId)
        .eq("read", false)

    if (error) {
        console.error("Erreur chargement unread:", error)
        return {}
    }

    const counts: Record<string, number> = {}
    for (const row of data ?? []) {
        if (!row.sender_id) continue
        counts[row.sender_id] = (counts[row.sender_id] ?? 0) + 1
    }
    return counts
}

/**
 * Abonnement realtime aux changements de la table `profiles`.
 * Déplacé depuis hooks/useCryptedUsers.ts (déplacement mécanique, règle
 * no-restricted-imports). Retourne la fonction de désabonnement (removeChannel).
 */
export function subscribeToProfileChanges(onChange: () => void): () => void {
    const channel = supabase
        .channel(uniqueChannelTopic("cryptedmessage-users"))
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "profiles" },
            () => onChange()
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}

/**
 * Abonnement realtime aux messages adressés à un destinataire (compteur non-lus).
 * Retourne la fonction de désabonnement (removeChannel).
 */
export function subscribeToUnreadMessages(
    recipientId: string,
    onChange: () => void
): () => void {
    const channel = supabase
        .channel(uniqueChannelTopic(`cryptedmessage-unread-${recipientId}`))
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "cryptedmessage",
                filter: `recipient_id=eq.${recipientId}`,
            },
            () => onChange()
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
