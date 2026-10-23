import { TrendingUp } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import type { SearchSelectOption } from "@/shared/ui/molecules/search-select"
import { GESTION_THEME } from "@/features/stock/theme"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import {
    ResponsiveContainer, LineChart, Line,
    CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts"
import type { ChartDataPoint } from "@/features/stock/types/history.types"
import { LINE_COLORS } from "../../utils/historyHelpers"

interface PriceChartPanelProps {
    chartData:           ChartDataPoint[]
    chartCategories:     string[]
    categoryOptions:     SearchSelectOption[]
    selectedCategory:    string
    setSelectedCategory: (id: string) => void
    loading:             boolean
}

export function PriceChartPanel({
    chartData, chartCategories, categoryOptions,
    selectedCategory, setSelectedCategory, loading,
}: PriceChartPanelProps) {
    if (loading) return <Skeleton className="h-72 rounded-xl" />

    return (
        <div className="flex flex-col gap-4">
            {categoryOptions.length > 1 && (
                <div className={cn(GESTION_THEME.filterBar.container, "p-3")}>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <span className={cn(GESTION_THEME.filterBar.panelLabel, "normal-case tracking-normal shrink-0")}>
                            Catégorie :
                        </span>
                        <SearchSelect
                            options={categoryOptions}
                            value={selectedCategory}
                            onChange={setSelectedCategory}
                            placeholder="Toutes les catégories"
                            size="sm"
                            searchable={categoryOptions.length > 5}
                            className="w-full sm:w-[220px]"
                        />
                    </div>
                </div>
            )}

            {chartData.length === 0 ? (
                <EmptyState
                    className={GESTION_THEME.board.emptyState}
                    icon={TrendingUp}
                    title="Aucun changement de prix enregistré"
                    description="Le graphique se met à jour lorsqu'un prix de catégorie est modifié dans les paramètres."
                />
            ) : (
                <div className={cn(GESTION_THEME.filterBar.container, "p-4")}>
                    <h3 className={cn(GESTION_THEME.section.groupTitle, "mb-4")}>
                        Évolution du prix unitaire (€/kg)
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                tickFormatter={(v: string) =>
                                    new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
                                }
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                                tickFormatter={(v: number) => `${v} €`}
                                width={52}
                            />
                            <Tooltip
                                {...RECHARTS_TOOLTIP_THEME}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                formatter={(value: any) => `${value} €/kg`}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                labelFormatter={(label: any) =>
                                    typeof label === "string"
                                        ? new Date(label).toLocaleDateString("fr-FR", {
                                              weekday: "short", day: "2-digit",
                                              month: "long", year: "numeric",
                                          })
                                        : String(label)
                                }
                            />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            {chartCategories.map((name, i) => (
                                <Line
                                    key={name}
                                    type="stepAfter"
                                    dataKey={name}
                                    stroke={LINE_COLORS[i % LINE_COLORS.length]}
                                    strokeWidth={2}
                                    dot={{ r: 4, strokeWidth: 2, fill: "hsl(var(--card))" }}
                                    activeDot={{ r: 6 }}
                                    connectNulls
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    )
}
