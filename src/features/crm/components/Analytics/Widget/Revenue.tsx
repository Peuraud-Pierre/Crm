import { motion } from "framer-motion"
import { useAnalytics, CHART_COLORS } from "../../../context/AnalyticsContext"
import {
    ResponsiveContainer,
    ComposedChart,
    Area,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
} from "recharts"
import { Card } from "@/shared/ui/atoms/card"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import { LineChartIcon } from "lucide-react"

export function WidgetRevenue() {
    const { revenueEvolutionData } = useAnalytics()

    return (
        <motion.div
            key="w-rev"
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
        >
            <Card className="p-4 sm:p-6 border-border/50 h-full min-h-[380px] flex flex-col">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <div>
                        <h3 className="text-base sm:text-lg font-bold">
                            Évolution du CA
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            Global:{" "}
                            {(
                                revenueEvolutionData.totals.revenue || 0
                            ).toLocaleString("fr-FR", {
                                style: "currency",
                                currency: "EUR",
                                maximumFractionDigits: 0,
                            })}
                        </p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded-lg shrink-0">
                        <LineChartIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                </div>
                <div className="w-full">
                    <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart
                            data={revenueEvolutionData.data}
                            margin={{ left: -25, right: 20, bottom: 20 }}
                        >
                            <defs>
                                <linearGradient
                                    id="colorRevenue"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="5%"
                                        stopColor="hsl(var(--primary))"
                                        stopOpacity={0.2}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor="hsl(var(--primary))"
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="displayDate"
                                className="text-[10px] sm:text-[11px]"
                                axisLine={false}
                                tickLine={false}
                                interval={
                                    revenueEvolutionData.data.length > 12
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
                                className="text-[10px] sm:text-[11px]"
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v) => `${v / 1000}k€`}
                            />
                            <Tooltip
                                {...RECHARTS_TOOLTIP_THEME}
                                formatter={(v, name) => [
                                    `${Number(v).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}`,
                                    name === "revenue" ? "CA Total" : String(name),
                                ] as [string, string]}
                            />
                            <Area
                                type="monotone"
                                dataKey="revenue"
                                name="revenue"
                                stroke="hsl(var(--primary))"
                                strokeWidth={3}
                                strokeDasharray="4 4"
                                fill="url(#colorRevenue)"
                            />
                            {revenueEvolutionData.creators.map(
                                (c: string, i: number) => (
                                    <Line
                                        key={c}
                                        type="monotone"
                                        dataKey={c}
                                        name={c}
                                        stroke={
                                            CHART_COLORS[
                                                i % CHART_COLORS.length
                                            ]
                                        }
                                        strokeWidth={2}
                                        dot={{ r: 2 }}
                                    />
                                )
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </motion.div>
    )
}
