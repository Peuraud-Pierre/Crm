import { Card, CardContent } from "@/shared/ui/atoms/card"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import {
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"

interface TimelinePoint {
    period: string
    total: number
    count: number
}

export function StatsCharts({ data }: { data: TimelinePoint[] }) {
    const axisTick = {
        fill: "hsl(var(--muted-foreground))",
        fontSize: 12,
    }
    const axisLine = { stroke: "hsl(var(--border))" }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
                <CardContent className="p-6">
                    <h3 className="font-semibold mb-4">Évolution du CA</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={data}>
                            <CartesianGrid
                                stroke="hsl(var(--border))"
                                strokeDasharray="3 3"
                            />
                            <XAxis
                                dataKey="period"
                                tick={axisTick}
                                axisLine={axisLine}
                                tickLine={axisLine}
                            />
                            <YAxis
                                tick={axisTick}
                                axisLine={axisLine}
                                tickLine={axisLine}
                            />
                            <Tooltip {...RECHARTS_TOOLTIP_THEME} />
                            <Line
                                type="monotone"
                                dataKey="total"
                                strokeWidth={2}
                                stroke="hsl(var(--primary))"
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-6">
                    <h3 className="font-semibold mb-4">Volume de ventes</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data}>
                            <CartesianGrid
                                stroke="hsl(var(--border))"
                                strokeDasharray="3 3"
                            />
                            <XAxis
                                dataKey="period"
                                tick={axisTick}
                                axisLine={axisLine}
                                tickLine={axisLine}
                            />
                            <YAxis
                                tick={axisTick}
                                axisLine={axisLine}
                                tickLine={axisLine}
                            />
                            <Tooltip {...RECHARTS_TOOLTIP_THEME} />
                            <Bar
                                dataKey="count"
                                fill="hsl(var(--primary))"
                                radius={[6, 6, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    )
}
