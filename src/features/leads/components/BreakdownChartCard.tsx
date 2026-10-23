import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/atoms/toggle-group"
import { useMemo, useState } from "react"
import { RECHARTS_TOOLTIP_THEME } from "@/shared/lib/rechartsTooltip"
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"

type BreakdownMetric = "activity" | "location"

type BreakdownChartType = "bar" | "pie"

type Datum = { name: string; value: number }

const PIE_COLORS: string[] = [
    "hsl(var(--primary))",
    "hsl(var(--warning))",
    "hsl(var(--success))",
    "hsl(var(--destructive))",
    "hsl(var(--viso))",
    "hsl(var(--ring))",
    "hsl(var(--accent))",
    "hsl(var(--muted-foreground))",
    // If there are more slices than base colors, reuse hues with different opacity.
    "hsl(var(--primary) / 0.65)",
    "hsl(var(--warning) / 0.65)",
    "hsl(var(--success) / 0.65)",
    "hsl(var(--destructive) / 0.65)",
    "hsl(var(--viso) / 0.65)",
    "hsl(var(--ring) / 0.65)",
    "hsl(var(--accent) / 0.65)",
    "hsl(var(--muted-foreground) / 0.65)",
]

interface BreakdownChartCardProps {
    className?: string
    activityData: Datum[]
    locationData: Datum[]
    defaultMetric?: BreakdownMetric
    defaultChartType?: BreakdownChartType
}

export function BreakdownChartCard({
    className,
    activityData,
    locationData,
    defaultMetric = "activity",
    defaultChartType = "bar",
}: BreakdownChartCardProps) {
    const [breakdownMetric, setBreakdownMetric] =
        useState<BreakdownMetric>(defaultMetric)
    const [breakdownChartType, setBreakdownChartType] =
        useState<BreakdownChartType>(defaultChartType)

    const breakdownTitle =
        breakdownMetric === "activity"
            ? "Répartition par Activité"
            : "Répartition par Localisation"

    const breakdownData = useMemo(() => {
        const raw =
            breakdownMetric === "activity" ? activityData : locationData
        return raw.map((d, i) => ({
            ...d,
            fill: PIE_COLORS[i % PIE_COLORS.length],
        }))
    }, [activityData, breakdownMetric, locationData])

    return (
        <Card className={className}>
            <CardHeader className="flex flex-col gap-3">
                <CardTitle>{breakdownTitle}</CardTitle>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
                    <Select
                        value={breakdownMetric}
                        onValueChange={(v) =>
                            setBreakdownMetric(v as BreakdownMetric)
                        }
                    >
                        <SelectTrigger className="w-full sm:w-56">
                            <SelectValue placeholder="Choisir une statistique" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="activity">
                                Répartition par Activité
                            </SelectItem>
                            <SelectItem value="location">
                                Répartition par Localisation
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    <ToggleGroup
                        type="single"
                        value={breakdownChartType}
                        onValueChange={(v) => {
                            if (v === "bar" || v === "pie") {
                                setBreakdownChartType(v)
                            }
                        }}
                        className="justify-start"
                    >
                        <ToggleGroupItem value="bar">Barres</ToggleGroupItem>
                        <ToggleGroupItem value="pie">Camembert</ToggleGroupItem>
                    </ToggleGroup>
                </div>
            </CardHeader>

            <CardContent className="h-75">
                {breakdownData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Aucune donnée
                    </div>
                ) : breakdownChartType === "pie" ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Tooltip {...RECHARTS_TOOLTIP_THEME} />
                            <Legend />
                            <Pie
                                data={breakdownData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={breakdownData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis
                                dataKey="name"
                                type="category"
                                width={120}
                                tick={{ fontSize: 12 }}
                            />
                            <Tooltip {...RECHARTS_TOOLTIP_THEME} />
                            <Bar
                                dataKey="value"
                                fill="hsl(var(--chart-4))"
                                name="Nombre"
                                radius={[0, 4, 4, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    )
}
