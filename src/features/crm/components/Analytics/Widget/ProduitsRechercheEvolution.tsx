import { motion } from "framer-motion"
import { useAnalytics, CHART_COLORS } from "../../../context/AnalyticsContext"
import {
    ResponsiveContainer,
    LineChart,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
} from "recharts"
import { Card } from "@/shared/ui/atoms/card"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import { TrendingUp } from "lucide-react"
import { cn } from "@/shared/lib/utils"

export function WidgetProduitsRechercheEvolution() {
    const {
        produitsRechercheEvolutionData,
        hiddenProduitRechercheLines,
        toggleProduitRechercheLine,
    } = useAnalytics()

    const chartData = produitsRechercheEvolutionData.data

    return (
        <motion.div
            key="w-produits-recherche-evolution"
            layout
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="xl:col-span-2 w-full"
        >
            <Card className="p-4 sm:p-6 border-border/50 shadow-sm h-full flex flex-col min-h-[380px]">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-base sm:text-lg font-bold">
                            Évolution des produits recherchés
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            Volume de recherches produit, mois par mois
                        </p>
                    </div>
                    <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                        <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
                    <button
                        onClick={() => toggleProduitRechercheLine("Total")}
                        className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-semibold border transition-[opacity,color,background-color,border-color]",
                            hiddenProduitRechercheLines.includes("Total")
                                ? "opacity-40 bg-muted text-muted-foreground"
                                : "bg-primary text-primary-foreground border-primary"
                        )}
                    >
                        Total recherches{" "}
                        <span className="opacity-75">
                            ({produitsRechercheEvolutionData.totals.Total || 0})
                        </span>
                    </button>
                    {produitsRechercheEvolutionData.products.map(
                        (p: string, i: number) => (
                            <button
                                key={p}
                                onClick={() => toggleProduitRechercheLine(p)}
                                className="px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-semibold border transition-colors flex gap-1"
                                style={{
                                    color: !hiddenProduitRechercheLines.includes(
                                        p
                                    )
                                        ? CHART_COLORS[i % CHART_COLORS.length]
                                        : "hsl(var(--muted-foreground))",
                                    borderColor:
                                        !hiddenProduitRechercheLines.includes(
                                            p
                                        )
                                            ? CHART_COLORS[
                                                  i % CHART_COLORS.length
                                              ]
                                            : "hsl(var(--border))",
                                    backgroundColor:
                                        !hiddenProduitRechercheLines.includes(
                                            p
                                        )
                                            ? `${CHART_COLORS[i % CHART_COLORS.length]}10`
                                            : "transparent",
                                    opacity:
                                        hiddenProduitRechercheLines.includes(p)
                                            ? 0.5
                                            : 1,
                                }}
                            >
                                {p}{" "}
                                <span className="opacity-70">
                                    (
                                    {produitsRechercheEvolutionData.totals[
                                        p
                                    ] || 0}
                                    )
                                </span>
                            </button>
                        )
                    )}
                </div>
                <div className="w-full mt-2">
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart
                                data={chartData}
                                margin={{
                                    top: 10,
                                    right: 20,
                                    left: -25,
                                    bottom: 20,
                                }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke="hsl(var(--border))"
                                />
                                <XAxis
                                    dataKey="displayDate"
                                    className="text-[10px]"
                                    axisLine={false}
                                    tickLine={false}
                                    interval={
                                        chartData.length > 12
                                            ? "preserveStartEnd"
                                            : 0
                                    }
                                    angle={-30}
                                    textAnchor="end"
                                    height={45}
                                    tickMargin={8}
                                    padding={{ left: 12, right: 12 }}
                                />
                                <YAxis
                                    className="text-[10px]"
                                    axisLine={false}
                                    tickLine={false}
                                    allowDecimals={false}
                                />
                                <Tooltip {...RECHARTS_TOOLTIP_THEME} />
                                {!hiddenProduitRechercheLines.includes(
                                    "Total"
                                ) && (
                                    <Line
                                        type="monotone"
                                        dataKey="Total"
                                        name="Total recherches"
                                        stroke="hsl(var(--primary))"
                                        strokeWidth={3}
                                        dot={{ r: 3 }}
                                        connectNulls={true}
                                    />
                                )}
                                {produitsRechercheEvolutionData.products.map(
                                    (p: string, i: number) =>
                                        !hiddenProduitRechercheLines.includes(
                                            p
                                        ) && (
                                            <Line
                                                key={p}
                                                type="monotone"
                                                dataKey={p}
                                                name={p}
                                                stroke={
                                                    CHART_COLORS[
                                                        i % CHART_COLORS.length
                                                    ]
                                                }
                                                strokeWidth={2}
                                                strokeDasharray="4 4"
                                                dot={{ r: 2 }}
                                                connectNulls={true}
                                            />
                                        )
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm italic">
                            Aucune donnée pour cette période
                        </div>
                    )}
                </div>
            </Card>
        </motion.div>
    )
}
