import { useMemo } from "react"
import { motion } from "framer-motion"
import { useAnalytics, CHART_COLORS } from "../../../context/AnalyticsContext"
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
} from "recharts"
import { Card } from "@/shared/ui/atoms/card"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import { ListTodo } from "lucide-react"

// Au-delà de ce nombre de barres le graphe devient illisible : on garde les
// plus gros types et on agrège la longue traîne dans une barre « Autres ».
const MAX_BARS = 9

export function WidgetActivitesByType() {
    const { activitesByTypeData } = useAnalytics()

    // Les données arrivent triées par count décroissant (cf. contexte).
    const chartData = useMemo(() => {
        const data: { name: string; count: number }[] =
            activitesByTypeData.data || []
        if (data.length <= MAX_BARS) return data
        const head = data.slice(0, MAX_BARS - 1)
        const rest = data.slice(MAX_BARS - 1)
        const othersCount = rest.reduce((acc, d) => acc + (d.count || 0), 0)
        return [
            ...head,
            { name: `Autres (${rest.length})`, count: othersCount },
        ]
    }, [activitesByTypeData.data])

    return (
        <motion.div
            key="w-act-t"
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
        >
            <Card className="p-4 sm:p-6 border-border/50 h-full min-h-[380px] flex flex-col">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h3 className="text-base sm:text-lg font-bold">
                            Activités par type
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            Total : {activitesByTypeData.total}
                        </p>
                    </div>
                    <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
                        <ListTodo className="h-5 w-5 text-emerald-600" />
                    </div>
                </div>
                <div className="w-full">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                            data={chartData}
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
                            <Bar
                                dataKey="count"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={50}
                            >
                                {chartData.map(
                                    (entry, i: number) => (
                                        <Cell
                                            key={entry.name}
                                            fill={
                                                CHART_COLORS[
                                                    i % CHART_COLORS.length
                                                ]
                                            }
                                        />
                                    )
                                )}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </motion.div>
    )
}
