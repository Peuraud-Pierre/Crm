import { useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/atoms/card"
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend,
} from "recharts"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import type { Ticket } from "../types"

const COLORS = {
    ouvert: "hsl(var(--chart-2))",
    en_attente: "hsl(var(--warning))",
    clos: "hsl(var(--chart-8))",
}

export function StatusPieChart({ tickets }: { tickets: Ticket[] }) {
    const data = useMemo(() => {
        const counts = { ouvert: 0, en_attente: 0, clos: 0 }
        for (const t of tickets) {
            if (t.status === "ouvert") counts.ouvert++
            else if (t.status === "en_cours") counts.en_attente++
            else if (t.status === "résolu" || t.status === "clos") counts.clos++
        }
        return [
            { name: "Ouvert", value: counts.ouvert, key: "ouvert" as const },
            { name: "En attente", value: counts.en_attente, key: "en_attente" as const },
            { name: "Clos", value: counts.clos, key: "clos" as const },
        ]
    }, [tickets])

    const total = data.reduce((sum, d) => sum + d.value, 0)

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Répartition par statut</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
                <div className="h-[240px] sm:h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius="45%"
                                outerRadius="75%"
                                paddingAngle={2}
                                label={(entry) =>
                                    total > 0
                                        ? `${Math.round((entry.value / total) * 100)}%`
                                        : ""
                                }
                            >
                                {data.map((entry) => (
                                    <Cell key={entry.key} fill={COLORS[entry.key]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={RECHARTS_TOOLTIP_THEME.contentStyle}
                                labelStyle={RECHARTS_TOOLTIP_THEME.labelStyle}
                                itemStyle={RECHARTS_TOOLTIP_THEME.itemStyle}
                            />
                            <Legend verticalAlign="bottom" height={28} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
