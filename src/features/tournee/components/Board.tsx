/**
 * Plateau La Tournée 2D (grille CSS rectangulaire 8×6, 24 cases périmétriques,
 * façon jeu de l'oie : parcours + pièges aux coins).
 * Rendu pur : reçoit l'état du jeu, n'accède à aucune donnée.
 */
import { cn } from "@/shared/lib/utils"
import { Home } from "lucide-react"
import type { TourneeGame, TourneePlayer } from "../types"
import { BOARD_CELLS, CORNER_INDICES, cellGridPosition } from "../utils/board"
import type { BoardCell } from "../types"

const KIND_ICONS: Record<string, string> = {
    start: "🚀",
    jail: "🧊",
    parking: "🌀",
    gotojail: "📵",
    chance: "⚡",
    community: "🎁",
    station: "📡",
}

function CellTokens({ players }: { players: TourneePlayer[] }) {
    if (players.length === 0) return null
    return (
        <div className="absolute bottom-0.5 left-0.5 right-0.5 flex flex-wrap justify-center gap-0.5">
            {players.map((p) => (
                <span
                    key={p.id}
                    title={p.name}
                    className={cn(
                        "h-2.5 w-2.5 rounded-full ring-1 ring-background",
                        p.color
                    )}
                />
            ))}
        </div>
    )
}

function Cell({
    cell,
    owner,
    players,
}: {
    cell: BoardCell
    owner: TourneePlayer | null
    players: TourneePlayer[]
}) {
    const { row, col } = cellGridPosition(cell.index)
    const isCorner = CORNER_INDICES.has(cell.index)
    const icon = KIND_ICONS[cell.kind]

    return (
        <div
            style={{ gridRow: row, gridColumn: col }}
            title={owner ? `${cell.name} — propriété de ${owner.name}` : cell.name}
            className={cn(
                "relative flex flex-col overflow-hidden rounded-sm border bg-card text-card-foreground",
                isCorner && "bg-muted"
            )}
        >
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-0.5 p-0.5 text-center">
                {icon && <span className="text-sm leading-none">{icon}</span>}
                <span className="line-clamp-2 text-2xs font-medium leading-tight sm:text-xs">
                    {cell.name}
                </span>
                {owner && (
                    // Maison aux couleurs du propriétaire.
                    <span
                        title={`Propriété de ${owner.name}`}
                        className={cn(
                            "flex h-3.5 w-3.5 items-center justify-center rounded-sm",
                            owner.color
                        )}
                    >
                        {/* eslint-disable-next-line nokk-project/no-restricted-syntax -- texte/média posé sur un aplat de couleur dynamique (donnée ou visuel) : blanc requis pour le contraste, indépendant du thème (design system §12.4) */}
                        <Home className="h-2.5 w-2.5 text-white" aria-hidden />
                        <span className="sr-only">
                            Propriété de {owner.name}
                        </span>
                    </span>
                )}
            </div>
            <CellTokens players={players} />
        </div>
    )
}

export function Board({ game }: { game: TourneeGame }) {
    const playersByCell = new Map<number, TourneePlayer[]>()
    for (const player of game.players) {
        const list = playersByCell.get(player.position) ?? []
        list.push(player)
        playersByCell.set(player.position, list)
    }
    const playerById = new Map(game.players.map((p) => [p.id, p]))

    return (
        // aspect-[4/3] : valeur arbitraire justifiée — ratio exact de la
        // grille 8×6 du plateau, aucun token @theme équivalent.
        <div className="grid aspect-[4/3] w-full grid-cols-8 grid-rows-6 gap-1 rounded-lg border bg-muted/30 p-1">
            {BOARD_CELLS.map((cell) => (
                <Cell
                    key={cell.index}
                    cell={cell}
                    owner={
                        game.ownership[cell.index]
                            ? playerById.get(game.ownership[cell.index]) ?? null
                            : null
                    }
                    players={playersByCell.get(cell.index) ?? []}
                />
            ))}
            {/* Centre du plateau */}
            <div className="col-start-2 col-end-8 row-start-2 row-end-6 flex flex-col items-center justify-center gap-1 rounded-md">
                <span className="-rotate-6 text-xl font-black tracking-widest text-primary sm:text-3xl">
                    LA TOURNÉE
                </span>
                <span className="text-xs text-muted-foreground">
                    Le jeu des setters — {game.periodLabel}
                </span>
            </div>
        </div>
    )
}
