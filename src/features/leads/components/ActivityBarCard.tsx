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

interface ActivityBarCardProps {
    data: Datum[]
    className?: string
    title?: string
}

const BAR_HEIGHT = 52 // px par barre
const CHART_MARGIN = 60 // espace pour XAxis + Legend

export function ActivityBarCard({
    data,
    className,
    title = "Répartition par Activité",
}: ActivityBarCardProps) {
    const chartHeight = Math.max(data.length * BAR_HEIGHT + CHART_MARGIN, 200)

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent style={{ height: chartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" barCategoryGap={16}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={140} />
                        <Tooltip {...RECHARTS_TOOLTIP_THEME} />
                        <Legend />
                        <Bar
                            dataKey="value"
                            fill="hsl(var(--chart-1))"
                            name="Nombre"
                            barSize={28}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}
