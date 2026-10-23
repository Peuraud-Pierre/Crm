import type { CSSProperties } from "react"
import { GRID_COLS, GRID_GAP, ROW_UNIT } from "../constants"
import type { Rect } from "./gridEngine"

/**
 * Conversion entre unités de grille et pixels.
 *
 * Séparée du moteur : celui-ci ne raisonne qu'en colonnes et en lignes,
 * et n'a donc rien à savoir de la largeur de la fenêtre. Tout ce qui
 * dépend de l'écran est ici.
 *
 * Tout ce qui sort d'ici est en **pixels entiers**. La largeur d'une
 * colonne est fractionnaire par construction — douze colonnes et onze
 * gouttières tombent rarement rond —, et une bordure d'un pixel posée sur
 * une coordonnée fractionnaire est rendue sur deux pixels physiques à
 * demi-opacité : c'est du flou, sur chaque carte, en permanence. On
 * arrondit donc les **bords** puis on en déduit la taille ; arrondir la
 * taille seule ferait dériver les gouttières de colonne en colonne.
 */

/** Largeur d'une colonne, gouttières déduites. Fractionnaire. */
export function columnWidth(canvasWidth: number): number {
    return (canvasWidth - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS
}

/** Abscisse du bord gauche de la colonne `col`, en pixels entiers. */
export function columnEdge(col: number, colWidth: number): number {
    return Math.round(col * (colWidth + GRID_GAP))
}

/** Ordonnée du bord haut de la ligne `row`. Entière par construction. */
export function rowEdge(row: number): number {
    return row * (ROW_UNIT + GRID_GAP)
}

/**
 * Position et taille absolues d'un module, en pixels entiers.
 *
 * `left`/`top` et **non** `transform`, malgré le coût : animer la
 * position en `left`/`top` déclenche un recalcul de mise en page à chaque
 * frame, là où une translation serait prise en charge par le compositeur.
 * La tentation est donc réelle.
 *
 * **Constat de terrain** : composer la position de grille avec la
 * translation de dnd-kit sur cette même propriété casse le déplacement —
 * la carte résiste au pointeur et sort de la grille par la droite.
 * Essayé, constaté à l'usage, reverti.
 *
 * La cause exacte n'a **pas** été établie. La piste la plus probable est
 * que dnd-kit mesure le nœud qu'il déplace (`activeNodeRect`) et
 * soustrait du déplacement l'écart entre cette mesure et la mesure
 * initiale (`nodeRectDelta`, `core.esm.js`) : une position de grille
 * portée par la même propriété que sa translation entre dans ce calcul.
 * Cela reste une hypothèse non vérifiée au profileur.
 *
 * Si le sujet est rouvert, la voie à explorer est de **dissocier le nœud
 * mesuré du nœud positionné** — `setNodeRef` sur un conteneur qui ne
 * porte que la position de grille, la translation du geste sur un enfant
 * — et de le valider dans un navigateur avant de le livrer.
 */
export function rectStyle(rect: Rect, colWidth: number): CSSProperties {
    const left = columnEdge(rect.x, colWidth)
    const right = columnEdge(rect.x + rect.w, colWidth) - GRID_GAP

    return {
        left,
        top: rowEdge(rect.y),
        width: right - left,
        height: rect.h * ROW_UNIT + (rect.h - 1) * GRID_GAP,
    }
}

/** Hauteur du canevas pour un nombre de lignes occupées. */
export function canvasHeight(rows: number): number {
    return rows === 0 ? 0 : rows * ROW_UNIT + (rows - 1) * GRID_GAP
}

/** Déplacement en pixels converti en déplacement en cases. */
export function toGridDelta(
    deltaX: number,
    deltaY: number,
    colWidth: number
): { dx: number; dy: number } {
    return {
        dx: Math.round(deltaX / (colWidth + GRID_GAP)),
        dy: Math.round(deltaY / (ROW_UNIT + GRID_GAP)),
    }
}
