import {
    createContext,
    use,
    useMemo,
    type ReactNode,
} from "react"
import { useHistory } from "../data/useHistory"
import type { LogFetchParams } from "../data/useHistory"
import type { ActivityLog, CategoryPriceHistory } from "@/features/stock/types/stock.types"

interface HistoryContextType {
    activityLogs:      ActivityLog[]
    logTotalCount:     number
    priceHistory:      CategoryPriceHistory[]
    userMap:           Map<string, string>
    loading:           boolean
    loadingLogs:       boolean
    fetchActivityLogs: (params?: LogFetchParams) => Promise<void>
    fetchPriceHistory: () => Promise<void>
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined)

export function HistoryProvider({ children }: { children: ReactNode }) {
    const {
        activityLogs,
        logTotalCount,
        priceHistory,
        userMap,
        loading,
        loadingLogs,
        fetchActivityLogs,
        fetchPriceHistory,
    } = useHistory()

    const value = useMemo(
        () => ({
            activityLogs,
            logTotalCount,
            priceHistory,
            userMap,
            loading,
            loadingLogs,
            fetchActivityLogs,
            fetchPriceHistory,
        }),
        [
            activityLogs, logTotalCount, priceHistory,
            userMap, loading, loadingLogs,
            fetchActivityLogs, fetchPriceHistory,
        ]
    )

    return (
        <HistoryContext value={value}>
            {children}
        </HistoryContext>
    )
}

export function useHistoryContext() {
    const context = use(HistoryContext)
    if (!context) {
        throw new Error("useHistoryContext must be used within a HistoryProvider")
    }
    return context
}
