import { createContext, use, useEffect, useMemo, useState, type ReactNode } from "react"
import { format, subDays } from "date-fns"
import { useTri } from "@/features/salle-de-tri/hooks/data/useTri"
import * as triService from "@/features/salle-de-tri/services/triService"
import { useReferentialContext } from "@/features/stock"
import {
    applyTriFilters,
    compareTotals,
    computeTriAnalytics,
    DEFAULT_TRI_FILTERS,
    previousPeriod,
    type TriTrend,
} from "@/features/salle-de-tri/utils/triAnalytics"
import type { FicheTriComplete, Trieur, TriFilters, TriSortie } from "@/features/salle-de-tri/types/tri.types"

/**
 * État de la page Salle de tri : données (période chargée), filtres, et les
 * fiches filtrées que lisent à la fois le tableau et les statistiques — les
 * deux vues montrent toujours le MÊME périmètre.
 *
 * Monté par la route `routes/SalleTri.tsx`.
 */

/** Période chargée par défaut : les 30 derniers jours. */
export function defaultTriFilters(today = new Date()): TriFilters {
    return { ...DEFAULT_TRI_FILTERS, dateFrom: format(subDays(today, 30), "yyyy-MM-dd") }
}

type TriData = ReturnType<typeof useTri>

interface TriContextValue extends TriData {
    filters: TriFilters
    setFilters: (next: TriFilters) => void
    /** Fiches de la période, filtrées (lignes comprises). */
    filtered: FicheTriComplete[]
    trieurById: Map<string, Trieur>
    sortieById: Map<string, TriSortie>
    categoryName: (id: string) => string
    /**
     * Évolution par rapport à la période précédente de même durée, mêmes
     * filtres. `null` tant qu'elle charge, ou sans période (« Tout »).
     */
    trend: TriTrend | null
}

const TriContext = createContext<TriContextValue | null>(null)

export function TriProvider({ children }: { children: ReactNode }) {
    const [filters, setFilters] = useState<TriFilters>(() => defaultTriFilters())
    // Seule la période part en base ; le reste filtre en mémoire.
    const range = useMemo(() => ({ from: filters.dateFrom, to: filters.dateTo }), [filters.dateFrom, filters.dateTo])
    const data = useTri(range)
    const { categories } = useReferentialContext()

    const categoryName = useMemo(() => {
        const names = new Map(categories.map((c) => [c.id, c.name ?? ""]))
        return (id: string) => names.get(id) ?? "Catégorie supprimée"
    }, [categories])

    const filtered = useMemo(
        () => applyTriFilters(data.fiches, filters, categoryName),
        [data.fiches, filters, categoryName],
    )

    const previous = usePreviousFiches(filters.dateFrom, filters.dateTo)
    const trend = useMemo(() => {
        if (!previous) return null
        const prevFiltered = applyTriFilters(
            previous.fiches,
            { ...filters, dateFrom: previous.range.from, dateTo: previous.range.to },
            categoryName,
        )
        return compareTotals(computeTriAnalytics(prevFiltered).totals, computeTriAnalytics(filtered).totals)
    }, [previous, filters, filtered, categoryName])

    const value = useMemo<TriContextValue>(() => ({
        ...data,
        filters,
        setFilters,
        filtered,
        trieurById: new Map(data.trieurs.map((t) => [t.id, t])),
        sortieById: new Map(data.sorties.map((s) => [s.id, s])),
        categoryName,
        trend,
    }), [data, filters, filtered, categoryName, trend])

    return <TriContext value={value}>{children}</TriContext>
}

/**
 * Fiches de la période précédente, pour la tendance des indicateurs. Chargées
 * à côté, sans retarder la page ni signaler d'erreur : la tendance est un
 * plus, son absence ne gêne rien. Pas d'abonnement realtime — on ne saisit
 * presque jamais dans une période passée.
 */
function usePreviousFiches(dateFrom: string, dateTo: string) {
    const range = useMemo(() => previousPeriod({ dateFrom, dateTo }), [dateFrom, dateTo])
    const [loaded, setLoaded] = useState<{ range: { from: string; to: string }; fiches: FicheTriComplete[] } | null>(null)

    useEffect(() => {
        if (!range) return
        let cancelled = false
        triService.fetchFichesComplete(range)
            .then((fiches) => !cancelled && setLoaded({ range, fiches }))
            .catch((error) => console.error(error))
        return () => {
            cancelled = true
        }
    }, [range])

    // Une réponse d'une autre période (filtre changé entre-temps) ne compte pas.
    return range && loaded?.range === range ? loaded : null
}

export function useTriContext(): TriContextValue {
    const ctx = use(TriContext)
    if (!ctx) throw new Error("useTriContext doit être utilisé sous <TriProvider>")
    return ctx
}
