import { motion } from "framer-motion"
import { useAnalytics, CHART_COLORS, EVENT_TYPE_LABELS } from "../../../context/AnalyticsContext"
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
} from "recharts"
import { Card } from "@/shared/ui/atoms/card"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import { BarChartIcon } from "lucide-react"

export function WidgetRdvByPerson() {
    const { rdvByPersonData } = useAnalytics()

    return (
        <motion.div
            key="w-rdv-p"
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
        >
            <Card className="p-4 sm:p-6 border-border/50 h-full min-h-[380px] flex flex-col">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h3 className="text-base sm:text-lg font-bold">
                            RDV par commercial
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            Répartition par type
                        </p>
                    </div>
                    <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                        <BarChartIcon className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                    </div>
                </div>
                <div className="w-full">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                            data={rdvByPersonData.data}
                            margin={{ left: 0, right: 10, bottom: 60 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="name"
                                className="text-[10px]"
                                interval={0}
                                angle={-35}
                                textAnchor="end"
                                height={70}
                                tickMargin={8}
                            />
                            <YAxis className="text-[10px]" />
                            <Tooltip {...RECHARTS_TOOLTIP_THEME} />
                            {rdvByPersonData.eventTypes.map(
                                (t: string, i: number) => (
                                    <Bar
                                        key={t}
                                        dataKey={t}
                                        name={EVENT_TYPE_LABELS[t] || t}
                                        stackId="a"
                                        fill={
                                            CHART_COLORS[
                                                i % CHART_COLORS.length
                                            ]
                                        }
                                        maxBarSize={50}
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
