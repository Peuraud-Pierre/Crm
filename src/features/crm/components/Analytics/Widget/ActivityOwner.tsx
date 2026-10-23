import { motion } from "framer-motion"
import { useAnalytics, CHART_COLORS } from "../../../context/AnalyticsContext"
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
} from "recharts"
import { Card } from "@/shared/ui/atoms/card"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import { Users } from "lucide-react"

export function WidgetActivitesByOwner() {
    const { activitesByOwnerData } = useAnalytics()

    return (
        <motion.div
            key="w-act-o"
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
        >
            <Card className="p-4 sm:p-6 border-border/50 shadow-sm h-full flex flex-col min-h-[380px]">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h3 className="text-base sm:text-lg font-bold tracking-tight">
                            Actions par collaborateur
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                            Répartition des types d'activités
                        </p>
                    </div>
                    <div className="p-2 bg-orange-500/10 rounded-lg shrink-0">
                        <Users className="h-5 w-5 text-orange-600" />
                    </div>
                </div>
                <div className="w-full">
                    <ResponsiveContainer width="100%" height={340}>
                        <BarChart
                            data={activitesByOwnerData.data}
                            margin={{ left: 0, right: 10, bottom: 60 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke="hsl(var(--border))"
                            />
                            <XAxis
                                dataKey="name"
                                className="text-[10px] font-medium"
                                interval={0}
                                angle={-35}
                                textAnchor="end"
                                height={70}
                                tickMargin={8}
                            />
                            <YAxis className="text-[10px]" />
                            <Tooltip {...RECHARTS_TOOLTIP_THEME} />
                            <Legend
                                iconType="circle"
                                verticalAlign="bottom"
                                wrapperStyle={{
                                    fontSize: "11px",
                                    // Abaissé sous les labels inclinés de l'axe X
                                    // (qui occupent ~70px) pour ne pas les chevaucher.
                                    bottom: 0,
                                    paddingTop: "12px",
                                }}
                            />
                            {activitesByOwnerData.types.map(
                                (t: string, i: number) => (
                                    <Bar
                                        key={t}
                                        dataKey={t}
                                        stackId="a"
                                        fill={
                                            CHART_COLORS[
                                                i % CHART_COLORS.length
                                            ]
                                        }
                                        maxBarSize={45}
                                    />
                                )
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </motion.div>
    )
}
