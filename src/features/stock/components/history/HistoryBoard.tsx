import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/atoms/button"
import type { SearchSelectOption } from "@/shared/ui/molecules/search-select"
import { useHistoryContext } from "@/features/stock/hooks/context/StockProvider"
import type { ActivityAction, ActivityEntityType, ViewMode } from "@/features/stock/types/history.types"
import type { LogFetchParams } from "@/features/stock/hooks/data/useHistory"
import { ACTIVITY_LOG_LIMIT } from "@/features/stock/constants"
import {
    groupLogs, buildPriceChartData,
    getPaginationButtons, countActiveFilters,
    GROUPS_PER_PAGE,
} from "../../utils/historyHelpers"
import { ActivityFeed } from "./ActivityFeed"
import { PriceChartPanel } from "./PriceChartPanel"
import { HistoryFilterBar } from "./HistoryFilterBar"
import FournisseurAnalytics from "./analytics/FournisseurAnalytics"

export default function HistoryBoard() {
    const {
        activityLogs, logTotalCount, priceHistory,
        userMap, loading, loadingLogs,
        fetchActivityLogs, fetchPriceHistory,
    } = useHistoryContext()

    const [view, setView]               = useState<ViewMode>("journal")
    const [filtersOpen, setFiltersOpen] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState("all")
    const [page, setPage]               = useState(1)

    const [actionFilter, setActionFilter] = useState<ActivityAction | "all">("all")
    const [entityFilter, setEntityFilter] = useState<ActivityEntityType | "all">("all")
    const [dateFrom, setDateFrom]         = useState("")
    const [dateTo, setDateTo]             = useState("")

    const currentParams: LogFetchParams = { actionFilter, entityFilter, dateFrom, dateTo }
    // La vue Analyse n'expose que la période : ne pas compter action/type.
    const activeCount = countActiveFilters(currentParams, view === "analyse")

    // Refetch quand les filtres changent; reset pagination à la page 1.
    useEffect(() => {
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setPage(1)
        fetchActivityLogs(currentParams)
    }, [actionFilter, entityFilter, dateFrom, dateTo, fetchActivityLogs])

    // Grouping client-side sur tous les logs récupérés
    const groups = useMemo(() => groupLogs(activityLogs), [activityLogs])

    const totalGroupPages = Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE))
    const pageGroups = useMemo(() => {
        const from = (page - 1) * GROUPS_PER_PAGE
        return groups.slice(from, from + GROUPS_PER_PAGE)
    }, [groups, page])

    const categoryOptions = useMemo<SearchSelectOption[]>(() => {
        const seen = new Map<string, string>()
        for (const h of priceHistory) {
            if (h.category_id && h.category_name) seen.set(h.category_id, h.category_name)
        }
        return [
            { value: "all", label: "Toutes" },
            ...Array.from(seen.entries()).map(([id, name]) => ({ value: id, label: name })),
        ]
    }, [priceHistory])

    const { data: chartData, categories: chartCategories } = useMemo(
        () => buildPriceChartData(priceHistory, selectedCategory),
        [priceHistory, selectedCategory],
    )

    const handleResetFilters = () => {
        setActionFilter("all"); setEntityFilter("all")
        setDateFrom("");        setDateTo("");        setPage(1)
    }

    const handleSetView = (v: ViewMode) => {
        setView(v)
        if (v === "prix") setFiltersOpen(false)
    }

    const handleRefresh = () => {
        fetchActivityLogs(currentParams)
        if (view === "prix") fetchPriceHistory()
    }

    return (
        <div className="flex flex-col gap-4">

            <HistoryFilterBar
                view={view}
                onViewChange={handleSetView}
                filtersOpen={filtersOpen}
                onFiltersOpenChange={setFiltersOpen}
                activeCount={activeCount}
                actionFilter={actionFilter}
                onActionFilterChange={(v) => { setActionFilter(v); setPage(1) }}
                entityFilter={entityFilter}
                onEntityFilterChange={(v) => { setEntityFilter(v); setPage(1) }}
                dateFrom={dateFrom}
                onDateFromChange={(v) => { setDateFrom(v); setPage(1) }}
                dateTo={dateTo}
                onDateToChange={(v) => { setDateTo(v); setPage(1) }}
                onReset={handleResetFilters}
                onRefresh={handleRefresh}
                refreshing={loadingLogs || loading}
            />

            {view === "analyse" ? (
                <FournisseurAnalytics dateFrom={dateFrom} dateTo={dateTo} />
            ) : view === "prix" ? (
                <PriceChartPanel
                    chartData={chartData}
                    chartCategories={chartCategories}
                    categoryOptions={categoryOptions}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    loading={loading}
                />
            ) : (
                <div className="flex flex-col gap-3">
                    <ActivityFeed
                        key={page}
                        groups={pageGroups}
                        userMap={userMap}
                        loading={loading || loadingLogs}
                    />

                    {/* Footer : stats toujours visibles + boutons si > 1 page */}
                    {!loading && !loadingLogs && groups.length > 0 && (
                        <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-3 sm:flex-row">

                            <span className="order-2 text-xs text-muted-foreground tabular-nums sm:order-1">
                                {groups.length} groupe{groups.length !== 1 ? "s" : ""}
                                {" · "}
                                {logTotalCount >= ACTIVITY_LOG_LIMIT
                                    ? `${ACTIVITY_LOG_LIMIT.toLocaleString("fr-FR")} derniers événements`
                                    : `${logTotalCount.toLocaleString("fr-FR")} événement${logTotalCount !== 1 ? "s" : ""}`}
                            </span>

                            {totalGroupPages > 1 && (
                                <div className="order-1 flex items-center gap-1 sm:order-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => setPage((p) => p - 1)}
                                        disabled={page === 1}
                                    >
                                        <ChevronLeft size={14} />
                                    </Button>

                                    <div className="hidden items-center gap-1 sm:flex">
                                        {getPaginationButtons(page, totalGroupPages).map((btn, i, arr) =>
                                            btn === "…" ? (
                                                <span key={i < arr.length / 2 ? "ellipsis-start" : "ellipsis-end"} className="w-7 text-center text-xs text-muted-foreground">…</span>
                                            ) : (
                                                <button
                                                    key={btn}
                                                    type="button"
                                                    onClick={() => setPage(btn as number)}
                                                    className={cn(
                                                        "h-7 w-7 rounded-md text-xs font-medium transition-colors",
                                                        btn === page
                                                            ? "bg-foreground text-background"
                                                            : "text-muted-foreground hover:bg-muted",
                                                    )}
                                                >
                                                    {btn}
                                                </button>
                                            )
                                        )}
                                    </div>

                                    <span className="px-2 text-xs text-muted-foreground tabular-nums sm:hidden">
                                        {page} / {totalGroupPages}
                                    </span>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        onClick={() => setPage((p) => p + 1)}
                                        disabled={page === totalGroupPages}
                                    >
                                        <ChevronRight size={14} />
                                    </Button>
                                </div>
                            )}

                            {totalGroupPages > 1 && <div className="order-3 hidden w-40 sm:block" />}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
