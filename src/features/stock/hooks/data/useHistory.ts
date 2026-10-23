import { useCallback, useEffect, useState } from "react"
import type { ActivityLog, CategoryPriceHistory } from "@/features/stock/types/history.types"
import * as historyService from "@/features/stock/services/historyService"
import type { LogFetchParams } from "@/features/stock/services/historyService"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"

export type { LogFetchParams } from "@/features/stock/services/historyService"

export const DEFAULT_LOG_PARAMS: LogFetchParams = {
    actionFilter: "all",
    entityFilter: "all",
    dateFrom:     "",
    dateTo:       "",
}

export function useHistory() {
    const [activityLogs, setActivityLogs]   = useState<ActivityLog[]>([])
    const [logTotalCount, setLogTotalCount] = useState(0)
    const [priceHistory, setPriceHistory]   = useState<CategoryPriceHistory[]>([])
    const [userMap, setUserMap]             = useState<Map<string, string>>(() => new Map())
    const [loading, setLoading]             = useState(true)
    const [loadingLogs, setLoadingLogs]     = useState(false)

    const { user } = useAuth()

    const fetchActivityLogs = useCallback(async (params: LogFetchParams = DEFAULT_LOG_PARAMS) => {
        setLoadingLogs(true)
        try {
            const data = await historyService.fetchActivityLogs(params)
            setActivityLogs(data)
            setLogTotalCount(data.length)
        } catch {
            // silent — realtime garde les données à jour
        } finally {
            setLoadingLogs(false)
        }
    }, [])

    const fetchPriceHistory = useCallback(async () => {
        try {
            const data = await historyService.fetchPriceHistory()
            setPriceHistory(data)
        } catch {
            // silent
        }
    }, [])

    const fetchUserProfiles = useCallback(async () => {
        try {
            const map = await historyService.fetchUserNameMap()
            setUserMap(map)
        } catch {
            // silent
        }
    }, [])

    useEffect(() => {
        if (!user?.user_id) return

        const init = async () => {
            setLoading(true)
            await Promise.all([
                fetchActivityLogs(DEFAULT_LOG_PARAMS),
                fetchPriceHistory(),
                fetchUserProfiles(),
            ])
            setLoading(false)
        }
        init()

        // Pas de Realtime : `activity_log` est une table append-heavy (chaque
        // action de l'app y écrit) — la garder hors de la publication évite un
        // décodage WAL permanent. Le journal se recharge au montage et via
        // `fetchActivityLogs` (filtres / actualisation manuelle).
    }, [user?.user_id, fetchActivityLogs, fetchPriceHistory, fetchUserProfiles])

    return {
        activityLogs,
        logTotalCount,
        priceHistory,
        userMap,
        loading,
        loadingLogs,
        fetchActivityLogs,
        fetchPriceHistory,
    }
}
