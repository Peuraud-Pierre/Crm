import { useMemo, useState } from "react"
import { Input } from "@/shared/ui/atoms/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/atoms/select"
import { StatsCards } from "./StatsCards"
import { StatsCharts } from "./StatsCharts"
import { StatsPieCharts } from "./StatsPieCharts"
import { useSellJournalContext } from "@/features/sell-journal/context/SellJournalContext"
import type { JournalEntry } from "@/features/journal/hooks/Journal_hook/useJournalEntry"

// types
type Period = "day" | "week" | "month" | "quarter" | "year"
type ServiceFilter = "all" | "Grossiste" | "Handpick"
type CommercialFilter = "all" | string

// helpers
function getPeriodKey(date: Date, period: Period) {
  switch (period) {
    case "day":
      return date.toISOString().slice(0, 10)
    case "week": {
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
      const dayNum = d.getUTCDay() || 7
      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
      const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
      return `S${week} ${d.getUTCFullYear()}`
    }
    case "month":
      return date.toLocaleDateString("fr-FR", { month: "short", year: "numeric" })
    case "quarter":
      return `T${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`
    case "year":
      return `${date.getFullYear()}`
  }
}

function isInRange(date: string, start?: string, end?: string) {
  if (!start) return true
  const d = new Date(date).getTime()
  const s = new Date(start).getTime()
  const e = end ? new Date(end).getTime() : s
  return d >= s && d <= e
}

export function Stats() {
  const { entries } = useSellJournalContext()

  const [period, setPeriod] = useState<Period>("day")
  const [service, setService] = useState<ServiceFilter>("all")
  const [commercial, setCommercial] = useState<CommercialFilter>("all")
  const [dateStart, setDateStart] = useState("")
  const [dateEnd, setDateEnd] = useState("")

  /** BASE FILTRÉE */
  const filteredEntries = useMemo(() => {
    return entries
      .filter((e) => service === "all" || e.service === service)
      .filter((e) => commercial === "all" || e.commercial === commercial)
      .filter((e) => isInRange(e.sell_at, dateStart, dateEnd))
  }, [entries, service, commercial, dateStart, dateEnd])

  /** GROUP BY PERIOD */
  const groupedByPeriod = useMemo(() => {
    const map = new Map<string, JournalEntry[]>()

    filteredEntries.forEach((e) => {
      const key = getPeriodKey(new Date(e.sell_at), period)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    })

    return map
  }, [filteredEntries, period])

  /** ACTIVE PERIOD = la plus récente */
  const activePeriodEntries = useMemo(() => {
    const keys = Array.from(groupedByPeriod.keys()).sort()
    const lastKey = keys[keys.length - 1]
    return lastKey ? groupedByPeriod.get(lastKey)! : []
  }, [groupedByPeriod])

  /** TIMELINE (graph principal) */
  const timelineData = useMemo(() => {
    return Array.from(groupedByPeriod.entries()).map(([key, list]) => ({
      period: key,
      total: list.reduce((s, e) => s + Number(e.sales), 0),
      count: list.length,
    }))
  }, [groupedByPeriod])

  /** PIE — SERVICE ou CA COMMERCIAUX */
  const servicePieData = useMemo(() => {
    const map = new Map<string, number>()

    activePeriodEntries.forEach((e) => {
      if (service === "all") {
        // nombre de ventes par service
        map.set(e.service, (map.get(e.service) || 0) + 1)
      } else {
        // CA par commercial
        map.set(
          e.commercial,
          (map.get(e.commercial) || 0) + Number(e.sales)
        )
      }
    })

    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value,
    }))
  }, [activePeriodEntries, service])

  /** PIE — COMMERCIAUX (NB DE VENTES) */
  const commercialPieData = useMemo(() => {
    const map = new Map<string, number>()

    activePeriodEntries.forEach((e) => {
      map.set(e.commercial, (map.get(e.commercial) || 0) + 1)
    })

    return Array.from(map.entries()).map(([name, value]) => ({
      name,
      value,
    }))
  }, [activePeriodEntries])

  const commercialOptions = useMemo(() => {
    return Array.from(new Set(entries.map((e) => e.commercial).filter(Boolean)))
  }, [entries])

  return (
    <div className="space-y-10">

      {/* FILTERS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 p-4 border rounded-xl bg-muted/30">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Jour</SelectItem>
            <SelectItem value="week">Semaine</SelectItem>
            <SelectItem value="month">Mois</SelectItem>
            <SelectItem value="quarter">Trimestre</SelectItem>
            <SelectItem value="year">Année</SelectItem>
          </SelectContent>
        </Select>

        <Select value={service} onValueChange={(v) => setService(v as ServiceFilter)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous services</SelectItem>
            <SelectItem value="Grossiste">Grossiste</SelectItem>
            <SelectItem value="Handpick">Handpick</SelectItem>
          </SelectContent>
        </Select>

        <Select value={commercial} onValueChange={setCommercial}>
          <SelectTrigger><SelectValue placeholder="Commercial" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {commercialOptions.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
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

      {/* KPI → période active */}
      <StatsCards entries={activePeriodEntries} />

      {/* TIMELINE */}
      <StatsCharts data={timelineData} />

      {/* PIE */}
      <StatsPieCharts
        serviceData={servicePieData}
        commercialData={commercialPieData}
        serviceFilter={service}
        period={period}
      />
    </div>
  )
}
