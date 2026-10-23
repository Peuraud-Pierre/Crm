import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { format } from "date-fns"

interface SummaryCardsProps {
    totalLeads: number
    leadsYesterday: number
    yesterday: Date
    leadsToday: number
    trendVsYesterday: number | null
    avgPerDay: number
}

export function SummaryCards({
    totalLeads,
    leadsYesterday,
    yesterday,
    leadsToday,
    trendVsYesterday,
    avgPerDay,
}: SummaryCardsProps) {
    const trendColor =
        trendVsYesterday === null
            ? "text-muted-foreground"
            : trendVsYesterday > 0
            ? "text-green-500"
            : trendVsYesterday < 0
            ? "text-red-500"
            : "text-muted-foreground"

    const trendLabel =
        trendVsYesterday === null
            ? "Pas de données hier"
            : trendVsYesterday > 0
            ? `+${trendVsYesterday}% vs hier`
            : trendVsYesterday < 0
            ? `${trendVsYesterday}% vs hier`
            : "= vs hier"

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Total Leads
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalLeads}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Inscrits Hier
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{leadsYesterday}</div>
                    <p className="text-xs text-muted-foreground">
                        {format(yesterday, "dd/MM/yyyy")}
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Inscrits Aujourd'hui
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{leadsToday}</div>
                    <p className={`text-xs font-medium ${trendColor}`}>
                        {trendLabel}
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Moyenne / jour
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{avgPerDay}</div>
                    <p className="text-xs text-muted-foreground">
                        sur la période sélectionnée
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
