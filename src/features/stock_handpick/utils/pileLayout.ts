/**
 * Disposition des balles d'un emplacement dans le plan 3D : rangées en
 * longueur d'abord, puis empilées — jamais plus de 3 de long × 3 de haut.
 *
 * Un sac dessiné vaut `BALES_PER_BAG` balles : un emplacement plein compte
 * 18 à 25 balles, et c'est là que la pile atteint 3 × 3. Au-delà de
 * `PILE_CAPACITY`, l'emplacement est sur-rempli : la scène affiche le total
 * dans une pastille.
 */

export const PILE_MAX_COLS = 3
export const PILE_MAX_LAYERS = 3
export const PILE_MAX = PILE_MAX_COLS * PILE_MAX_LAYERS

/** Balles représentées par un sac dessiné. */
export const BALES_PER_BAG = 2

/** Contenance d'un emplacement plein : au-delà, pastille « ×n ». */
export const PILE_CAPACITY = 25

export interface PileSlot {
    /** Position en longueur, centrée sur 0, en pas de balle : -1, -0.5, 0, 0.5, 1. */
    col: number
    /** Couche, 0 = posée sur l'étagère ou le sol. */
    layer: number
}

/** Nombre de sacs dessinés pour `count` balles réelles. */
export function bagsFor(count: number): number {
    return Math.min(PILE_MAX, Math.ceil(Math.max(0, count) / BALES_PER_BAG))
}

export function pileSlots(count: number): PileSlot[] {
    const shown = bagsFor(count)
    const slots: PileSlot[] = []
    for (let layer = 0; layer * PILE_MAX_COLS < shown; layer++) {
        const inLayer = Math.min(PILE_MAX_COLS, shown - layer * PILE_MAX_COLS)
        for (let i = 0; i < inLayer; i++) {
            slots.push({ col: i - (inLayer - 1) / 2, layer })
        }
    }
    return slots
}
