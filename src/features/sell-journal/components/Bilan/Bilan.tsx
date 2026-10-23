import { Input } from "@/shared/ui/atoms/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import type { JournalEntry } from "@/features/journal/hooks/Journal_hook/useJournalEntry"
import { useMemo, useState } from "react"

import { SearchX } from "lucide-react"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { staggerStyle } from "@/shared/lib/motion"
import { BilanCard } from "./BilanCard"
import { BilanDialog } from "./BilanDialog"
import { useSellJournalContext } from "@/features/sell-journal/context/SellJournalContext"

// types

type Period = "day" | "week" | "month" | "quarter" | "year"
type ServiceFilter = "all" | "Grossiste" | "Handpick"
type CommercialFilter = "all" | string

type BilanType = {
    key: string
    total: number
    entries: JournalEntry[]
}

// helpers

function getWeekNumber(date: Date) {
    const d = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    )
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function isInRange(date: string, start?: string, end?: string) {
    if (!start) return true
    const d = new Date(date).getTime()
    const s = new Date(start).getTime()
    const e = end ? new Date(end).getTime() : s
    return d >= s && d <= e
}

export function Bilan() {
    const { entries } = useSellJournalContext()

    const [period, setPeriod] = useState<Period>("day")
    const [service, setService] = useState<ServiceFilter>("all")
    const [commercial, setCommercial] = useState<CommercialFilter>("all")
    const [dateStart, setDateStart] = useState("")
    const [dateEnd, setDateEnd] = useState("")
    const [activeBilan, setActiveBilan] = useState<BilanType | null>(null)

    const commercialOptions = useMemo(() => {
        return Array.from(
            new Set(entries.map((e) => e.commercial).filter(Boolean))
        ).sort()
    }, [entries])

    const grouped = useMemo(() => {
        const map = new Map<string, JournalEntry[]>()

        entries
            .filter((e) => service === "all" || e.service === service)
            .filter((e) => commercial === "all" || e.commercial === commercial)
            .filter((e) => isInRange(e.sell_at, dateStart, dateEnd))
            .forEach((e) => {
                const d = new Date(e.sell_at)
                let key = ""

                switch (period) {
                    case "day":
                        key = d.toISOString().slice(0, 10)
                        break
                    case "week":
                        key = `Semaine ${getWeekNumber(d)} — ${d.getFullYear()}`
                        break
                    case "month":
                        key = d.toLocaleDateString("fr-FR", {
                            month: "long",
                            year: "numeric",
                        })
                        break
                    case "quarter":
                        key = `T${
                            Math.floor(d.getMonth() / 3) + 1
                        } — ${d.getFullYear()}`
                        break
                    case "year":
                        key = `${d.getFullYear()}`
                        break
                }

                if (!map.has(key)) map.set(key, [])
                map.get(key)!.push(e)
            })

        return Array.from(map.entries()).map(([key, values]) => ({
            key,
            entries: values,
            total: values.reduce((sum, e) => sum + Number(e.sales), 0),
        }))
    }, [entries, period, service, commercial, dateStart, dateEnd])

    return (
        <div className="space-y-8">
            {/* Filtres */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 p-4 border rounded-xl bg-muted/30">
                <Select
                    value={period}
                    onValueChange={(v) => setPeriod(v as Period)}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="day">Jour</SelectItem>
                        <SelectItem value="week">Semaine</SelectItem>
                        <SelectItem value="month">Mois</SelectItem>
                        <SelectItem value="quarter">Trimestre</SelectItem>
                        <SelectItem value="year">Année</SelectItem>
                    </SelectContent>
                </Select>

                <Select
                    value={service}
                    onValueChange={(v) => setService(v as ServiceFilter)}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tous services</SelectItem>
                        <SelectItem value="Grossiste">Grossiste</SelectItem>
                        <SelectItem value="Handpick">Handpick</SelectItem>
                    </SelectContent>
                </Select>

                <Select
                    value={commercial}
                    onValueChange={(v) => setCommercial(v)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Commercial" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Tous</SelectItem>
                        {commercialOptions.map((c) => (
                            <SelectItem key={c} value={c}>
                                {c}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Input
                    type="date"
                    value={dateStart}
                    onChange={(e) => {
                        setDateStart(e.target.value)
                        if (dateEnd && e.target.value > dateEnd) setDateEnd("")
                    }}
                />

                <Input
                    type="date"
                    value={dateEnd}
                    min={dateStart}
                    disabled={!dateStart}
                    onChange={(e) => setDateEnd(e.target.value)}
                />
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {grouped.map((b, i) => (
                    <div
                        key={b.key}
                        style={staggerStyle(i, { step: 40, cap: 320 })}
                        className="animate-in fade-in slide-in-from-bottom-3 fill-mode-backwards duration-slow ease-overshoot"
                    >
                        <BilanCard bilan={b} onClick={() => setActiveBilan(b)} />
                    </div>
                ))}
                {grouped.length === 0 && (
                    <EmptyState
                        className="col-span-full"
                        variant="search"
                        icon={SearchX}
                        title="Aucun bilan pour ces filtres"
                        description="Élargissez la période ou retirez un filtre pour voir des résultats."
                        secondaryAction={{
                            label: "Réinitialiser les filtres",
                            onClick: () => {
                                setService("all")
                                setCommercial("all")
                                setDateStart("")
                                setDateEnd("")
                            },
                        }}
                    />
                )}
            </div>

            <BilanDialog
                open={!!activeBilan}
                setOpen={() => setActiveBilan(null)}
                bilan={activeBilan}
            />
        </div>
    )
}
