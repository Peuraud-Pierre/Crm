import { useCallback, useState } from "react"
import { usePrefersReducedMotion } from "@/shared/hooks/usePrefersReducedMotion"
import { Pause, Play, ScrollText } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { cn } from "@/shared/lib/utils"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { PaginationFooter } from "@/features/arrivage-admin/components/shared/PaginationFooter"
import { RefreshButton } from "@/features/arrivage-admin/components/shared/RefreshButton"
import { LogFilters } from "@/features/arrivage-admin/components/logs/LogFilters"
import { LogLine } from "@/features/arrivage-admin/components/logs/LogLine"
import { useNewsletterLogs } from "@/features/arrivage-admin/hooks/data/useNewsletterLogs"
import { useCopyFeedback } from "@/features/arrivage-admin/hooks/useCopyFeedback"
import type { LogFilters as LogFiltersValue } from "@/features/arrivage-admin/types"

const SKELETON_KEYS = ["ll1", "ll2", "ll3", "ll4", "ll5", "ll6"]

const INITIAL_FILTERS: LogFiltersValue = {
    levels: [],
    search: "",
    reqId: "",
    since: null,
    until: null,
}

/** Console des logs du service Go. */
export function ApiLogsPanel() {
    // Un objet de state, pas un littéral recréé à chaque rendu : le hook
    // dépend de sa référence pour savoir quand relancer un chargement.
    const [filters, setFilters] = useState<LogFiltersValue>(INITIAL_FILTERS)
    const [autoRefresh, setAutoRefresh] = useState(false)

    const {
        lines,
        loading,
        error,
        hasNext,
        hasPrevious,
        pageIndex,
        refresh,
        nextPage,
        previousPage,
    } = useNewsletterLogs(filters, autoRefresh)

    const { isCopied, copy } = useCopyFeedback()
    // Lu une fois ici plutôt que dans chaque LogLine : le hook s'abonne à un
    // media query, et la page en compte jusqu'à 100.
    const reducedMotion = usePrefersReducedMotion()

    const handleFilterReqId = useCallback((reqId: string) => {
        setFilters(prev => ({ ...prev, reqId }))
    }, [])

    const isEmpty = !loading && lines.length === 0

    return (
        <Card>
            <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <CardTitle>Journal de l'API</CardTitle>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button
                            variant={autoRefresh ? "default" : "outline"}
                            size="sm"
                            onClick={() => setAutoRefresh(v => !v)}
                            aria-pressed={autoRefresh}
                            title={
                                autoRefresh
                                    ? "Suspendre le rafraîchissement automatique"
                                    : "Rafraîchir automatiquement"
                            }
                        >
                            {autoRefresh ? (
                                <Pause className="h-4 w-4 sm:mr-1" />
                            ) : (
                                <Play className="h-4 w-4 sm:mr-1" />
                            )}
                            <span className="hidden sm:inline">Auto</span>
                        </Button>
                        <RefreshButton
                            loading={loading}
                            onClick={() => refresh()}
                            label="les logs"
                        />
                    </div>
                </div>
                <LogFilters filters={filters} onChange={setFilters} />
            </CardHeader>

            <CardContent className="p-0" aria-busy={loading}>
                {error && (
                    <p className="px-4 pb-4 text-sm text-destructive sm:px-6">
                        {error}
                    </p>
                )}

                {loading ? (
                    <div className="space-y-3 p-4 sm:p-6">
                        {SKELETON_KEYS.map(key => (
                            <Skeleton key={key} className="h-12 w-full rounded-lg" />
                        ))}
                    </div>
                ) : isEmpty && !error ? (
                    <EmptyState
                        icon={ScrollText}
                        title="Aucune ligne de log"
                        description="Les logs du service sont conservés 3 mois. Élargissez les filtres si vous cherchez un évènement plus ancien."
                    />
                ) : (
                    <>
                        {/*
                         * La liste défile dans sa propre zone : sans hauteur
                         * bornée, une page de 100 lignes allongeait la carte et
                         * c'était la page entière qui scrollait.
                         * `max-h` en unité de viewport (valeur arbitraire
                         * assumée, précédent : ActivityFeed) — une hauteur en
                         * rem serait soit ridicule sur grand écran, soit
                         * inutilisable sur petit.
                         * Pas de préfixe `sm:` ici, contrairement à
                         * ErrorConsole : ce préfixe y désactive tout garde-fou
                         * sous 640 px, ce qui est précisément le cas à corriger.
                         */}
                        <div
                            className={cn(
                                "max-h-[70svh] overflow-y-auto overscroll-contain",
                                // Le clavier doit pouvoir atteindre la zone
                                // défilante quand elle déborde.
                                "focus-visible:outline-none"
                            )}
                            tabIndex={0}
                            role="region"
                            aria-label="Lignes de journal"
                        >
                            <ul className="divide-y divide-border">
                                {lines.map((line, index) => (
                                    <LogLine
                                        key={line.id}
                                        line={line}
                                        index={index}
                                        copied={isCopied(String(line.id))}
                                        reducedMotion={reducedMotion}
                                        onCopy={copy}
                                        onFilterReqId={handleFilterReqId}
                                    />
                                ))}
                            </ul>
                        </div>

                        {/* Hors du scroller : reste visible en permanence. */}
                        <PaginationFooter
                            pageIndex={pageIndex}
                            hasPrevious={hasPrevious}
                            hasNext={hasNext}
                            onPrevious={previousPage}
                            onNext={nextPage}
                        />
                    </>
                )}
            </CardContent>
        </Card>
    )
}
