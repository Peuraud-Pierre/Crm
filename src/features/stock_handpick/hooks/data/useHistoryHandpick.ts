import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import * as historyService from "@/features/stock_handpick/services/historyHandpickService"
import { groupActivityLogs } from "@/features/stock_handpick/utils/historyHelpers"
import type {
    HandpickActivityLog,
    HandpickHistoryFiltersState,
} from "@/features/stock_handpick/types/history.types"
import { DEFAULT_HANDPICK_HISTORY_FILTERS } from "@/features/stock_handpick/types/history.types"

/**
 * Journal d'activité — lecture seule.
 *
 * Ce hook est appelé directement par `HistoriqueTab`, sans passer par un
 * contexte global : Radix Tabs ne monte que le contenu de l'onglet actif, donc
 * le journal (jusqu'à ACTIVITY_LOG_LIMIT lignes + la table des profils) n'est
 * chargé que si l'utilisateur ouvre réellement cet onglet. Le placer dans
 * StockHandpickProvider l'aurait chargé à chaque visite du module.
 *
 * Pas de realtime : `activity_log_handpick` est délibérément hors de la
 * publication Supabase (migration 20260914145000), une table append-heavy
 * ferait décoder le WAL en continu pour tous les clients connectés.
 */
export function useHistoryHandpick() {
    const [logs, setLogs] = useState<HandpickActivityLog[]>([])
    const [userNames, setUserNames] = useState<Map<string, string>>(() => new Map())
    const [loading, setLoading] = useState(true)
    const [filters, setFilters] = useState<HandpickHistoryFiltersState>(
        DEFAULT_HANDPICK_HISTORY_FILTERS,
    )
    const { user } = useAuth()

    const fetchHistory = useCallback(async () => {
        try {
            const [rows, names] = await Promise.all([
                historyService.fetchActivityLog(),
                historyService.fetchUserNameMap(),
            ])
            setLogs(rows)
            setUserNames(names)
        } catch (error) {
            toast.error("Erreur lors du chargement de l'historique")
            console.error(error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!user?.user_id) return
        fetchHistory()
    }, [user?.user_id, fetchHistory])

    const filteredLogs = useMemo(() => {
        const query = filters.search.trim().toLowerCase()

        return logs.filter((log) => {
            if (filters.entity_type !== "all" && log.entity_type !== filters.entity_type) {
                return false
            }
            if (filters.action !== "all" && log.action !== filters.action) return false
            if (filters.user_id !== "all" && log.user_id !== filters.user_id) return false

            if (!query) return true
            return (
                (log.entity_label ?? "").toLowerCase().includes(query) ||
                (log.description ?? "").toLowerCase().includes(query)
            )
        })
    }, [logs, filters])

    const groups = useMemo(
        () => groupActivityLogs(filteredLogs, userNames),
        [filteredLogs, userNames],
    )

    /** Auteurs présents dans le journal, pour alimenter le filtre. */
    const authors = useMemo(() => {
        const ids = new Set(logs.map((log) => log.user_id).filter((id): id is string => id !== null))
        return [...ids]
            .map((id) => ({ id, name: userNames.get(id) ?? "Utilisateur inconnu" }))
            .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    }, [logs, userNames])

    const hasActiveFilters = useMemo(
        () =>
            (Object.keys(filters) as (keyof HandpickHistoryFiltersState)[]).some(
                (key) => filters[key] !== DEFAULT_HANDPICK_HISTORY_FILTERS[key],
            ),
        [filters],
    )

    const resetFilters = useCallback(() => setFilters(DEFAULT_HANDPICK_HISTORY_FILTERS), [])

    return {
        logs,
        groups,
        authors,
        userNames,
        loading,
        filters,
        setFilters,
        resetFilters,
        hasActiveFilters,
        refetch: fetchHistory,
    }
}
