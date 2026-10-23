/**
 * Classement des setters + journal des derniers coups joués.
 * Rendu pur à partir de l'état du jeu.
 *
 * Design : style "vibrant leaderboard" — podium or/argent/bronze, barres de
 * progression relatives au leader, chiffres tabulaires, icônes Lucide
 * (pas d'emoji structurel), hover 150-300 ms.
 */
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/shared/ui/atoms/avatar"
import { Badge } from "@/shared/ui/atoms/badge"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { cn } from "@/shared/lib/utils"
import {
    CalendarCheck2,
    Coins,
    Dices,
    Eye,
    Lock,
    Phone,
    RotateCw,
    Trophy,
} from "lucide-react"
import type { TourneeGame, TourneePlayer } from "../types"
import { BOARD_CELLS } from "../utils/board"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

/** Pastille de rang : or / argent / bronze, puis numéro neutre. */
const RANK_STYLES = [
    "bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/30",
    "bg-slate-400/15 text-slate-500 dark:text-slate-300 ring-1 ring-slate-400/30",
    "bg-orange-700/15 text-orange-700 dark:text-orange-400 ring-1 ring-orange-700/30",
]

function initials(name: string): string {
    return name
        .split(/\s+/)
        .map((part) => part[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
}

function StatItem({
    icon: Icon,
    value,
    label,
}: {
    icon: typeof Phone
    value: number
    label: string
}) {
    return (
        <span
            title={label}
            className="flex items-center gap-0.5 text-2xs text-muted-foreground"
        >
            <Icon className="h-3 w-3" aria-hidden />
            <span className="tabular-nums">{value}</span>
            <span className="sr-only">{label}</span>
        </span>
    )
}

function PlayerRow({
    player,
    rank,
    maxPoints,
}: {
    player: TourneePlayer
    rank: number
    maxPoints: number
}) {
    const percent =
        maxPoints > 0 ? Math.max(4, (player.points / maxPoints) * 100) : 0

    return (
        <div
            className={cn(
                "rounded-lg border bg-card p-2.5 transition-colors duration-base hover:bg-muted/50",
                rank === 0 && "border-amber-500/40 bg-amber-500/5"
            )}
        >
            <div className="flex items-center gap-3">
                <span
                    className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-2xs font-bold tabular-nums",
                        RANK_STYLES[rank] ?? "bg-muted text-muted-foreground"
                    )}
                >
                    {rank + 1}
                </span>
                <Avatar className="h-8 w-8">
                    {player.avatarUrl && <AvatarImage src={player.avatarUrl} />}
                    <AvatarFallback className="text-2xs">
                        {initials(player.name)}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <span
                            className={cn(
                                "h-2 w-2 shrink-0 rounded-full",
                                player.color
                            )}
                            aria-hidden
                        />
                        <span className="truncate text-sm font-semibold">
                            {player.name}
                        </span>
                        {player.inJail && (
                            <span
                                title="Au Frigo (no-show)"
                                className="flex items-center text-destructive"
                            >
                                <Lock className="h-3.5 w-3.5" aria-hidden />
                                <span className="sr-only">
                                    Au Frigo (no-show)
                                </span>
                            </span>
                        )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <StatItem
                            icon={CalendarCheck2}
                            value={player.rdvCount}
                            label="RDV posés"
                        />
                        <StatItem
                            icon={Eye}
                            value={player.showCount}
                            label="Shows honorés"
                        />
                        <StatItem
                            icon={Phone}
                            value={player.appelCount}
                            label="Appels"
                        />
                        <StatItem
                            icon={RotateCw}
                            value={player.lapsCompleted}
                            label="Tours de plateau"
                        />
                        {player.rents > 0 && (
                            <StatItem
                                icon={Coins}
                                value={player.rents}
                                label="Points de loyers perçus"
                            />
                        )}
                    </div>
                </div>
                <Badge
                    variant="secondary"
                    className="shrink-0 font-mono tabular-nums"
                >
                    {player.points.toLocaleString("fr-FR")} pts
                </Badge>
            </div>
            <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={`Score relatif de ${player.name}`}
                aria-valuenow={player.points}
                aria-valuemin={0}
                aria-valuemax={maxPoints}
            >
                <div
                    className={cn(
                        "h-full rounded-full transition-[width] duration-slow",
                        player.color
                    )}
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    )
}

export function Leaderboard({ game }: { game: TourneeGame }) {
    const maxPoints = game.players[0]?.points ?? 0

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        <Trophy className="h-4 w-4" aria-hidden />
                    </span>
                    Classement — {game.periodLabel}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {game.players.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={Dices}
                        title="Aucune action ce mois-ci"
                        description="Premier RDV posé = premier lancer de dés."
                    />
                ) : (
                    game.players.map((player, i) => (
                        <PlayerRow
                            key={player.id}
                            player={player}
                            rank={i}
                            maxPoints={maxPoints}
                        />
                    ))
                )}
            </CardContent>
        </Card>
    )
}

export function MovesLog({ game }: { game: TourneeGame }) {
    const playerById = new Map(game.players.map((p) => [p.id, p]))
    const recent = [...game.moves].reverse().slice(0, 8)

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Dices className="h-4 w-4" aria-hidden />
                    </span>
                    Derniers coups
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
                {recent.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        Le plateau attend son premier joueur.
                    </p>
                ) : (
                    recent.map((move) => {
                        const player = playerById.get(move.playerId)
                        const cell = BOARD_CELLS[move.to]
                        return (
                            <div
                                key={move.eventId}
                                className="flex items-center gap-2 rounded-md px-1.5 py-1 text-2xs transition-colors duration-base hover:bg-muted/50 sm:text-xs"
                            >
                                <span
                                    className={cn(
                                        "h-2 w-2 shrink-0 rounded-full",
                                        player?.color ?? "bg-muted"
                                    )}
                                    aria-hidden
                                />
                                <span className="min-w-0 flex-1 truncate">
                                    <span className="font-semibold">
                                        {player?.name ?? "?"}
                                    </span>{" "}
                                    <span className="text-muted-foreground">
                                        {move.eventLabel} ·{" "}
                                    </span>
                                    <span className="font-mono tabular-nums">
                                        {move.dice[0]}+{move.dice[1]}
                                    </span>{" "}
                                    <span
                                        className={cn(
                                            move.sentToJail &&
                                                "font-medium text-destructive"
                                        )}
                                    >
                                        → {move.sentToJail ? "Le Frigo" : cell.name}
                                    </span>
                                    {move.passedStart && (
                                        <span className="text-amber-600 dark:text-amber-400">
                                            {" "}
                                            · Départ +200
                                        </span>
                                    )}
                                </span>
                                <span
                                    className={cn(
                                        "shrink-0 font-mono tabular-nums",
                                        move.points > 0
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    +{move.points}
                                </span>
                            </div>
                        )
                    })
                )}
            </CardContent>
        </Card>
    )
}
