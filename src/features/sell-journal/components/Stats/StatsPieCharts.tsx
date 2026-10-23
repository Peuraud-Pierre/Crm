import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import {
    Cell,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
} from "recharts"
import { CHART_PALETTE } from "@/shared/lib/chartPalette"

const COLORS = CHART_PALETTE

interface PieDatum {
    name: string
    value: number
}

function PieBlock({
    title,
    data,
    unit,
}: {
    title: string
    data: PieDatum[]
    unit: string
}) {
    const legendTextColor = "hsl(var(--muted-foreground))"

    return (
        <Card className="rounded-2xl">
            <CardHeader>
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>

            <CardContent className="h-[300px]">
                {!data.length ? (
                    <p className="text-sm text-muted-foreground text-center pt-20">
                        Aucune donnée
                    </p>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={60}
                                outerRadius={100}
                            >
                                {data.map((d, i) => (
                                    <Cell
                                        key={d.name}
                                        fill={COLORS[i % COLORS.length]}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                {...RECHARTS_TOOLTIP_THEME}
                                formatter={(v) =>
                                    // Recharts type la valeur en ValueType
                                    // (string | number | Array) — nos données
                                    // sont numériques, on normalise via Number().
                                    `${Number(v).toLocaleString()} ${unit}`
                                }
                            />
                            <Legend
                                formatter={(value: string) => (
                                    <span style={{ color: legendTextColor }}>
                                        {value}
                                    </span>
                                )}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    )
}

export function StatsPieCharts({
    serviceData,
    commercialData,
    serviceFilter,
    period,
}: {
    serviceData: PieDatum[]
    commercialData: PieDatum[]
    serviceFilter: string
    period: string
}) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PieBlock
                title={
                    serviceFilter === "all"
                        ? `Répartition des ventes par service (${period})`
                        : `CA par commercial (${serviceFilter} — ${period})`
                }
                data={serviceData}
                unit={serviceFilter === "all" ? "ventes" : "€"}
            />

            <PieBlock
                title={`Répartition des ventes par commercial (${period})`}
                data={commercialData}
                unit="ventes"
            />
        </div>
    )
}
