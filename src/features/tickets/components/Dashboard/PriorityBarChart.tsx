import { useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/atoms/card"
import {
    BarChart,
    Bar,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import type { Ticket, TicketPriority } from "../types"

const PRIORITY_ORDER: { id: TicketPriority; label: string; color: string }[] = [
    { id: "nouveau", label: "Nouveau", color: "hsl(var(--chart-4))" },
    { id: "urgente", label: "Urgente", color: "hsl(var(--destructive))" },
    { id: "haute", label: "Haute", color: "hsl(var(--chart-3))" },
    { id: "moyenne", label: "Moyenne", color: "hsl(var(--chart-2))" },
    { id: "basse", label: "Basse", color: "hsl(var(--chart-8))" },
]

export function PriorityBarChart({ tickets }: { tickets: Ticket[] }) {
    const data = useMemo(() => {
        const counts: Record<TicketPriority, number> = {
            nouveau: 0,
            urgente: 0,
            haute: 0,
            moyenne: 0,
            basse: 0,
        }
        for (const t of tickets) {
            if (t.priority && counts[t.priority] !== undefined) counts[t.priority]++
        }
        return PRIORITY_ORDER.map((p) => ({
            name: p.label,
            value: counts[p.id],
            color: p.color,
        }))
    }, [tickets])

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Tickets par priorité</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
                <div className="h-[240px] sm:h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                                interval={0}
                            />
                            <YAxis
                                allowDecimals={false}
                                tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                            />
                            <Tooltip
                                contentStyle={RECHARTS_TOOLTIP_THEME.contentStyle}
                                labelStyle={RECHARTS_TOOLTIP_THEME.labelStyle}
                                itemStyle={RECHARTS_TOOLTIP_THEME.itemStyle}
                                cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                            />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                                {data.map((entry) => (
                                    <Cell key={entry.name} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
