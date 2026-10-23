/**
 * Plateau de La Tournée : 24 cases sur le périmètre d'une grille
 * RECTANGULAIRE 8×6, façon jeu de l'oie (parcours + cases pièges aux coins).
 *
 * Numérotation dans le sens du jeu :
 *   0  = Départ (coin bas-droite), ligne du bas vers la gauche,
 *   7  = Le Frigo (coin bas-gauche) — piège : on y gèle après un no-show,
 *   12 = Le Labyrinthe (coin haut-gauche) — piège administratif,
 *   19 = Zone morte (coin haut-droite) — piège : renvoie au Frigo,
 *   puis on redescend la colonne droite.
 */
import type { BoardCell } from "../types"

export const BOARD_SIZE = 24
export const BOARD_COLS = 8
export const BOARD_ROWS = 6
export const START_INDEX = 0
/** Le Frigo : un no-show y gèle le pion (lead refroidi). */
export const JAIL_INDEX = 7
/** Zone morte : s'y arrêter renvoie au Frigo. */
export const GO_TO_JAIL_INDEX = 19

export const BOARD_CELLS: BoardCell[] = [
    { index: 0, kind: "start", name: "Départ" },
    { index: 1, kind: "property", name: "Rue des Leads froids" },
    { index: 2, kind: "chance", name: "Boost" },
    { index: 3, kind: "station", name: "Canal Instagram" },
    { index: 4, kind: "property", name: "Rue du Cold Call" },
    { index: 5, kind: "property", name: "Avenue du Suivi" },
    { index: 6, kind: "property", name: "Bd des Relances" },
    { index: 7, kind: "jail", name: "Le Frigo" },
    { index: 8, kind: "property", name: "Rue du Pipeline" },
    { index: 9, kind: "station", name: "Canal Referral" },
    { index: 10, kind: "community", name: "Caisse d'équipe" },
    { index: 11, kind: "property", name: "Av. des RDV Visio" },
    { index: 12, kind: "parking", name: "Le Labyrinthe" },
    { index: 13, kind: "property", name: "Rue de la Découverte" },
    { index: 14, kind: "chance", name: "Boost" },
    { index: 15, kind: "station", name: "Canal Ads" },
    { index: 16, kind: "property", name: "Avenue du Closing" },
    { index: 17, kind: "property", name: "Boulevard du Show" },
    { index: 18, kind: "community", name: "Caisse d'équipe" },
    { index: 19, kind: "gotojail", name: "Zone morte" },
    { index: 20, kind: "property", name: "Av. des Clients VIP" },
    { index: 21, kind: "station", name: "Canal Site Web" },
    { index: 22, kind: "property", name: "Rue du Panier Moyen" },
    { index: 23, kind: "property", name: "Avenue du Sommet" },
]

/** Cases pouvant être possédées (rues + canaux). */
export const OWNABLE_KINDS = new Set(["property", "station"])

/** Index des cases de coin (Départ + les trois pièges). */
export const CORNER_INDICES = new Set([
    START_INDEX,
    JAIL_INDEX,
    12,
    GO_TO_JAIL_INDEX,
])

/**
 * Coordonnées CSS grid (1-based) d'une case sur la grille 8×6.
 * Retourne { row, col } à utiliser en style inline (gridRow/gridColumn).
 */
export function cellGridPosition(index: number): { row: number; col: number } {
    if (index <= 7) return { row: BOARD_ROWS, col: BOARD_COLS - index }
    if (index <= 11) return { row: BOARD_ROWS - (index - 7), col: 1 }
    if (index <= 19) return { row: 1, col: index - 11 }
    return { row: index - 18, col: BOARD_COLS }
}
