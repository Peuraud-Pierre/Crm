import { Badge } from "@/shared/ui/atoms/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/atoms/card"
import { Input } from "@/shared/ui/atoms/input"
import { cn } from "@/shared/lib/utils"
import { format, parseISO } from "date-fns"
import { useCallback, useState } from "react"
import { useNavigate } from "react-router"
import {
    Briefcase,
    Calendar,
    Clock,
    Inbox,
    Mail,
    MapPin,
    Phone,
    Search,
    Wallet,
} from "lucide-react"

import { findClientByContact } from "@/features/crm/services/clientService"
import type { Lead } from "@/features/leads/components/types"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

interface MessagesCardProps {
    leads: Lead[]
    searchQuery: string
    onSearchQueryChange: (value: string) => void
    normalizeActivity: (raw: string) => string
    normalizeBudget: (raw: string | null) => string
}

function ClampableMessage({ text }: { text: string }) {
    const [expanded, setExpanded] = useState(false)
    const [isClamped, setIsClamped] = useState(false)

    // Mesure au montage (en état replié) si le texte dépasse les 3 lignes.
    const measureRef = useCallback((el: HTMLParagraphElement | null) => {
        if (el) setIsClamped(el.scrollHeight > el.clientHeight + 1)
    }, [])

    const canToggle = isClamped || expanded

    return (
        <div>
            <p
                ref={measureRef}
                onClick={(e) => {
                    if (!canToggle) return
                    e.stopPropagation()
                    setExpanded((v) => !v)
                }}
                className={cn(
                    "whitespace-pre-line break-words text-sm text-foreground/90",
                    !expanded && "line-clamp-3",
                    canToggle && "cursor-pointer"
                )}
            >
                {text}
            </p>
            {canToggle && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        setExpanded((v) => !v)
                    }}
                    className="mt-1 text-xs font-medium text-primary hover:underline"
                >
                    {expanded ? "Voir moins" : "Voir plus"}
                </button>
            )}
        </div>
    )
}

export function MessagesCard({
    leads,
    searchQuery,
    onSearchQueryChange,
    normalizeActivity,
    normalizeBudget,
}: MessagesCardProps) {
    const navigate = useNavigate()

    const openClientSheet = useCallback(
        async (lead: Lead) => {
            const { data } = await findClientByContact(
                lead.email,
                lead.phone || null
            )
            navigate(data ? `/crm/client/${data.id}` : "/crm/clients")
        },
        [navigate]
    )

    return (
        <Card className="col-span-1 md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle>Messages des Leads</CardTitle>
                <span className="shrink-0 text-sm font-normal text-muted-foreground">
                    {leads.length}{" "}
                    {leads.length > 1 ? "messages" : "message"}
                </span>
            </CardHeader>
            <CardContent>
                <div className="relative mb-4">
                    <label htmlFor="leads-message-search" className="sr-only">
                        Rechercher un message, un nom ou un email
                    </label>
                    <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="leads-message-search"
                        placeholder="Rechercher un message, un nom ou un email..."
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => onSearchQueryChange(e.target.value)}
                    />
                </div>

                <div className="w-full max-h-160 overflow-y-auto overscroll-contain rounded-md border">
                    {leads.length === 0 ? (
                        <EmptyState
                            variant="search"
                            icon={Inbox}
                            title="Aucun message trouvé"
                        />
                    ) : (
                        <ul className="divide-y">
                            {leads.map((lead) => (
                                <li
                                    key={lead.id}
                                    onClick={() => openClientSheet(lead)}
                                    className="cursor-pointer p-4 transition-colors hover:bg-muted/50"
                                >
                                    <div className="min-w-0 space-y-1.5">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="truncate font-semibold">
                                                {lead.name}
                                            </p>
                                            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                                                <Calendar className="h-3 w-3 shrink-0" />
                                                {format(
                                                    parseISO(lead.created_at),
                                                    "dd/MM/yyyy HH:mm"
                                                )}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                            <a
                                                href={`mailto:${lead.email}`}
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                                className="flex min-w-0 items-center gap-1 hover:text-foreground hover:underline"
                                            >
                                                <Mail className="h-3 w-3 shrink-0" />
                                                <span className="truncate">
                                                    {lead.email}
                                                </span>
                                            </a>
                                            {lead.phone && (
                                                <a
                                                    href={`tel:${lead.phone}`}
                                                    onClick={(e) =>
                                                        e.stopPropagation()
                                                    }
                                                    className="flex items-center gap-1 whitespace-nowrap hover:text-foreground hover:underline"
                                                >
                                                    <Phone className="h-3 w-3 shrink-0" />
                                                    {lead.phone}
                                                </a>
                                            )}
                                        </div>

                                        <ClampableMessage
                                            text={lead.message}
                                        />

                                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                            <Badge
                                                variant="secondary"
                                                className="gap-1 font-normal max-w-full"
                                            >
                                                <Briefcase className="h-3 w-3 shrink-0" />
                                                {normalizeActivity(
                                                    lead.activity
                                                )}
                                            </Badge>
                                            <Badge
                                                variant="secondary"
                                                className="gap-1 font-normal max-w-full"
                                            >
                                                <Wallet className="h-3 w-3 shrink-0" />
                                                {normalizeBudget(lead.budget)}
                                            </Badge>
                                            {lead.location && (
                                                <Badge
                                                    variant="outline"
                                                    className="gap-1 font-normal max-w-full"
                                                >
                                                    <MapPin className="h-3 w-3 shrink-0" />
                                                    {lead.location}
                                                </Badge>
                                            )}
                                            {/* Valeur issue d'un radio CF7 :
                                                affichée telle quelle, sans
                                                normalisation — contrairement à
                                                l'activité et au budget, qui ont
                                                un historique de champs libres. */}
                                            {lead.urgency && (
                                                <Badge
                                                    variant="secondary"
                                                    className="gap-1 font-normal max-w-full"
                                                >
                                                    <Clock className="h-3 w-3 shrink-0" />
                                                    {lead.urgency}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
