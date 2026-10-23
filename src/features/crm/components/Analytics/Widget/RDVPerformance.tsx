import { motion } from "framer-motion"
import {
    useAnalytics,
    CHART_COLORS,
    EVENT_TYPE_LABELS,
} from "../../../context/AnalyticsContext"
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
import { CalendarDays } from "lucide-react"
import { cn } from "@/shared/lib/utils"

export function WidgetRdvPerformance() {
    const { rdvEvolutionData, hiddenEventLines, toggleEventLine } =
        useAnalytics()

    const chartData = rdvEvolutionData.data

    return (
        <motion.div
            key="w-rdv"
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
                            Génération de Rendez-vous
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            Volume de RDV générés (triés par date de création)
                        </p>
                    </div>
                    <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                        <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
                    <button
                        onClick={() => toggleEventLine("Total")}
                        className={cn(
                            "px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-semibold border transition-[opacity,color,background-color,border-color]",
                            hiddenEventLines.includes("Total")
                                ? "opacity-40 bg-muted text-muted-foreground"
                                : "bg-primary text-primary-foreground border-primary"
                        )}
                    >
                        Total RDV créés{" "}
                        <span className="opacity-75">
                            ({rdvEvolutionData.totals.Total || 0})
                        </span>
                    </button>
                    {rdvEvolutionData.eventTypes.map((t: string, i: number) => (
                        <button
                            key={t}
                            onClick={() => toggleEventLine(t)}
                            className="px-2.5 py-1 rounded-md text-[10px] sm:text-xs font-semibold border transition-colors flex gap-1"
                            style={{
                                color: !hiddenEventLines.includes(t)
                                    ? CHART_COLORS[i % CHART_COLORS.length]
                                    : "hsl(var(--muted-foreground))",
                                borderColor: !hiddenEventLines.includes(t)
                                    ? CHART_COLORS[i % CHART_COLORS.length]
                                    : "hsl(var(--border))",
                                backgroundColor: !hiddenEventLines.includes(t)
                                    ? `${CHART_COLORS[i % CHART_COLORS.length]}10`
                                    : "transparent",
                                opacity: hiddenEventLines.includes(t) ? 0.5 : 1,
                            }}
                        >
                            {EVENT_TYPE_LABELS[t] || t}{" "}
                            <span className="opacity-70">
                                ({rdvEvolutionData.totals[t] || 0})
                            </span>
                        </button>
                    ))}
                </div>
                <div className="w-full mt-2">
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
                            {!hiddenEventLines.includes("Total") && (
                                <Line
                                    type="monotone"
                                    dataKey="Total"
                                    name="Total RDV générés"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={3}
                                    dot={{ r: 3 }}
                                    connectNulls={true}
                                />
                            )}
                            {rdvEvolutionData.eventTypes.map(
                                (t: string, i: number) =>
                                    !hiddenEventLines.includes(t) && (
                                        <Line
                                            key={t}
                                            type="monotone"
                                            dataKey={t}
                                            name={EVENT_TYPE_LABELS[t] || t}
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
                </div>

                {/* Tableau récapitulatif RDV par jour */}
                {chartData.length > 0 && (
                    <div className="mt-4 border-t border-border/40 pt-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                            RDV trouvés par jour
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {chartData.map((d) => (
                                <div
                                    key={d.timestamp}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/40 text-xs"
                                >
                                    <span className="text-muted-foreground">
                                        {d.displayDate}
                                    </span>
                                    <span className="font-bold text-foreground tabular-nums">
                                        {d.Total}
                                    </span>
                                </div>
                            ))}
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-xs ml-auto">
                                <span className="text-muted-foreground">Total</span>
                                <span className="font-bold text-primary tabular-nums">
                                    {rdvEvolutionData.totals.Total || 0}
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </Card>
        </motion.div>
    )
}
