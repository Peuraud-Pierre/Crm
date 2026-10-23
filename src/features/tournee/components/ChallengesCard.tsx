/**
 * Défis du jour — deux cartes tirées au sort (déterministe) chaque jour,
 * avec la liste des setters qui les ont déjà remplis.
 *
 * Design : icônes Lucide mappées par id de défi (pas d'emoji structurel),
 * badge bonus doré, chips joueurs colorées.
 */
import { Badge } from "@/shared/ui/atoms/badge"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { cn } from "@/shared/lib/utils"
import {
    Activity,
    CalendarPlus,
    CheckCircle2,
    PhoneCall,
    Search,
    Sunrise,
    Zap,
} from "lucide-react"
import type { TourneeGame } from "../types"

/** Icône Lucide par id de défi (fallback : Zap). */
const CHALLENGE_ICONS: Record<string, typeof Zap> = {
    poseur: CalendarPlus,
    "machine-appels": PhoneCall,
    "sans-accroc": CheckCircle2,
    decouvreur: Search,
    "leve-tot": Sunrise,
    marathonien: Activity,
}

export function ChallengesCard({ game }: { game: TourneeGame }) {
    if (game.challenges.length === 0) return null

    const playerById = new Map(game.players.map((p) => [p.id, p]))

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary/50 text-secondary-foreground">
                        <Zap className="h-4 w-4" aria-hidden />
                    </span>
                    Défis du jour
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
                {game.challenges.map(({ def, completedBy }) => {
                    const Icon = CHALLENGE_ICONS[def.id] ?? Zap
                    const done = completedBy.length > 0
                    return (
                        <div
                            key={def.id}
                            className={cn(
                                "rounded-lg border bg-card p-2.5 transition-colors duration-base hover:bg-muted/50",
                                done && "border-emerald-500/40"
                            )}
                        >
                            <div className="flex items-center gap-2.5">
                                <span
                                    className={cn(
                                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                                        done
                                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                            : "bg-muted text-muted-foreground"
                                    )}
                                >
                                    <Icon className="h-4 w-4" aria-hidden />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold leading-tight">
                                        {def.label}
                                    </p>
                                    <p className="text-2xs text-muted-foreground sm:text-xs">
                                        {def.description}
                                    </p>
                                </div>
                                <Badge
                                    variant="secondary"
                                    className="shrink-0 bg-amber-500/15 font-mono tabular-nums text-amber-700 dark:text-amber-400"
                                >
                                    +{def.bonus}
                                </Badge>
                            </div>
                            {done && (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2">
                                    <CheckCircle2
                                        className="h-3 w-3 text-emerald-600 dark:text-emerald-400"
                                        aria-hidden
                                    />
                                    <span className="text-2xs text-muted-foreground">
                                        Réussi par
                                    </span>
                                    {completedBy.map((id) => {
                                        const player = playerById.get(id)
                                        if (!player) return null
                                        return (
                                            <span
                                                key={id}
                                                className="flex items-center gap-1 rounded-full border bg-muted/50 px-1.5 py-0.5 text-2xs font-medium"
                                            >
                                                <span
                                                    className={cn(
                                                        "h-1.5 w-1.5 rounded-full",
                                                        player.color
                                                    )}
                                                    aria-hidden
                                                />
                                                {player.name}
                                            </span>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
