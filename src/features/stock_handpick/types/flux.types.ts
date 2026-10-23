import type { CategoryHandpick, FournisseurHandpick } from "./referential.types"

/**
 * Flux du stock handpick — arrivages et départs.
 *
 * Deux niveaux, comme le tableau des arrivages du stock principal :
 *
 *   FluxHandpick        1 ─── n   MouvementHandpick
 *   (l'expédition :               (sa liste de colisage :
 *    conteneur, dates,             balles et vrac,
 *    fournisseur, facture)         quantités, prix)
 *
 * Le module confondait les deux : le tableau « Arrivages » listait les
 * mouvements, si bien qu'un conteneur de 40 balles s'y lisait comme 40
 * arrivages. L'en-tête porte désormais tout ce qui décrit l'expédition, la
 * ligne tout ce qui décrit son contenu.
 *
 * Arrivages et départs sont deux lectures de la même table, filtrées sur
 * `direction`.
 */

export type MouvementDirection = "in" | "out"

export type QuantityUnit = "kg" | "pieces"



/**
 * Cycle de vie d'une expédition, repris du stock principal. Pour un DÉPART, les
 * libellés se lisent : planifié → en_transit (expédié) → reçu (livré) ;
 * `déchargé` ne concerne que les arrivages.
 */
export type FluxStatus = "planifié" | "en_transit" | "déchargé" | "reçu" | "annulé"

// ─── En-tête ──────────────────────────────────────────────────────────────────

export interface FluxHandpick {
    id: string
    direction: MouvementDirection

    status: FluxStatus

    fournisseur_id: string | null

    /** Type d'expédition, en texte libre. */
    type: string | null

    /**
     * Poids saisi à la main. Prioritaire sur le poids calculé depuis les
     * lignes en kg, qui ne couvre pas les lignes comptées en pièces.
     */
    poids_kg: number | null

    departure_date: string | null
    /** Déchargement prévu, horaire compris. Date de référence du tableau. */
    prev_dechargement_at: string | null

    notes: string | null

    created_at: string
    updated_at: string
    created_by: string | null

    // Jointure résolue par le service
    fournisseur?: Pick<FournisseurHandpick, "id" | "name"> | null
}

/**
 * En-tête augmenté des totaux de sa liste de colisage, calculés par
 * `fluxHandpickService` depuis les lignes. Les totaux sont DÉRIVÉS et jamais
 * saisis : le stock principal les entre à la main faute de détail, ici le
 * détail existe.
 *
 * Deux totaux de quantité et non un : des kilos et des pièces ne s'additionnent
 * pas.
 */
export interface FluxHandpickRow extends FluxHandpick {
    lignes_count: number
    /** `poids_kg` s'il est saisi, sinon la somme des lignes en kg. */
    total_weight_kg: number
    total_qty: number
    total_value: number
}

/** Champs saisissables de l'en-tête. */
export interface FluxFormInput {
    direction: MouvementDirection
    status: FluxStatus
    fournisseur_id: string | null
    type: string | null
    poids_kg: number | null
    departure_date: string | null
    prev_dechargement_at: string | null
    notes: string | null
}

// ─── Ligne de colisage ────────────────────────────────────────────────────────

export interface MouvementHandpick {
    id: string
    /** Expédition à laquelle appartient cette ligne. */
    flux_id: string

    // Objet de la ligne : soit une balle, soit du vrac par catégorie.
    balle_id: string | null
    /** Snapshot du libellé au moment de la saisie : survit à la suppression de la balle. */
    balle_label: string | null
    category_id: string | null

    quantity: number
    quantity_unit: QuantityUnit

    emplacement_from_id: string | null
    emplacement_to_id: string | null

    unit_price: number | null
    /** Colonne générée en base : `quantity * COALESCE(unit_price, 0)`. Jamais écrite. */
    total_value: number

    notes: string | null

    created_at: string
    updated_at: string
    created_by: string | null

    // Jointures résolues par le service
    category?: Pick<CategoryHandpick, "id" | "name"> | null
}

export interface MouvementFormInput {
    flux_id: string
    balle_id: string | null
    balle_label: string | null
    category_id: string | null
    quantity: number
    quantity_unit: QuantityUnit
    emplacement_from_id: string | null
    emplacement_to_id: string | null
    unit_price: number | null
    notes: string | null
}

// ─── Filtres du tableau ───────────────────────────────────────────────────────

export interface FluxFiltersState {
    status: FluxStatus | "all"
    fournisseur_id: string | "all"
    dateFrom: string | null
    dateTo: string | null
    search: string
}

export const DEFAULT_FLUX_FILTERS: FluxFiltersState = {
    status: "all",
    fournisseur_id: "all",
    dateFrom: null,
    dateTo: null,
    search: "",
}

/**
 * Date qui situe une expédition dans le temps : déchargement prévu, à défaut
 * départ. Reprend la cascade de `referenceArrivageManuel` du stock principal,
 * moins l'arrivée au port, que l'en-tête handpick ne porte pas.
 */
export function referenceFlux(
    flux: Pick<FluxHandpick, "prev_dechargement_at" | "departure_date">,
): string | null {
    return flux.prev_dechargement_at ?? flux.departure_date ?? null
}
