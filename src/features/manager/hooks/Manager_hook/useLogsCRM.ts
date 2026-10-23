import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { fetchLogsCRM } from "@/features/manager/services/logsCRMService"

export interface CRMLog {
    id: string
    change_at: string | null
    changes_by: string | null
    row_id: string | null
    table_name: string | null
    operation: string | null
    old_data: string | null
    new_data: string | null
    changed_by_profile?: { user_id: string; full_name: string | null } | null
}

export interface CRMLogsFilters {
    operation?: "all" | "INSERT" | "UPDATE" | "DELETE"
    search?: string
}

const FETCH_LIMIT = 200
export const CRM_LOGS_PAGE_SIZE = 25

export function useLogsCRM() {
    const [logs, setLogs] = useState<CRMLog[]>([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [filters, setFilters] = useState<CRMLogsFilters>({ operation: "all" })

    const fetchLogs = useCallback(async (currentFilters: CRMLogsFilters) => {
        setLoading(true)

        // Construction de la requête (filtres, pas de count exact, limite)
        // déplacée dans logsCRMService.fetchLogsCRM — voir le commentaire du
        // service. Seules FETCH_LIMIT lignes sont chargées puis paginées côté
        // client, donc le total = nombre de lignes réellement récupérées.
        const { data, error } = await fetchLogsCRM(currentFilters, FETCH_LIMIT)

        setLoading(false)

        if (error) {
            toast.error("Erreur lors du chargement des logs CRM")
            return
        }

        const rows = (data ?? []) as unknown as CRMLog[]
        setLogs(rows)
        setTotal(rows.length)
    }, [])

    useEffect(() => {
        fetchLogs(filters)
    }, [fetchLogs, filters])

    // Pas de Realtime : `logs_crm` est une table d'audit à fort volume
    // d'écriture. La garder hors de la publication évite le décodage WAL continu
    // côté serveur Realtime. Consultation au montage + via `refresh`.

    const applyFilters = useCallback((newFilters: CRMLogsFilters) => {
        setFilters(newFilters)
    }, [])

    const refresh = useCallback(() => {
        fetchLogs(filters)
    }, [fetchLogs, filters])

    return { logs, loading, total, filters, applyFilters, refresh }
}
