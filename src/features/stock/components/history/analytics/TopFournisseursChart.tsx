import { useState } from "react"
import { Building2 } from "lucide-react"
import {
    Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { cn } from "@/shared/lib/utils"
import { chartColor } from "@/shared/lib/chartPalette"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import { GESTION_THEME } from "@/features/stock/theme"
import { ANALYTICS_TOP_N } from "@/features/stock/constants"
import type { FournisseurStats } from "@/features/stock/utils/fournisseurAnalytics"
import { formatTonnage } from "@/features/stock/utils/fournisseurAnalytics"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

type Metric = "arrivages" | "tonnage"

const METRICS: { id: Metric; label: string }[] = [
    { id: "arrivages", label: "Arrivages" },
    { id: "tonnage",   label: "Tonnage" },
]

interface TopFournisseursChartProps {
    perFournisseur: FournisseurStats[]
    loading?: boolean
}

/** Top fournisseurs de la période, en barres horizontales. */
export function TopFournisseursChart({ perFournisseur, loading = false }: TopFournisseursChartProps) {
    const [metric, setMetric] = useState<Metric>("arrivages")

    const top = [...perFournisseur]
        .filter((entry) => entry.arrivageCount > 0)
        .sort((a, b) =>
            metric === "arrivages"
                ? b.arrivageCount - a.arrivageCount
                : b.weightKg - a.weightKg,
        )
        .slice(0, ANALYTICS_TOP_N)
        .map((entry) => ({
            name: entry.name,
            value: metric === "arrivages" ? entry.arrivageCount : entry.weightKg,
            sharePct: entry.sharePct,
        }))

    const formatValue = (value: number) =>
        metric === "arrivages" ? String(value) : formatTonnage(value)

    return (
        <Card className="min-w-0">
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="text-base">Top fournisseurs</CardTitle>
                <div className={cn(GESTION_THEME.filterBar.tabToggle, "shrink-0")}>
                    {METRICS.map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setMetric(id)}
                            className={cn(
                                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                                metric === id
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
                {loading ? (
                    <div className="p-4 sm:p-0">
                        <Skeleton className="h-64 w-full rounded-lg" />
                    </div>
                ) : top.length === 0 ? (
                    <EmptyState
                        icon={Building2}
                        title="Aucun arrivage sur la période"
                        description="Élargissez la période pour voir la répartition par fournisseur."
                    />
                ) : (
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={top} layout="vertical" margin={{ left: 8, right: 16 }}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="hsl(var(--border))"
                                    horizontal={false}
                                />
                                <XAxis
                                    type="number"
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    allowDecimals={false}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    width={110}
                                />
                                <Tooltip
                                    {...RECHARTS_TOOLTIP_THEME}
                                    cursor={{ fill: "hsl(var(--muted))" }}
                                    formatter={(value) => [
                                        formatValue(typeof value === "number" ? value : 0),
                                        metric === "arrivages" ? "Arrivages" : "Tonnage",
                                    ]}
                                />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                    {top.map((entry, index) => (
                                        <Cell key={entry.name} fill={chartColor(index)} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
