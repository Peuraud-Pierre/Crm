import type { JournalEntry } from "@/features/journal/hooks/Journal_hook/useJournalEntry"

export function groupEntriesByPeriod(entries: JournalEntry[], period: string) {
    const map = new Map<string, number>()

    entries.forEach((e) => {
        const d = new Date(e.sell_at)
        let key = ""

        switch (period) {
            case "day":
                key = d.toISOString().slice(0, 10)
                break

            case "week": {
                const week = getWeekNumber(d)
                key = `S${week}-${d.getFullYear()}`
                break
            }

            case "month":
                key = d.toLocaleDateString("fr-FR", {
                    month: "short",
                    year: "numeric",
                })
                break

            case "quarter":
                key = `T${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
                break

            case "year":
                key = `${d.getFullYear()}`
                break
        }

        map.set(key, (map.get(key) || 0) + Number(e.sales))
    })

    return Array.from(map.entries()).map(([label, value]) => ({
        label,
        value,
    }))
}

export function getWeekNumber(date: Date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
