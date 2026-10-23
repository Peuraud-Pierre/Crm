import { BarChart3 } from "lucide-react"
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { formatDayLabel } from "@/features/arrivage-admin/utils/format"
import type { DailyPoint } from "@/features/arrivage-admin/types"

// Réussite/échec sont sémantiques : on prend les tokens --success/--destructive
// plutôt que la palette catégorielle (voir shared/lib/chartPalette.ts).
const SENT_COLOR = "hsl(var(--success))"
const FAILED_COLOR = "hsl(var(--destructive))"

const tooltipStyle = {
    contentStyle: {
        backgroundColor: "hsl(var(--popover))",
        border: "1px solid hsl(var(--border))",
        color: "hsl(var(--popover-foreground))",
    },
    labelStyle: { color: "hsl(var(--popover-foreground))" },
    itemStyle: { color: "hsl(var(--popover-foreground))" },
}

interface SendHealthChartProps {
    daily: DailyPoint[]
    loading: boolean
}

/** Envois réussis vs échoués par jour, en barres empilées. */
export function SendHealthChart({ daily, loading }: SendHealthChartProps) {
    const hasData = daily.some(d => d.sent > 0 || d.failed > 0)

    const data = daily.map(d => ({
        ...d,
        label: formatDayLabel(d.date),
    }))

    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>Envois par jour</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
                {loading ? (
                    <div className="p-4 sm:p-0">
                        <Skeleton className="h-64 w-full rounded-lg" />
                    </div>
                ) : !hasData ? (
                    <EmptyState
                        icon={BarChart3}
                        title="Aucun envoi sur la période"
                        description="Les envois apparaîtront ici dès qu'une diffusion aura été effectuée."
                    />
                ) : (
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="hsl(var(--border))"
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="label"
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    // Sur 90 jours, un tick sur cinq suffit à
                                    // situer la période sans se chevaucher.
                                    interval="preserveStartEnd"
                                    minTickGap={24}
                                />
                                <YAxis
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    allowDecimals={false}
                                    width={32}
                                />
                                <Tooltip
                                    {...tooltipStyle}
                                    cursor={{ fill: "hsl(var(--muted))" }}
                                />
                                <Legend />
                                <Bar
                                    dataKey="sent"
                                    name="Réussis"
                                    stackId="sends"
                                    fill={SENT_COLOR}
                                    radius={[0, 0, 0, 0]}
                                />
                                <Bar
                                    dataKey="failed"
                                    name="Échoués"
                                    stackId="sends"
                                    fill={FAILED_COLOR}
                                    radius={[4, 4, 0, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
