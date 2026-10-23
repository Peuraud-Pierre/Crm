import { useMemo } from "react"
import { Ticket as TicketIcon, CheckCircle2, TrendingUp } from "lucide-react"
import { KpiCard } from "@/features/stock/components/dashboard/KpiCard"
import type { Ticket } from "../types"

const CLOSED_STATUSES = new Set(["résolu", "clos"])

export function KpiSection({ tickets }: { tickets: Ticket[] }) {
    const { total, closed, rate } = useMemo(() => {
        const total = tickets.length
        const closed = tickets.filter((t) => t.status && CLOSED_STATUSES.has(t.status)).length
        const rate = total > 0 ? Math.round((closed / total) * 100) : 0
        return { total, closed, rate }
    }, [tickets])

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <KpiCard
                title="Total des tickets"
                value={total}
                icon={<TicketIcon className="h-4 w-4" />}
            />
            <KpiCard
                title="Tickets clos"
                value={closed}
                hint="Inclut les tickets résolus"
                icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <KpiCard
                title="Taux de résolution"
                value={`${rate}%`}
                icon={<TrendingUp className="h-4 w-4" />}
            />
        </div>
    )
}
