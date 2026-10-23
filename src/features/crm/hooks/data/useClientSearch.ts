import { useEffect, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import * as clientService from "@/features/crm/services/clientService"
import {
    CLIENTS_KEY,
    parseClientRow,
} from "@/features/crm/hooks/data/useClientsCache"
import type { Client } from "@/features/crm/types"

const EMPTY: Client[] = []

/**
 * Recherche serveur de clients (nom, téléphone, mail, société) pour les
 * sélecteurs (devis, RDV, tâches). Terme vide → les clients les plus récents.
 *
 * Les résultats sont rangés sous CLIENTS_KEY : ils rejoignent le stock commun
 * (`clients` du CRMContext), où les écrans retrouvent le client choisi par id.
 */
export function useClientSearch(term: string, limit = 8) {
    const [debounced, setDebounced] = useState(() => term.trim())
    useEffect(() => {
        const t = setTimeout(() => setDebounced(term.trim()), 250)
        return () => clearTimeout(t)
    }, [term])

    const { data } = useQuery({
        queryKey: [...CLIENTS_KEY, "picker", debounced, limit],
        queryFn: async () => {
            const { data, error } = await clientService.fetchClientListPage({
                withCount: false,
                offset: 0,
                limit,
                orFilters: debounced
                    ? [clientService.clientSearchFilter(debounced)]
                    : [],
            })
            if (error) throw error
            return ((data ?? []) as unknown as Parameters<typeof parseClientRow>[0][]).map(
                parseClientRow
            )
        },
        // Les résultats précédents restent affichés pendant la frappe.
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    })
    return data ?? EMPTY
}
