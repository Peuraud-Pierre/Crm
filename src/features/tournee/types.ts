/**
 * Types de la feature Tournée — gamification des données CRM pour les setters.
 *
 * Tout est DÉRIVÉ des événements réels du CRM (Event_calendar) : aucune table
 * dédiée, aucune écriture. Le "jeu" est une projection déterministe des stats
 * du mois : mêmes événements en base → même plateau pour tout le monde.
 */
import type { Database } from "@/integrations/supabase/types"

export type TourneeEventRow = Pick<
    Database["public"]["Tables"]["Event_calendar"]["Row"],
    "id" | "nom" | "debut" | "created_at" | "creator_id" | "show" | "id_client"
>

export interface TourneeProfile {
    user_id: string
    full_name: string | null
    avatar_url: string | null
}

/** Nature d'une case du plateau. */
export type CellKind =
    | "start" // Départ (+bonus à chaque passage)
    | "property" // Rue/avenue à posséder
    | "station" // Canal d'acquisition (possédable)
    | "chance" // Case Boost (bonus)
    | "community" // Caisse d'équipe (bonus)
    | "jail" // Le Frigo — piège : pion gelé après un no-show
    | "gotojail" // Zone morte — piège : renvoie au Frigo
    | "parking" // Le Labyrinthe — piège sans effet

export interface BoardCell {
    index: number
    kind: CellKind
    name: string
}

/** Un déplacement calculé à partir d'un événement CRM réel. */
export interface MoveLog {
    eventId: string
    playerId: string
    /** Libellé du type d'événement (ex. "RDV physique achat"). */
    eventLabel: string
    dice: [number, number]
    from: number
    to: number
    points: number
    passedStart: boolean
    sentToJail: boolean
    date: string
}

export interface TourneePlayer {
    id: string
    name: string
    avatarUrl: string | null
    /** Classe Tailwind de couleur du pion. */
    color: string
    position: number
    inJail: boolean
    points: number
    /** Loyers perçus quand d'autres joueurs tombent sur ses cases. */
    rents: number
    rdvCount: number
    showCount: number
    noShowCount: number
    appelCount: number
    lapsCompleted: number
}

/** Défi quotidien — tiré au sort de façon déterministe depuis la date. */
export interface ChallengeDef {
    id: string
    label: string
    description: string
    bonus: number
    /** Vrai si les événements du jour d'UN joueur remplissent le défi. */
    test: (todayEvents: TourneeEventRow[]) => boolean
}

export interface ChallengeState {
    def: ChallengeDef
    /** Ids des joueurs qui ont rempli le défi aujourd'hui. */
    completedBy: string[]
}

export interface TourneeGame {
    players: TourneePlayer[]
    /** index de case → id du joueur propriétaire. */
    ownership: Record<number, string>
    moves: MoveLog[]
    challenges: ChallengeState[]
    periodLabel: string
}
