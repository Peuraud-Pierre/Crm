import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
    deleteAppLogs,
    fetchAppLogs,
} from "@/features/manager/services/appLogsService"

export type LogLevel = "error" | "warn" | "info" | "critical"

export interface AppLog {
    id: number
    created_at: string
    level: string | null
    message: string | null
    context: Record<string, unknown> | null
    user_id: string
    url: string | null
    stack: string | null
    session_id: string | null
    browser: string | null
    user_email: string | null
}

export interface AppLogsFilters {
    level?: LogLevel | "all"
    search?: string
    userId?: string
    from?: string
    to?: string
}

// On charge tout d'un coup pour que le grouping côté client soit cohérent.
// La pagination se fait sur les groupes affichés, pas sur les logs bruts.
const FETCH_LIMIT = 500
export const GROUPS_PAGE_SIZE = 25

export function useAppLogs() {
    const [logs, setLogs] = useState<AppLog[]>([])
    const [loading, setLoading] = useState(true)
    const [total, setTotal] = useState(0)
    const [filters, setFilters] = useState<AppLogsFilters>({ level: "all" })

    const fetchLogs = useCallback(async (currentFilters: AppLogsFilters) => {
        setLoading(true)

        // Construction de la requête (filtres, count:"planned", limite)
        // déplacée dans appLogsService.fetchAppLogs — voir le commentaire
        // du service pour la justification du count estimé.
        const { data, error, count } = await fetchAppLogs(
            currentFilters,
            FETCH_LIMIT
        )

        setLoading(false)

        if (error) {
            toast.error("Erreur lors du chargement des logs")
            return
        }

        setLogs((data ?? []) as AppLog[])
        setTotal(count ?? 0)
    }, [])

    useEffect(() => {
        fetchLogs(filters)
    }, [fetchLogs, filters])

    // Pas de Realtime : `app_logs` est une table à très fort volume d'écriture.
    // L'inscrire dans la publication ferait décoder son WAL en continu pour tous
    // les clients connectés. La consultation se fait au montage + via `refresh`
    // (bouton) — un léger délai d'actualisation est acceptable pour un viewer.

    const clearLogs = useCallback(
        async (ids?: number[]) => {
            const { error } = await deleteAppLogs(ids)
            if (error) {
                toast.error("Erreur lors de la suppression des logs")
                return
            }

            toast.success(
                ids
                    ? `${ids.length} log(s) supprimé(s)`
                    : "Tous les logs supprimés"
            )
            fetchLogs(filters)
        },
        [filters, fetchLogs]
    )

    const applyFilters = useCallback((newFilters: AppLogsFilters) => {
        setFilters(newFilters)
    }, [])

    const refresh = useCallback(() => {
        fetchLogs(filters)
    }, [fetchLogs, filters])

    return {
        logs,
        loading,
        total,
        filters,
        applyFilters,
        clearLogs,
        refresh,
    }
}
