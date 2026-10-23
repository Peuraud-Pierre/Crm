import { useMemo } from "react"
import { format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"
import {
    Area,
    AreaChart,
    CartesianGrid,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import { chartColor } from "@/shared/lib/chartPalette"
import type { WikiStatsPoint } from "../../types/wiki-analytics.types"

/**
 * Évolution des consultations. Les lecteurs uniques sont superposés en ligne :
 * l'écart entre les deux courbes dit si l'usage vient de quelques personnes
 * très actives ou d'une audience large.
 */
export function WikiStatsTimeseries({ data }: { data: WikiStatsPoint[] }) {
    const points = useMemo(
        () =>
            data.map((p) => ({
                ...p,
                label: format(parseISO(p.day), "d MMM", { locale: fr }),
            })),
        [data]
    )

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium">
                    Consultations dans le temps
                </CardTitle>
            </CardHeader>
            <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={points}
                        margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
                    >
                        <defs>
                            <linearGradient
                                id="wikiViewsFill"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="0%"
                                    stopColor={chartColor(0)}
                                    stopOpacity={0.35}
                                />
                                <stop
                                    offset="100%"
                                    stopColor={chartColor(0)}
                                    stopOpacity={0.02}
                                />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            fontSize={11}
                            minTickGap={24}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            fontSize={11}
                            allowDecimals={false}
                        />
                        <Tooltip {...RECHARTS_TOOLTIP_THEME} />
                        <Legend iconType="plainline" />
                        <Area
                            type="monotone"
                            dataKey="views"
                            name="Consultations"
                            stroke={chartColor(0)}
                            fill="url(#wikiViewsFill)"
                            strokeWidth={2}
                        />
                        <Line
                            type="monotone"
                            dataKey="unique_readers"
                            name="Lecteurs uniques"
                            stroke={chartColor(1)}
                            strokeWidth={2}
                            dot={false}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
