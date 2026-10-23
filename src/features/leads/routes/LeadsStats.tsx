import { useEffect, useMemo, useState } from "react"
import {
    ActivityBarCard,
    BreakdownChartCard,
    LocationBarCard,
    MessagesCard,
    normalizeActivity,
    normalizeBudget,
    normalizeUrgency,
    URGENCY_ORDER,
    SummaryCards,
    TimeRangeSelector,
} from "@/features/leads/components"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { fetchLeadsSince } from "@/features/leads/services/leadsService"
import {
    differenceInDays,
    eachDayOfInterval,
    eachMonthOfInterval,
    format,
    isSameDay,
    parseISO,
    startOfMonth,
    subDays,
    subMonths,
} from "date-fns"
import { fr } from "date-fns/locale"
import { Loader2 } from "lucide-react"
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"

import type { Lead, LeadsTimeRange } from "@/features/leads/components"

const tooltipStyle = {
    contentStyle: {
        backgroundColor: "hsl(var(--popover))",
        border: "1px solid hsl(var(--border))",
        color: "hsl(var(--popover-foreground))",
    },
    labelStyle: { color: "hsl(var(--popover-foreground))" },
    itemStyle: { color: "hsl(var(--popover-foreground))" },
}

const LeadsStats = () => {
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [timeRange, setTimeRange] = useState<LeadsTimeRange>("30days")

    const now = useMemo(() => new Date(), [])
    // On prend le max entre le timeRange et 2 jours pour toujours avoir "hier"
    const fetchFrom = useMemo(() => {
        const rangeStart =
            timeRange === "week"
                ? subDays(now, 6)
                : timeRange === "30days"
                  ? subDays(now, 29)
                  : timeRange === "month"
                    ? startOfMonth(now)
                    : subMonths(now, 11)

        const yesterday = subDays(now, 1)
        return rangeStart < yesterday ? rangeStart : subDays(now, 1)
    }, [timeRange, now])

    useEffect(() => {
        const fetchLeads = async () => {
            setSelectedDate(null)
            setLoading(true)
            try {
                const { data, error } = await fetchLeadsSince(
                    fetchFrom.toISOString()
                )

                if (error) {
                    console.error("Error fetching leads:", error)
                } else {
                    setLeads(data || [])
                }
            } catch (error) {
                console.error("Unexpected error:", error)
            } finally {
                setLoading(false)
            }
        }

        fetchLeads()
    }, [fetchFrom])

    const yesterday = useMemo(() => subDays(now, 1), [now])

    const leadsYesterday = useMemo(
        () =>
            leads.filter((lead) =>
                isSameDay(parseISO(lead.created_at), yesterday)
            ).length,
        [leads, yesterday]
    )

    const leadsToday = useMemo(
        () =>
            leads.filter((lead) => isSameDay(parseISO(lead.created_at), now))
                .length,
        [leads, now]
    )

    const trendVsYesterday = useMemo(() => {
        if (leadsYesterday === 0) return null
        return Math.round(
            ((leadsToday - leadsYesterday) / leadsYesterday) * 100
        )
    }, [leadsToday, leadsYesterday])

    const leadsInTimeRange = useMemo(
        () =>
            leads.filter((lead) => {
                const createdAt = parseISO(lead.created_at)
                return createdAt >= fetchFrom && createdAt <= now
            }),
        [leads, fetchFrom, now]
    )

    const avgPerDay = useMemo(() => {
        const days = Math.max(differenceInDays(now, fetchFrom) + 1, 1)
        return Math.round((leadsInTimeRange.length / days) * 10) / 10
    }, [leadsInTimeRange.length, fetchFrom, now])

    const filteredLeads = useMemo(
        () =>
            selectedDate
                ? leadsInTimeRange.filter(
                      (lead) =>
                          format(parseISO(lead.created_at), "yyyy-MM-dd") ===
                          selectedDate
                  )
                : leadsInTimeRange,
        [leadsInTimeRange, selectedDate]
    )

    const locationData = useMemo(() => {
        const stats = filteredLeads.reduce(
            (acc, lead) => {
                const loc = lead.location || "Inconnu"
                acc[loc] = (acc[loc] || 0) + 1
                return acc
            },
            {} as Record<string, number>
        )

        const sorted = Object.entries(stats).sort(([, a], [, b]) => b - a)
        const top5 = sorted
            .slice(0, 5)
            .map(([name, value]) => ({ name, value }))

        if (sorted.length > 5) {
            const otherCount = sorted
                .slice(5)
                .reduce((acc, [, value]) => acc + value, 0)
            top5.push({ name: "Autres", value: otherCount })
        }

        return top5
    }, [filteredLeads])

    const activityData = useMemo(() => {
        const stats = filteredLeads.reduce(
            (acc, lead) => {
                const activity = normalizeActivity(lead.activity)
                acc[activity] = (acc[activity] || 0) + 1
                return acc
            },
            {} as Record<string, number>
        )

        return Object.entries(stats).map(([name, value]) => ({ name, value }))
    }, [filteredLeads])

    const urgencyData = useMemo(() => {
        const stats = filteredLeads.reduce(
            (acc, lead) => {
                // Le formulaire existe en FR et en EN : « Sans urgence » et
                // « No urgency » désignent le même niveau et doivent s'additionner.
                const urgency = normalizeUrgency(lead.urgency)
                acc[urgency] = (acc[urgency] || 0) + 1
                return acc
            },
            {} as Record<string, number>
        )

        // Échelle ordinale : on classe du plus pressé au moins pressé plutôt
        // que par volume, sinon le graphique ne se lit pas comme une échelle.
        // Une valeur hors registre passe en fin de liste, par ordre alphabétique.
        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => {
                const ai = URGENCY_ORDER.indexOf(a.name)
                const bi = URGENCY_ORDER.indexOf(b.name)
                if (ai !== -1 && bi !== -1) return ai - bi
                if (ai !== -1) return -1
                if (bi !== -1) return 1
                return a.name.localeCompare(b.name)
            })
    }, [filteredLeads])

    const chartData = useMemo(() => {
        const isYearly = timeRange === "year"

        const labels = isYearly
            ? eachMonthOfInterval({ start: fetchFrom, end: now }).map((d) =>
                  format(d, "yyyy-MM")
              )
            : eachDayOfInterval({ start: fetchFrom, end: now }).map((d) =>
                  format(d, "yyyy-MM-dd")
              )

        const dataMap = leadsInTimeRange.reduce(
            (acc, lead) => {
                const key = format(
                    parseISO(lead.created_at),
                    isYearly ? "yyyy-MM" : "yyyy-MM-dd"
                )
                acc[key] = (acc[key] || 0) + 1
                return acc
            },
            {} as Record<string, number>
        )

        return labels.map((label) => ({
            date: label,
            count: dataMap[label] || 0,
            displayDate: isYearly
                ? format(parseISO(label + "-01"), "MMM yyyy", { locale: fr })
                : format(parseISO(label), "dd MMM", { locale: fr }),
        }))
    }, [leadsInTimeRange, timeRange, fetchFrom, now])

    const filteredMessages = useMemo(() => {
        if (!searchQuery) return filteredLeads
        const q = searchQuery.toLowerCase()
        return filteredLeads.filter(
            (lead) =>
                lead.name.toLowerCase().includes(q) ||
                lead.email.toLowerCase().includes(q) ||
                lead.message.toLowerCase().includes(q)
        )
    }, [filteredLeads, searchQuery])

    const chartTitle =
        timeRange === "week"
            ? "7 derniers jours"
            : timeRange === "30days"
              ? "30 derniers jours"
              : timeRange === "month"
                ? "Ce mois"
                : "Cette année"

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    return (
        <div className="p-8 space-y-8">
            <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center md:justify-end">
                <TimeRangeSelector
                    timeRange={timeRange}
                    onTimeRangeChange={setTimeRange}
                    selectedDate={selectedDate}
                    onResetSelectedDate={() => setSelectedDate(null)}
                />
            </div>
            <SummaryCards
                totalLeads={filteredLeads.length}
                leadsYesterday={leadsYesterday}
                yesterday={yesterday}
                leadsToday={leadsToday}
                trendVsYesterday={trendVsYesterday}
                avgPerDay={avgPerDay}
            />
            <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
                <Card className="col-span-1 md:col-span-2 overflow-hidden">
                    <CardHeader>
                        <CardTitle>Inscriptions ({chartTitle})</CardTitle>
                    </CardHeader>
                    <CardContent className="h-75">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={chartData}
                                onClick={(data) => {
                                    const d = data as {
                                        activePayload?: {
                                            payload: { date: string }
                                        }[]
                                    } | null
                                    if (d?.activePayload?.length) {
                                        setSelectedDate(
                                            d.activePayload[0].payload.date
                                        )
                                    }
                                }}
                                style={{ cursor: "pointer" }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="displayDate" />
                                <YAxis />
                                <Tooltip {...tooltipStyle} />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="count"
                                    stroke="hsl(var(--chart-4))"
                                    name="Inscriptions"
                                    activeDot={{ r: 8 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <LocationBarCard
                    className="col-span-1"
                    data={locationData}
                />
                <ActivityBarCard
                    className="col-span-1"
                    data={activityData}
                />
                <ActivityBarCard
                    className="col-span-1"
                    title="Répartition par niveau d'urgence"
                    data={urgencyData}
                />
                <BreakdownChartCard
                    className="col-span-1"
                    activityData={activityData}
                    locationData={locationData}
                />
                <MessagesCard
                    leads={filteredMessages}
                    searchQuery={searchQuery}
                    onSearchQueryChange={setSearchQuery}
                    normalizeActivity={normalizeActivity}
                    normalizeBudget={normalizeBudget}
                />
            </div>
        </div>
    )
}

export default LeadsStats
