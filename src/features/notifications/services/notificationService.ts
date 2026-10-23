import { supabase } from "@/integrations/supabase/client"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import type { Database } from "@/integrations/supabase/types"

/**
 * Couche service pour la table `notification` (docs/Architecture_Feature.pdf §5).
 * Déplacé depuis hooks/Notification_hook/useNotifications.tsx (déplacement
 * mécanique) — seule la couche service est autorisée à importer le client
 * Supabase (règle ESLint no-restricted-imports).
 */

export type NotificationRow =
    Database["public"]["Tables"]["notification"]["Row"]

export async function fetchNotificationsForUser(userId: string) {
    return supabase.from("notification").select("*").or(`user_id.eq.${userId}`)
}

/**
 * Les `limit` notifications les plus récentes — widget de dashboard.
 *
 * Distincte de `fetchNotificationsForUser`, qui rapatrie tout pour le
 * panneau de l'en-tête : un module de trois lignes n'a pas besoin de
 * l'historique complet.
 */
export async function fetchRecentNotifications(
    userId: string,
    limit: number
): Promise<NotificationRow[]> {
    const { data, error } = await supabase
        .from("notification")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit)

    if (error) throw error
    return data ?? []
}

export async function deleteNotificationById(id: string) {
    return supabase.from("notification").delete().eq("id", id)
}

/**
 * Taille de lot de `deleteNotificationsByIds`. PostgREST place le filtre `in.()`
 * dans l'URL : au-delà de ~200 UUID la requête dépasse la limite de longueur du
 * reverse-proxy, qui répond 414 SANS en-tête CORS — le navigateur signale alors
 * une « CORS Missing Allow Origin » trompeuse au lieu de l'erreur réelle.
 */
const DELETE_BATCH_SIZE = 100

/** Supprime par lots ; retourne la première erreur rencontrée, le cas échéant. */
export async function deleteNotificationsByIds(ids: string[]) {
    for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
        const { error } = await supabase
            .from("notification")
            .delete()
            .in("id", ids.slice(i, i + DELETE_BATCH_SIZE))
        if (error) return { error }
    }
    return { error: null }
}

/**
 * Abonnement realtime aux notifications d'un destinataire (INSERT/UPDATE/DELETE
 * filtrés sur user_id). `targetId` est l'user_id ou le service_id visé,
 * `channelKey` distingue les deux canaux. Retourne la fonction de
 * désabonnement (removeChannel).
 */
export function subscribeToNotifications(
    channelKey: string,
    targetId: string,
    onPayload: (
        payload: RealtimePostgresChangesPayload<NotificationRow>
    ) => void
): () => void {
    const filter = `user_id=eq.${targetId}`
    const channel = supabase
        .channel(channelKey)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "notification",
                filter,
            },
            onPayload
        )
        .on(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "notification",
                filter,
            },
            onPayload
        )
        .on(
            "postgres_changes",
            {
                event: "DELETE",
                schema: "public",
                table: "notification",
                filter,
            },
            onPayload
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
