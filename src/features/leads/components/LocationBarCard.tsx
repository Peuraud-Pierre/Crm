import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
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

type Datum = { name: string; value: number }

interface LocationBarCardProps {
    data: Datum[]
    className?: string
}

export function LocationBarCard({ data, className }: LocationBarCardProps) {
    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>Répartition par Localisation (Top 5)</CardTitle>
            </CardHeader>
            <CardContent className="h-75">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={100}
                            tick={{ fontSize: 12 }}
                        />
                        <Tooltip {...RECHARTS_TOOLTIP_THEME} />
                        <Legend />
                        <Bar
                            dataKey="value"
                            fill="hsl(var(--chart-4))"
                            name="Nombre"
                            radius={[0, 4, 4, 0]}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
