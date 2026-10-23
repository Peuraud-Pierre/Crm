import { AlertTriangle, CheckCircle2, TicketIcon } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useWidgetData } from "@/shared/hooks/useWidgetData"
import type { WidgetProps } from "@/shared/types/widget.types"
import { Badge } from "@/shared/ui/atoms/badge"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonList } from "@/shared/ui/molecules/skeleton-presets"
import {
    WidgetList,
    WidgetListHeading,
    WidgetRow,
} from "@/shared/ui/molecules/widget-list"
import {
    fetchMyOpenTickets,
    fetchNewTickets,
} from "../services/myTicketsService"
import type { Ticket, TicketPriority } from "../components/types"

/** Une priorité est une donnée métier : elle se lit d'un coup d'œil. */
const PRIORITY_VARIANT: Record<
    TicketPriority,
    "default" | "secondary" | "destructive" | "warning" | "outline"
> = {
    urgente: "destructive",
    haute: "warning",
    moyenne: "secondary",
    basse: "outline",
    nouveau: "default",
}

type Scope = "mine" | "new" | "all"

function readScope(value: unknown): Scope {
    return value === "new" || value === "all" ? value : "mine"
}

/**
 * Les tickets qui demandent une action.
 *
 * Le périmètre est un **réglage** et non une décision du module : celui
 * qui traite les tickets veut voir ce qui lui est assigné, celui qui tient
 * la file veut voir ce que personne n'a encore pris, et l'un peut être
 * l'autre selon le jour. Trois valeurs : `mine`, `new`, `all`.
 *
 * La hauteur allouée pilote le nombre de lignes demandées : un module
 * réglé sur deux unités ne doit pas charger vingt tickets pour en
 * afficher trois. En périmètre `all`, chaque liste reçoit la moitié de
 * cette enveloppe — le module montre deux choses, pas deux fois plus.
 *
 * Les lignes ne sont pas cliquables : `/tickets` n'a pas de paramètre de
 * route, donc chaque ligne pointerait vers la même page que le bouton
 * « voir tout » de l'en-tête de carte, sans rien préciser de plus.
 */
export default function MyTicketsWidget({
    height,
    compact,
    settings,
}: WidgetProps) {
    const { user } = useAuth()
    const userId = user?.user_id
    const scope = readScope(settings.scope)

    const limit = Math.max(3, Math.floor(height * 1.5))
    const half = Math.max(2, Math.floor(limit / 2))

    const { data, loading, error } = useWidgetData(
        // Une seule requête composée, et non deux `useWidgetData` en
        // parallèle : ce hook ne mutualise ni ne met en cache, deux
        // appels doubleraient simplement le trafic au chargement de
        // l'accueil.
        // Seul le périmètre « assignés à moi » a besoin de l'identifiant :
        // les deux autres montrent la file, qui ne dépend de personne. Un
        // fetcher nul laisse le module en chargement (`useWidgetData`), il
        // ne faut donc l'annuler que là où l'attente a un sens.
        scope !== "mine" || userId
            ? () => fetchScope(scope, userId, limit, half)
            : null,
        [scope, userId, limit, half],
        "MyTicketsWidget"
    )

    const result = data ?? { mine: [], fresh: [] }
    const total = result.mine.length + result.fresh.length

    if (loading) {
        return (
            <div className="p-3">
                <SkeletonList rows={3} label="Chargement des tickets" />
            </div>
        )
    }

    if (error) {
        return (
            <EmptyState
                size="sm"
                variant="error"
                icon={AlertTriangle}
                title="Chargement impossible"
                description="Les tickets n'ont pas pu être récupérés."
            />
        )
    }

    if (total === 0) {
        return (
            <EmptyState
                size="sm"
                icon={CheckCircle2}
                title="Aucun ticket en attente"
                description={EMPTY_DESCRIPTION[scope]}
            />
        )
    }

    // Les intertitres n'ont de sens qu'en périmètre mixte : au-dessus
    // d'une liste unique, ils répètent le titre de la carte.
    const showHeadings =
        scope === "all" && result.mine.length > 0 && result.fresh.length > 0

    return (
        <WidgetList>
            {result.fresh.length > 0 && (
                <>
                    {showHeadings && (
                        <WidgetListHeading>Nouveaux</WidgetListHeading>
                    )}
                    {result.fresh.map((ticket) => (
                        <TicketRow
                            key={ticket.id}
                            ticket={ticket}
                            compact={compact}
                        />
                    ))}
                </>
            )}

            {result.mine.length > 0 && (
                <>
                    {showHeadings && (
                        <WidgetListHeading>Assignés à moi</WidgetListHeading>
                    )}
                    {result.mine.map((ticket) => (
                        <TicketRow
                            key={ticket.id}
                            ticket={ticket}
                            compact={compact}
                        />
                    ))}
                </>
            )}
        </WidgetList>
    )
}

const EMPTY_DESCRIPTION: Record<Scope, string> = {
    mine: "Rien ne vous est assigné pour le moment.",
    new: "Aucun ticket n'attend d'être pris en charge.",
    all: "Ni ticket assigné, ni ticket en attente de prise en charge.",
}

interface RowProps {
    ticket: Ticket
    compact: boolean
}

/** Volontairement sans `to` — voir l'en-tête du module. */
function TicketRow({ ticket, compact }: RowProps) {
    return (
        <WidgetRow
            icon={TicketIcon}
            accent="chart-3"
            compact={compact}
            title={ticket.title}
            meta={
                ticket.created_at
                    ? `Ouvert ${formatDistanceToNow(new Date(ticket.created_at), {
                          addSuffix: true,
                          locale: fr,
                      })}`
                    : undefined
            }
            trailing={
                ticket.priority && (
                    <Badge
                        variant={PRIORITY_VARIANT[ticket.priority]}
                        className="shrink-0"
                    >
                        {ticket.priority}
                    </Badge>
                )
            }
        />
    )
}

interface ScopeResult {
    mine: Ticket[]
    fresh: Ticket[]
}

/**
 * Charge le périmètre demandé. `new` ne dépend pas de l'utilisateur —
 * c'est le seul périmètre qui reste consultable avant que la session
 * n'ait résolu son identifiant.
 */
async function fetchScope(
    scope: Scope,
    userId: string | undefined,
    limit: number,
    half: number
): Promise<ScopeResult> {
    if (scope === "new") {
        return { mine: [], fresh: await fetchNewTickets(limit) }
    }

    if (scope === "mine") {
        return {
            mine: userId ? await fetchMyOpenTickets(userId, limit) : [],
            fresh: [],
        }
    }

    const [mine, fresh] = await Promise.all([
        userId ? fetchMyOpenTickets(userId, half) : Promise.resolve([]),
        fetchNewTickets(half),
    ])

    return { mine, fresh }
}
