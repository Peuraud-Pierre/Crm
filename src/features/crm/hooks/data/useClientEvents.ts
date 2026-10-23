import { useQuery } from "@tanstack/react-query"
import { fetchClientEvents } from "@/features/crm/services/calendarEventService"
import type { Event_creation } from "@/features/crm/types"

const EMPTY: Event_creation[] = []

/**
 * Tous les RDV d'un client (confirmés et en attente), pour la fiche client.
 *
 * Indépendant de l'agenda, qui ne garde qu'une fenêtre de dates : la fiche et
 * son export RGPD ont besoin de l'historique complet du client. Mis en cache
 * par client — rouvrir une fiche récente ne refait pas la requête.
 */
export function useClientEvents(clientId: string | null | undefined) {
    const { data } = useQuery({
        queryKey: ["crm", "client-events", clientId],
        queryFn: async () => {
            const { data, error } = await fetchClientEvents(clientId as string)
            if (error) throw error
            return (data ?? []) as unknown as Event_creation[]
        },
        enabled: !!clientId,
        // Le realtime ne met pas ce cache à jour : la fiche fusionne déjà avec
        // `events` (temps réel), on se contente d'une fraîcheur courte.
        staleTime: 30_000,
    })
    return data ?? EMPTY
}
