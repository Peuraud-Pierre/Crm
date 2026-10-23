import { useQuery } from "@tanstack/react-query"
import * as clientService from "@/features/crm/services/clientService"
import type { Client } from "@/features/crm/types"

const EMPTY: Client[] = []

/**
 * Clients de l'Analytics, dans leur propre entrée de cache.
 *
 * Remplace fetchAllClients, qui itérait des pages de 100 fiches complètes à
 * chaque changement de période ou de commercial, et écrasait au passage
 * `clients[]` du Kanban. Ne charge que les champs utiles aux widgets.
 */
export function useAnalyticsClients() {
    const { data, isFetching } = useQuery({
        queryKey: ["crm", "analytics-clients"],
        queryFn: async () => {
            const rows = await clientService.fetchClientsForAnalytics()
            // Le filtre par commercial de l'Analytics lit `customer.user_id`
            // (forme jointe) : on garde ce contrat sans la jointure profiles.
            return rows.map((c) => ({
                ...c,
                customer: c.customer ? { user_id: c.customer } : null,
            })) as unknown as Client[]
        },
    })
    return { clients: data ?? EMPTY, isFetching }
}
