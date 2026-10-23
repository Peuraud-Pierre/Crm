/**
 * Moteur de jeu La Tournée — 100 % pur et déterministe.
 *
 * Chaque événement CRM du mois (RDV, appel…) vaut des points ET un lancer de
 * dés. Les dés sont dérivés d'un hash de l'id de l'événement : pas de
 * Math.random, donc le plateau est identique pour tous les setters qui le
 * consultent (et rejouable à l'identique).
 *
 * Règles :
 *  - points par type d'événement (les RDV "achat" rapportent le plus),
 *  - RDV honoré (show === true) → bonus,
 *  - no-show (show === false) → direction le Frigo (piège), pas de points,
 *  - passage par la case Départ → bonus,
 *  - case Chance / Caisse d'équipe → petit bonus,
 *  - une propriété appartient au joueur qui s'y est le plus arrêté,
 *  - tomber sur la propriété d'un autre → il perçoit un loyer (points bonus
 *    pour lui, rien n'est retiré au visiteur : gamification, pas punition).
 */
import { EVENT_TYPE_LABELS } from "@/features/crm/utils/eventTypes"
import type {
    ChallengeDef,
    ChallengeState,
    TourneeEventRow,
    TourneeGame,
    TourneePlayer,
    TourneeProfile,
    MoveLog,
} from "../types"
import {
    BOARD_CELLS,
    BOARD_SIZE,
    JAIL_INDEX,
    OWNABLE_KINDS,
    START_INDEX,
} from "./board"

// ── Barème ───────────────────────────────────────────────────────────────────

const POINTS_BY_TYPE: Record<string, number> = {
    "rdv physique achat": 100,
    "rdv visio achat": 80,
    "rdv physique decouverte": 80,
    "rdv decouverte visio": 60,
    "rdv visio reassort": 40,
    appel: 10,
}
const DEFAULT_POINTS = 5
const SHOW_BONUS = 50
const PASS_START_BONUS = 200
const CARD_BONUS = 50
const RENT_BONUS = 25

const RDV_TYPES = new Set(
    Object.keys(POINTS_BY_TYPE).filter((t) => t.startsWith("rdv"))
)

/** Couleurs de pions attribuées dans l'ordre du classement d'arrivée. */
const PLAYER_COLORS = [
    "bg-red-500",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-cyan-500",
    "bg-orange-500",
]

// ── Dés déterministes ────────────────────────────────────────────────────────

/** Hash FNV-1a 32 bits d'une chaîne (stable entre sessions/navigateurs). */
export function fnv1a(str: string): number {
    let hash = 0x811c9dc5
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193)
    }
    return hash >>> 0
}

/** Deux dés 1-6 dérivés de l'id d'un événement. */
export function diceForEvent(eventId: string): [number, number] {
    const h = fnv1a(eventId)
    // ⚠️ >>> (non signé) obligatoire : h >> 8 réinterprète h en int32 signé,
    // ce qui donnait un dé négatif pour h ≥ 2³¹ (et une case hors plateau).
    return [(h % 6) + 1, ((h >>> 8) % 6) + 1]
}

// ── Simulation ───────────────────────────────────────────────────────────────

function normalizeType(nom: string | null): string {
    return (nom ?? "").trim().toLowerCase()
}

function labelForType(type: string): string {
    return EVENT_TYPE_LABELS[type] ?? (type || "Événement")
}

/**
 * Construit l'état complet du jeu à partir des événements du mois.
 * Les événements sont rejoués dans l'ordre chronologique de création, tous
 * joueurs confondus — comme des tours de table.
 */
export interface BuildGameOptions {
    /** Défis du jour + date de référence pour les évaluer. */
    challenges?: ChallengeDef[]
    today?: Date
}

