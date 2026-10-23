import { useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/atoms/card"
import { Badge } from "@/shared/ui/atoms/badge"
import { TICKET_THEME } from "../../ticket.theme"
import {
    TICKET_TYPE_LABELS,
    type Ticket,
    type TicketType,
    type TicketStatus,
} from "../types"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { Inbox } from "lucide-react"

const STATUS_LABELS: Record<TicketStatus, string> = {
    ouvert: "Ouvert",
    en_cours: "En attente",
    résolu: "Résolu",
    clos: "Clos",
}

const TYPE_KEYS: (TicketType | "non_classe")[] = [
    "support_informatique",
    "support_magasins",
    "imprimante_reseau",
    "proginov",
    "non_classe",
]

const formatDate = (iso?: string) => {
    if (!iso) return ""
    const d = new Date(iso)
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
}

function TicketRow({ ticket }: { ticket: Ticket }) {
    const dotClass =
        (ticket.status && TICKET_THEME.colors.dot[ticket.status]) || "bg-slate-300"
    return (
        <div className="flex items-center gap-3 py-2 border-b last:border-b-0 border-slate-100 dark:border-slate-800">
            <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} />
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{ticket.title}</div>
                <div className="text-xs text-slate-500 truncate">
                    {ticket.status ? STATUS_LABELS[ticket.status] : "—"}
                    {ticket.profiles?.full_name ? ` · ${ticket.profiles.full_name}` : ""}
                </div>
            </div>
            <span className="text-xs text-slate-400 tabular-nums shrink-0">
                {formatDate(ticket.created_at)}
            </span>
        </div>
    )
}

export function RecentTicketsByType({ tickets }: { tickets: Ticket[] }) {
    const grouped = useMemo(() => {
        const map = new Map<TicketType | "non_classe", Ticket[]>()
        for (const key of TYPE_KEYS) map.set(key, [])

        const sorted = [...tickets].sort((a, b) => {
            const dA = new Date(a.created_at || 0).getTime()
            const dB = new Date(b.created_at || 0).getTime()
            return dB - dA
        })

        for (const t of sorted) {
            const key: TicketType | "non_classe" = t.type ?? "non_classe"
            const arr = map.get(key)
            if (arr && arr.length < 5) arr.push(t)
        }
        return map
    }, [tickets])

    const visibleKeys = TYPE_KEYS.filter(
        (k) => k !== "non_classe" || (grouped.get("non_classe")?.length ?? 0) > 0,
    )

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
            {visibleKeys.map((key) => {
                const list = grouped.get(key) ?? []
                const label =
                    key === "non_classe" ? "Non classé" : TICKET_TYPE_LABELS[key]
                return (
                    <Card key={key}>
                        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm font-semibold">{label}</CardTitle>
                            <Badge variant="secondary" className="text-xs">
                                {list.length}
                            </Badge>
                        </CardHeader>
                        <CardContent className="pb-3">
                            {list.length === 0 ? (
                                <EmptyState
                                    size="sm"
                                    icon={Inbox}
                                    title="Aucun ticket"
                                />
                            ) : (
                                <div>
                                    {list.map((t) => (
                                        <TicketRow key={t.id} ticket={t} />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}
