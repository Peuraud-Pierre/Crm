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
import { MapPin } from "lucide-react"

// Au-delà de ce nombre de barres le graphe devient illisible : on garde les
// plus grosses origines et on agrège la longue traîne dans une barre « Autres ».
const MAX_BARS = 9

export function WidgetProvenance() {
    const { provenanceData } = useAnalytics()

    // provenanceData.data est trié par count décroissant (cf. contexte).
    const chartData = useMemo(() => {
        const data: { name: string; count: number }[] =
            provenanceData.data || []
        if (data.length <= MAX_BARS) return data
        const head = data.slice(0, MAX_BARS - 1)
        const rest = data.slice(MAX_BARS - 1)
        const othersCount = rest.reduce((acc, d) => acc + (d.count || 0), 0)
        return [
            ...head,
            { name: `Autres (${rest.length})`, count: othersCount },
        ]
    }, [provenanceData.data])

    return (
        <motion.div
            key="w-provenance"
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
        >
            <Card className="p-4 sm:p-6 border-border/50 h-full min-h-[380px] flex flex-col">
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h3 className="text-base sm:text-lg font-bold">
                            Origine des clients
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            Total analysé : {provenanceData.total}
                        </p>
                    </div>
                    <div className="p-2 bg-pink-500/10 rounded-lg shrink-0">
                        <MapPin className="h-5 w-5 text-pink-600" />
                    </div>
                </div>
                <div className="w-full">
                    {chartData.length > 0 ? (
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
                                    className="text-[10px] font-medium"
                                    interval={0}
                                    angle={-35}
                                    textAnchor="end"
                                    height={70}
                                    tickMargin={8}
                                />
                                <YAxis
                                    className="text-[10px]"
                                    allowDecimals={false}
                                />
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
