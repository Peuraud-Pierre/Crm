import { format } from "date-fns"
import {
    ArrowRight, History, LogIn, LogOut, MapPin, MapPinOff, MoveRight, Undo2,
    type LucideIcon,
} from "lucide-react"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { cn } from "@/shared/lib/utils"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import { BALLE_EMPLACEMENT_EVENT_LABELS } from "@/features/stock_handpick/constants"
import type {
    BalleEmplacementEvent,
    BalleEmplacementEventType,
} from "@/features/stock_handpick/types/balle.types"

const EVENT_ICON: Record<BalleEmplacementEventType, LucideIcon> = {
    placed: LogIn,
    moved: MoveRight,
    removed: MapPinOff,
    borrowed: LogOut,
    returned: Undo2,
}

const EVENT_TONE: Record<BalleEmplacementEventType, string> = {
    placed: "text-success",
    moved: "text-primary",
    removed: "text-muted-foreground",
    borrowed: "text-warning",
    returned: "text-success",
}

const SKELETON_KEYS = ["h1", "h2", "h3"]

interface BalleEmplacementHistoryProps {
    events: BalleEmplacementEvent[]
    userNames: Map<string, string>
    loading: boolean
    /** Chemin actuel d'un emplacement ; l'instantané sert de repli. */
    emplacementPath: (emplacementId: string | null | undefined) => string | null
}

/**
 * Chronologie des emplacements d'une balle, du plus récent au plus ancien.
 * Présentation seule : la lecture est faite par `BalleEmplacementSection`.
 */
export function BalleEmplacementHistory({
    events,
    userNames,
    loading,
    emplacementPath,
}: BalleEmplacementHistoryProps) {
    // Le chemin actuel d'abord : un emplacement renommé se lit sous son nom du
    // jour. L'instantané prend le relais s'il a été supprimé.
    const pathOf = (id: string | null, snapshot: string | null) =>
        emplacementPath(id) ?? snapshot

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className={cn("flex items-center gap-1.5", HANDPICK_THEME.filterBar.panelLabel)}>
                    <History size={12} aria-hidden />
                    Historique d'emplacement
                </span>
                {events.length > 0 && (
                    <span className="text-xs font-medium text-muted-foreground">
                        {events.length} mouvement{events.length > 1 ? "s" : ""}
                    </span>
                )}
            </div>

            {loading && events.length === 0 ? (
                <div className="space-y-2">
                    {SKELETON_KEYS.map((key) => (
                        <Skeleton key={key} className="h-10 w-full rounded-xl" />
                    ))}
                </div>
            ) : events.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3">
                    <MapPin size={14} className="shrink-0 text-muted-foreground/50" />
                    <p className={cn("text-xs", HANDPICK_THEME.card.emptyValue)}>
                        Aucun mouvement enregistré
                    </p>
                </div>
            ) : (
                // ~4 mouvements visibles, les plus anciens au défilement : la
                // fiche garde sa traçabilité à portée sans s'allonger d'autant.
                // `overscroll-contain` : arrivé en bout de liste, la molette ne
                // fait pas défiler la fiche entière.
                <ol
                    className="max-h-56 space-y-1.5 overflow-y-auto overscroll-contain pr-1"
                    aria-label="Mouvements d'emplacement"
                    tabIndex={0}
                >
                    {events.map((event) => {
                        const Icon = EVENT_ICON[event.event]
                        const from = pathOf(event.emplacement_from_id, event.from_path)
                        const to = pathOf(event.emplacement_to_id, event.to_path)
                        const author = event.user_id ? userNames.get(event.user_id) : null
                        return (
                            <li
                                key={event.id}
                                className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2"
                            >
                                <Icon
                                    size={14}
                                    className={cn("shrink-0", EVENT_TONE[event.event])}
                                    aria-hidden
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 text-xs">
                                        <span className="font-semibold text-foreground">
                                            {BALLE_EMPLACEMENT_EVENT_LABELS[event.event]}
                                        </span>
                                        {(from || to) && (
                                            <span className="flex min-w-0 items-center gap-1 font-mono text-muted-foreground">
                                                {from && <span className="truncate">{from}</span>}
                                                {from && to && (
                                                    <ArrowRight size={10} className="shrink-0" aria-hidden />
                                                )}
                                                {to && (
                                                    <span className="truncate font-bold text-foreground">
                                                        {to}
                                                    </span>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-2xs text-muted-foreground">
                                        <span className="tabular-nums">
                                            {format(new Date(event.created_at), "dd/MM/yy · HH:mm")}
                                        </span>
                                        {author && <span> · {author}</span>}
                                    </div>
                                </div>
                            </li>
                        )
                    })}
                </ol>
            )}
        </div>
    )
}
