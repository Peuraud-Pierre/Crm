import { supabase } from "@/integrations/supabase/client"

// Forme normalisée d'un changement Realtime : le payload Supabase expose
// `new`/`old` comme objets partiels selon l'eventType (DELETE n'a que `old`,
// INSERT n'a que `new`) — on uniformise en Partial<Row> pour les hooks.
export type RealtimeChange<Row> = {
    eventType: "INSERT" | "UPDATE" | "DELETE"
    newRow: Partial<Row>
    oldRow: Partial<Row>
}

/**
 * Abonnement Realtime générique à une table du schéma public.
 * Seul point d'accès autorisé au client Supabase pour les subscriptions CRM
 * (les hooks ne doivent pas importer @/integrations/supabase/client).
 * Retourne la fonction de désabonnement.
 */
export function subscribeToTable<Row>(
    channelName: string,
    table: string,
    filter: string | undefined,
    handler: (change: RealtimeChange<Row>) => void
): () => void {
    const channel = supabase
        .channel(channelName)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table,
                ...(filter ? { filter } : {}),
            },
            (payload) => {
                handler({
                    eventType: payload.eventType,
                    // Cast : le payload Realtime n'est pas typé par table côté
                    // supabase-js ; les lignes proviennent bien de `table`.
                    newRow: (payload.new ?? {}) as Partial<Row>,
                    oldRow: (payload.old ?? {}) as Partial<Row>,
                })
            }
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
