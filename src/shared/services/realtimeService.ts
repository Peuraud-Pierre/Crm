import { supabase } from "@/integrations/supabase/client"

/**
 * Abonnement Realtime générique à une table du schéma `public`.
 *
 * Pourquoi ici et pas dans une feature : deux copies quasi identiques de
 * cet abonnement existaient déjà (`features/crm/services/realtimeService.ts`
 * et `features/tickets/services/ticketRealtimeService.ts`) ; la feature
 * `maintenance` en aurait fait une troisième. La règle de promotion du
 * design system (§4) demande une réutilisation *prouvée* dans au moins
 * deux features — c'est le cas.
 *
 * Les deux copies existantes ne sont volontairement PAS migrées dans le
 * même geste : elles sont en production et leur reprise mérite son propre
 * lot. Elles restent la référence de comportement (signature identique).
 *
 * Rappel d'architecture : la couche service est le seul endroit autorisé à
 * importer le client Supabase (`Architecture_Feature.pdf` §5). Les hooks
 * passent par cette fonction.
 */


/**
 * Rend un nom de canal unique pour cet onglet.
 *
 * `supabase.channel(topic)` ne crée PAS un canal par appel : s'il en existe
 * déjà un portant ce nom, il le renvoie tel quel (`RealtimeClient.channel`).
 * Deux abonnements homonymes se partagent donc une seule instance, et le
 * second `.on("postgres_changes", …)` arrive après le `.subscribe()` du
 * premier — d'où « cannot add postgres_changes callbacks after subscribe() ».
 * Pire, le `removeChannel` de l'un coupe l'abonnement de l'autre, sans erreur.
 *
 * Le piège s'est déjà déclenché en production sur les membres de groupe de la
 * messagerie. Suffixer systématiquement supprime la classe entière plutôt que
 * l'occurrence : chaque appelant obtient son propre canal, et le nom de base
 * reste lisible dans les outils de débogage.
 *
 * Effet de bord bénéfique : en StrictMode, le double montage des effets
 * n'entrelace plus deux abonnements sur la même instance.
 *
 * ⚠️ RÉSERVÉ AUX ABONNEMENTS `postgres_changes`, où le nom de canal n'est
 * qu'une étiquette locale. Ne JAMAIS l'appliquer à un canal `broadcast` ou
 * `presence` : là, le nom est le point de rendez-vous entre plusieurs
 * clients, et le suffixer isolerait chaque participant dans son propre canal.
 * Deux canaux de ce type existent et doivent garder leur nom exact :
 * `typing:<chatId>` (indicateur de frappe) et `projects-sync`.
 */
let channelSequence = 0

export function uniqueChannelTopic(base: string): string {
    channelSequence += 1
    return `${base}#${channelSequence}`
}

/**
 * Forme normalisée d'un changement Realtime : le payload Supabase expose
 * `new`/`old` comme objets partiels selon l'eventType (DELETE n'a que
 * `old`, INSERT n'a que `new`) — on uniformise en Partial<Row>.
 */
export type RealtimeChange<Row> = {
    eventType: "INSERT" | "UPDATE" | "DELETE"
    newRow: Partial<Row>
    oldRow: Partial<Row>
}

/**
 * S'abonne à tous les événements d'une table. Retourne la fonction de
 * désabonnement, à appeler dans le cleanup du `useEffect` appelant.
 */
export function subscribeToTable<Row>(
    channelName: string,
    table: string,
    filter: string | undefined,
    handler: (change: RealtimeChange<Row>) => void
): () => void {
    const channel = supabase
        // Suffixé : deux appelants passant le même `channelName` se
        // partageraient sinon une seule instance de canal (voir
        // `uniqueChannelTopic`).
        .channel(uniqueChannelTopic(channelName))
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
