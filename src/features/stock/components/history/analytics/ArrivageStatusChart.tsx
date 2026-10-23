import { PieChart as PieChartIcon } from "lucide-react"
import {
    Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { chartColor } from "@/shared/lib/chartPalette"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import { ANALYTICS_TOP_N, ARRIVAGE_STATUS_CONFIG } from "@/features/stock/constants"
import type { ArrivageStatus } from "@/features/stock/types/stock.types"
import type { FournisseurStats } from "@/features/stock/utils/fournisseurAnalytics"
import { ARRIVAGE_STATUSES } from "@/features/stock/utils/fournisseurAnalytics"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

interface ArrivageStatusChartProps {
    perFournisseur: FournisseurStats[]
    statusBreakdown: { status: ArrivageStatus; count: number }[]
    loading?: boolean
}

/**
 * Répartition des arrivages par statut, empilée sur les principaux
 * fournisseurs : où en est le flux, et chez qui.
 */
export function ArrivageStatusChart({
    perFournisseur, statusBreakdown, loading = false,
}: ArrivageStatusChartProps) {
    const presentStatuses = statusBreakdown.map((entry) => entry.status)

    const data = perFournisseur
        .filter((entry) => entry.arrivageCount > 0)
        .slice(0, ANALYTICS_TOP_N)
        .map((entry) => ({
            name: entry.name,
            ...Object.fromEntries(
                presentStatuses.map((status) => [status, entry.byStatus[status] ?? 0]),
            ),
        }))

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle className="text-base">Statut des arrivages</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
                {loading ? (
                    <div className="p-4 sm:p-0">
                        <Skeleton className="h-64 w-full rounded-lg" />
                    </div>
                ) : data.length === 0 ? (
                    <EmptyState
                        icon={PieChartIcon}
                        title="Aucun arrivage sur la période"
                        description="La répartition par statut s'affichera dès qu'un arrivage sera enregistré."
                    />
                ) : (
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ left: 0, right: 8 }}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="hsl(var(--border))"
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="name"
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={0}
                                    minTickGap={8}
                                />
                                <YAxis
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    allowDecimals={false}
                                    width={32}
                                />
                                <Tooltip
                                    {...RECHARTS_TOOLTIP_THEME}
                                    cursor={{ fill: "hsl(var(--muted))" }}
                                />
                                <Legend />
                                {presentStatuses.map((status, index) => (
                                    <Bar
                                        key={status}
                                        dataKey={status}
                                        name={ARRIVAGE_STATUS_CONFIG[status]?.label ?? status}
                                        stackId="status"
                                        fill={chartColor(ARRIVAGE_STATUSES.indexOf(status))}
                                        radius={index === presentStatuses.length - 1 ? [4, 4, 0, 0] : undefined}
                                    />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
