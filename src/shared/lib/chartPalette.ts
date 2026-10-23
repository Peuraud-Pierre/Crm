/**
 * Palette catégorielle partagée pour les charts (Recharts).
 * Usage : `stroke`/`fill` direct, ou via ChartConfig pour ChartContainer
 * (src/shared/ui/organisms/chart.tsx) : { series: { color: CHART_PALETTE[0] } }
 *
 * Ne pas utiliser pour du sens sémantique (succès/alerte/erreur) — pour ça,
 * --success/--warning/--destructive (voir badge.tsx). Sert uniquement à
 * différencier des séries/catégories sans sens sémantique propre.
 */
export const CHART_PALETTE = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
    "hsl(var(--chart-6))",
    "hsl(var(--chart-7))",
    "hsl(var(--chart-8))",
] as const

export function chartColor(index: number): string {
    return CHART_PALETTE[index % CHART_PALETTE.length]
}