export function buildGame(
    events: TourneeEventRow[],
    profiles: TourneeProfile[],
    periodLabel: string,
    options: BuildGameOptions = {}
): TourneeGame {
    const profileById = new Map(profiles.map((p) => [p.user_id, p]))
    const players = new Map<string, TourneePlayer>()
    const landings = new Map<number, Map<string, number>>()
    const moves: MoveLog[] = []

    const ordered = [...events]
        .filter((e) => e.creator_id && e.id)
        .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))

    const getPlayer = (id: string): TourneePlayer => {
        let p = players.get(id)
        if (!p) {
            const profile = profileById.get(id)
            p = {
                id,
                name: profile?.full_name || "Setter mystère",
                avatarUrl: profile?.avatar_url ?? null,
                color: PLAYER_COLORS[players.size % PLAYER_COLORS.length],
                position: START_INDEX,
                inJail: false,
                points: 0,
                rents: 0,
                rdvCount: 0,
                showCount: 0,
                noShowCount: 0,
                appelCount: 0,
                lapsCompleted: 0,
            }
            players.set(id, p)
        }
        return p
    }

    for (const event of ordered) {
        const player = getPlayer(event.creator_id as string)
        const type = normalizeType(event.nom)
        const isRdv = RDV_TYPES.has(type)
        const isNoShow = isRdv && event.show === false

        if (isRdv) player.rdvCount++
        if (type === "appel") player.appelCount++
        if (isRdv && event.show === true) player.showCount++

        const dice = diceForEvent(event.id)
        const from = player.position
        let points = 0
        let passedStart = false
        let to: number

        if (isNoShow) {
            // Un no-show envoie directement au Frigo : pas de points,
            // pas de bonus de passage.
            player.noShowCount++
            to = JAIL_INDEX
            player.inJail = true
        } else {
            const steps = dice[0] + dice[1]
            // Double modulo : garantit un index 0..23 même si une entrée
            // inattendue rendait la somme négative.
            to = (((from + steps) % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE
            passedStart = from + steps >= BOARD_SIZE
            player.inJail = false

            points = POINTS_BY_TYPE[type] ?? DEFAULT_POINTS
            if (isRdv && event.show === true) points += SHOW_BONUS
            if (passedStart) {
                points += PASS_START_BONUS
                player.lapsCompleted++
            }

            const cell = BOARD_CELLS[to]
            if (cell.kind === "chance" || cell.kind === "community") {
                points += CARD_BONUS
            }
            if (cell.kind === "gotojail") {
                to = JAIL_INDEX
                player.inJail = true
            }
            if (OWNABLE_KINDS.has(cell.kind)) {
                let byPlayer = landings.get(to)
                if (!byPlayer) {
                    byPlayer = new Map()
                    landings.set(to, byPlayer)
                }
                byPlayer.set(player.id, (byPlayer.get(player.id) ?? 0) + 1)
            }
        }

        player.position = to
        player.points += points

        moves.push({
            eventId: event.id,
            playerId: player.id,
            eventLabel: labelForType(type),
            dice,
            from,
            to,
            points,
            passedStart,
            sentToJail: isNoShow || player.inJail,
            date: event.created_at ?? "",
        })
    }

    // Propriétaire d'une case = joueur qui s'y est le plus arrêté
    // (égalité → premier arrivé, l'ordre d'insertion de la Map fait foi).
    const ownership: Record<number, string> = {}
    for (const [cellIndex, byPlayer] of landings) {
        let best: string | null = null
        let bestCount = 0
        for (const [playerId, count] of byPlayer) {
            if (count > bestCount) {
                best = playerId
                bestCount = count
            }
        }
        if (best) ownership[cellIndex] = best
    }

    // Loyers : chaque arrêt d'un AUTRE joueur sur ta case te rapporte.
    for (const move of moves) {
        const owner = ownership[move.to]
        if (owner && owner !== move.playerId) {
            const ownerPlayer = players.get(owner)
            if (ownerPlayer) {
                ownerPlayer.rents += RENT_BONUS
                ownerPlayer.points += RENT_BONUS
            }
        }
    }

    // Défis quotidiens : évalués sur les événements du jour de chaque joueur,
    // le bonus s'ajoute au score avant le classement.
    const challenges: ChallengeState[] = []
    if (options.challenges?.length && options.today) {
        const todayStr = options.today.toDateString()
        const todayByPlayer = new Map<string, TourneeEventRow[]>()
        for (const event of ordered) {
            if (!event.created_at) continue
            if (new Date(event.created_at).toDateString() !== todayStr) continue
            const id = event.creator_id as string
            const list = todayByPlayer.get(id) ?? []
            list.push(event)
            todayByPlayer.set(id, list)
        }
        for (const def of options.challenges) {
            const completedBy: string[] = []
            for (const [playerId, todayEvents] of todayByPlayer) {
                if (def.test(todayEvents)) {
                    completedBy.push(playerId)
                    const player = players.get(playerId)
                    if (player) player.points += def.bonus
                }
            }
            challenges.push({ def, completedBy })
        }
    }

    return {
        players: [...players.values()].sort((a, b) => b.points - a.points),
        ownership,
        moves,
        challenges,
        periodLabel,
    }
}
