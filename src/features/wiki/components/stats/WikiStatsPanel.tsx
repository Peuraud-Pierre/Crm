import { useMemo, useRef, useState } from "react"
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import {
    TabButton,
    TabButtonGroup,
} from "@/shared/ui/molecules/tab-button-group"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { useWikiContext } from "../../hooks/context/useWikiContext"
import { useWikiStats } from "../../hooks/data/useWikiStats"
import { getCategoryPath } from "../../utils/wikiTree"
import {
    WIKI_STATS_DEFAULT_RANGE,
    WIKI_STATS_RANGES,
    type WikiStatsRangeKey,
} from "../../constants"
import { WikiStatsKpis } from "./WikiStatsKpis"
import { WikiStatsTimeseries } from "./WikiStatsTimeseries"
import { TopArticlesTable } from "./TopArticlesTable"
import { ColdArticlesCard } from "./ColdArticlesCard"
import { ReadersTable } from "./ReadersTable"
import { RetentionCard } from "./RetentionCard"

/**
 * Onglet « Statistiques » de la gestion du wiki : que vaut la base de
 * connaissances à l'usage.
 *
 * Monté uniquement quand l'onglet est actif — les RPC de stats ne partent donc pas
 * à l'ouverture du mode gestion.
 */
export function WikiStatsPanel() {
    const { articles, categories, setSelectedArticle, setMode } =
        useWikiContext()
    const [rangeKey, setRangeKey] = useState<WikiStatsRangeKey>(
        WIKI_STATS_DEFAULT_RANGE
    )
    const {
        overview,
        timeseries,
        topArticles,
        coldArticles,
        readers,
        retention,
        loading,
        error,
        refetch,
    } = useWikiStats(rangeKey)

    // Conteneur du sélecteur de période : offsetParent de la pastille glissante.
    const rangeRef = useRef<HTMLDivElement | null>(null)

    const pathLabel = useMemo(
        () => (categoryId: string | null) => {
            const path = getCategoryPath(categories, categoryId)
            return path.length
                ? path.map((c) => c.name).join(" › ")
                : "Sans catégorie"
        },
        [categories]
    )

    const openArticle = (articleId: string) => {
        const article = articles.find((a) => a.id === articleId)
        if (!article) return
        setSelectedArticle(article, "direct")
        setMode("read")
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <TabButtonGroup
                    containerRef={rangeRef}
                    aria-label="Période analysée"
                    className="inline-flex items-center gap-0.5 rounded-full border bg-muted/60 p-0.5"
                >
                    {WIKI_STATS_RANGES.map((range) => (
                        <TabButton
                            key={range.value}
                            id={range.value}
                            label={range.label}
                            shortLabel={range.shortLabel}
                            active={rangeKey}
                            set={(v) => setRangeKey(v as WikiStatsRangeKey)}
                        />
                    ))}
                </TabButtonGroup>

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={refetch}
                    disabled={loading}
                    className="gap-2 sm:ml-auto"
                >
                    <RefreshCw
                        className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                    />
                    Actualiser
                </Button>
            </div>

            {error ? (
                <EmptyState
                    icon={AlertTriangle}
                    title="Statistiques indisponibles"
                    description={error.message}
                    action={{ label: "Réessayer", onClick: refetch }}
                    className="rounded-2xl border border-dashed"
                />
            ) : loading && !overview ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <>
                    <WikiStatsKpis overview={overview} />
                    <WikiStatsTimeseries data={timeseries} />

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <TopArticlesTable
                            articles={topArticles}
                            categoryPath={pathLabel}
                            onSelect={openArticle}
                        />
                        <ColdArticlesCard
                            articles={coldArticles}
                            categoryPath={pathLabel}
                            onSelect={openArticle}
                        />
                        <ReadersTable readers={readers} />
                        <RetentionCard cells={retention} />
                    </div>
                </>
            )}
        </div>
    )
}
