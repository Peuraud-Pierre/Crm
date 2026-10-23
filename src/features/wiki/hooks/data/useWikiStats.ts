import { useCallback, useEffect, useMemo, useState } from "react"
import { startOfDay, subDays } from "date-fns"
import { wikiAnalyticsService } from "../../services/wikiAnalyticsService"
import { WIKI_STATS_RANGES, type WikiStatsRangeKey } from "../../constants"
import type {
    WikiColdArticle,
    WikiReader,
    WikiRetentionCell,
    WikiStatsOverview,
    WikiStatsPoint,
    WikiTopArticle,
} from "../../types/wiki-analytics.types"

/**
 * Charge les statistiques d'usage du wiki pour une période.
 *
 * Monté par l'onglet « Statistiques » uniquement : les cinq RPC ne partent
 * donc pas à l'ouverture du mode gestion. Même pattern manuel que
 * `useWikiCategories` / `useWikiArticles` — le projet n'utilise pas TanStack
 * Query dans les features.
 */
export function useWikiStats(rangeKey: WikiStatsRangeKey) {
    const [overview, setOverview] = useState<WikiStatsOverview | null>(null)
    const [timeseries, setTimeseries] = useState<WikiStatsPoint[]>([])
    const [topArticles, setTopArticles] = useState<WikiTopArticle[]>([])
    const [coldArticles, setColdArticles] = useState<WikiColdArticle[]>([])
    const [readers, setReaders] = useState<WikiReader[]>([])
    const [retention, setRetention] = useState<WikiRetentionCell[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const range = useMemo(() => {
        const days =
            WIKI_STATS_RANGES.find((r) => r.value === rangeKey)?.days ?? 30
        const to = new Date()
        return { from: startOfDay(subDays(to, days - 1)), to }
        // `rangeKey` seul : recalculer `to` à chaque rendu relancerait les
        // requêtes en boucle.
    }, [rangeKey])

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const [o, t, top, cold, r, c] = await Promise.all([
                wikiAnalyticsService.getOverview(range.from, range.to),
                wikiAnalyticsService.getTimeseries(range.from, range.to),
                wikiAnalyticsService.getTopArticles(range.from, range.to),
                wikiAnalyticsService.getColdArticles(range.from, range.to),
                wikiAnalyticsService.getReaders(range.from, range.to),
                wikiAnalyticsService.getRetention(range.from, range.to),
            ])
            setOverview(o)
            setTimeseries(t)
            setTopArticles(top)
            setColdArticles(cold)
            setReaders(r)
            setRetention(c)
        } catch (err) {
            console.error("[useWikiStats] fetch:", err)
            setError(err instanceof Error ? err : new Error(String(err)))
        } finally {
            setLoading(false)
        }
    }, [range])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    return {
        range,
        overview,
        timeseries,
        topArticles,
        coldArticles,
        readers,
        retention,
        loading,
        error,
        refetch: fetchStats,
    }
}
