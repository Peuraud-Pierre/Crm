import type { ActivityLog } from "@/features/stock/types/history.types"
import type { CategoryPriceHistory } from "@/features/stock/types/history.types"
import type { LogGroup, ChartDataPoint } from "@/features/stock/types/history.types"
import type { LogFetchParams } from "@/features/stock/hooks/data/useHistory"

import { GROUPING_WINDOW_MS, GROUPS_PER_PAGE } from "@/features/stock/constants"
import { groupLogs as groupLogsShared } from "@/shared/lib/logGrouping"
import { GESTION_THEME } from "@/features/stock/theme"
export { GROUPING_WINDOW_MS, GROUPS_PER_PAGE }
export const LINE_COLORS = GESTION_THEME.chart.palette

/**
 * Regroupe le journal pour le feed. L'algorithme vit dans
 * `shared/lib/logGrouping.ts`, partagé avec le stock handpick ; il ne reste ici
 * que la mise en forme du groupe attendue par `ActivityFeed`.
 *
 * `anchor: "head"` conserve le découpage historique de ce module : la fenêtre
 * est mesurée depuis l'entrée qui a ouvert le groupe, si bien qu'une salve
 * longue finit par se scinder. Le handpick, lui, glisse la fenêtre — voir le
 * docblock du socle.
 */
export function groupLogs(logs: ActivityLog[]): LogGroup[] {
    return groupLogsShared(logs, { windowMs: GROUPING_WINDOW_MS, anchor: "head" }).map(
        (group) => ({
            key:          group.key,
            action:       group.action,
            entity_type:  group.entity_type,
            user_id:      group.user_id,
            count:        group.entries.length,
            logs:         group.entries,
            created_at:   group.created_at,
            // L'entrée d'ouverture porte le libellé affiché pour tout le groupe.
            entity_label: group.entries[0].entity_label,
            description:  group.entries[0].description,
        }),
    )
}

export function getPaginationButtons(current: number, total: number): (number | "…")[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    if (current <= 4) return [1, 2, 3, 4, 5, "…", total]
    if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total]
    return [1, "…", current - 1, current, current + 1, "…", total]
}

export function buildPriceChartData(
    history: CategoryPriceHistory[],
    selectedCategory: string,
): { data: ChartDataPoint[]; categories: string[] } {
    const filtered = selectedCategory === "all"
        ? history
        : history.filter((h) => h.category_id === selectedCategory)
    if (filtered.length === 0) return { data: [], categories: [] }

    const categoryMap = new Map<string, string>()
    for (const h of filtered) {
        if (h.category_id && h.category_name) categoryMap.set(h.category_id, h.category_name)
    }

    const byDate = new Map<string, ChartDataPoint>()
    for (const h of filtered) {
        const day = h.created_at.substring(0, 10)
        if (!byDate.has(day)) byDate.set(day, { date: day })
        byDate.get(day)![categoryMap.get(h.category_id) ?? h.category_id] = h.new_price
    }

    return {
        data:       Array.from(byDate.values()).sort((a, b) => (a.date as string).localeCompare(b.date as string)),
        categories: Array.from(categoryMap.values()),
    }
}

/**
 * Nombre de filtres actifs. En vue Analyse, seuls les bornes de période sont
 * proposées : compter action/type y afficherait un badge sur des filtres
 * invisibles.
 */
export function countActiveFilters(p: LogFetchParams, datesOnly = false): number {
    let n = 0
    if (!datesOnly && p.actionFilter !== "all") n++
    if (!datesOnly && p.entityFilter !== "all") n++
    if (p.dateFrom) n++
    if (p.dateTo)   n++
    return n
}
