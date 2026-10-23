import { supabase } from "@/integrations/supabase/client"
import type { Database } from "@/integrations/supabase/types"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

export type ContentGenerationRow =
    Database["public"]["Tables"]["content_generation"]["Row"]

/**
 * Couche service du domaine content_generation.
 * Seul point d'accès autorisé au client Supabase pour la feature content
 * (les hooks/composants ne doivent pas importer
 * @/integrations/supabase/client).
 * Modèle : src/features/tickets/services/ticketRealtimeService.ts
 */

/**
 * Jeton d'accès de la session courante (pour les appels aux webhooks n8n
 * et le fetch des médias protégés). L'accès à supabase.auth reste confiné
 * à la couche service.
 */
export async function getAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
}

/**
 * Liste des générations de contenu (jointure profils incluse),
 * triées de la plus récente à la plus ancienne.
 * Passer `userId` pour filtrer sur un utilisateur (vue non-admin).
 */
export async function fetchContentGenerations(userId?: string) {
    let query = supabase
        .from("content_generation")
        .select(
            `
                *,
                profiles:profiles!content_generation_user_id_fkey (
                    full_name,
                    email,
                    avatar_url
                )
            `
        )
        .order("created_at", { ascending: false })

    if (userId) {
        query = query.eq("user_id", userId)
    }

    return await query
}

/**
 * Récupère une analyse photo par son identifiant.
 */
export async function fetchAnalyzeById(analyzeId: string) {
    return await supabase
        .from("analyze_content_generation")
        .select("*")
        .eq("id", analyzeId)
        .single()
}

/**
 * Abonnement Realtime aux UPDATE de content_generation pour un utilisateur.
 * `onChange` reçoit la ligne mise à jour ; `onSubscribed` est appelé quand
 * le channel est effectivement connecté. Retourne la fonction de
 * désabonnement.
 */
export function subscribeToGenerationUpdates(
    channelName: string,
    userId: string,
    onChange: (row: ContentGenerationRow) => void,
    onSubscribed?: () => void
): () => void {
    const channel = supabase
        .channel(channelName)
        .on<ContentGenerationRow>(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "content_generation",
                filter: `user_id=eq.${userId}`,
            },
            (payload) => {
                onChange(payload.new)
            }
        )
        .subscribe((status) => {
            if (status === "SUBSCRIBED") {
                onSubscribed?.()
            }
        })

    return () => {
        channel.unsubscribe()
    }
}

/**
 * Abonnement Realtime à tous les événements (INSERT/UPDATE/DELETE) de
 * content_generation, sans filtre. Le payload brut typé est transmis au
 * handler (le filtrage par utilisateur reste côté appelant).
 * Retourne la fonction de désabonnement.
 */
export function subscribeToContentGenerationChanges(
    channelName: string,
    handler: (
        payload: RealtimePostgresChangesPayload<ContentGenerationRow>
    ) => void
): () => void {
    const channel = supabase
        .channel(channelName)
        .on<ContentGenerationRow>(
            "postgres_changes",
            { event: "*", schema: "public", table: "content_generation" },
            handler
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}

/**
 * Attend l'arrivée d'une nouvelle vidéo terminée (INSERT ou UPDATE avec
 * status "done" et video_url renseignée) pour un utilisateur donné.
 * Retourne le channel Supabase (à désabonner par l'appelant).
 */
export function waitForNewVideo(
    user_id: string,
    onReady: (row: ContentGenerationRow) => void
) {
    const handleRow = (row: ContentGenerationRow) => {
        if (row.status === "done" && row.video_url) {
            onReady(row)
        }
    }

    const channel = supabase
        .channel("content_generation_updates")
        .on<ContentGenerationRow>(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "content_generation",
                filter: `user_id=eq.${user_id}`,
            },
            (payload) => handleRow(payload.new)
        )
        .on<ContentGenerationRow>(
            "postgres_changes",
            {
                event: "UPDATE",
                schema: "public",
                table: "content_generation",
                filter: `user_id=eq.${user_id}`,
            },
            (payload) => handleRow(payload.new)
        )
        .subscribe()

    return channel
}
