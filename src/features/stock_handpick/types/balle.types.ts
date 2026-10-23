import type { CategoryHandpick, FournisseurHandpick } from "./referential.types"
import type { Emplacement } from "./location.types"

// Balle du stock handpick.
//
// Reprise du schéma du stock principal SANS le code BIN ni le DIN : ce module
// n'a pas d'entité livraison, et l'identité d'une balle est son UUID (affiché
// tronqué, cf. UUID_DISPLAY_LENGTH). Une passe métier viendra plus tard ; en
// V1 les seules actions sont création / modification / suppression.

/** Jeu repris du stock principal ; l'UI n'en propose qu'un sous-ensemble. */
export type BalleHandpickStatus =
    | "stocked" | "used" | "exported" | "transfered"
    | "imported" | "delivered" | "shipped"
    /** Propre au handpick : posé uniquement par `eclaterBalle`. */
    | "eclatee"

/**
 * Macro-état physique. Jeu resserré et propre au handpick (le stock principal
 * a import_bay / export_bay / tri_gros / tri_retail, liés aux conteneurs).
 *
 * Invariant, posé par la couche service et non par la base :
 * `emplacement_id` renseigné implique `location === "warehouse"`. L'inverse
 * est faux — une balle peut être en entrepôt sans adresse assignée.
 */
export type BalleHandpickLocation =
    | "warehouse" | "reception" | "tri" | "handpick" | "expedition" | "out"

export type BalleHandpickType = "push" | "bags" | "balle" | "palette" | "other"

export type PackingMode = "kilos" | "pieces"

export interface BalleHandpick {
    id: string

    // Contenu
    packing: number | null
    packing_mode: PackingMode
    import_date: string | null
    fournisseur_id: string | null
    category_id: string | null
    /** Libellé brut de la packing list, tel que reçu du fournisseur. */
    raw_name: string | null
    provenance: string | null

    // Filiation
    is_original: boolean
    parent_balle_id: string | null

    // État
    status: BalleHandpickStatus
    location: BalleHandpickLocation | null
    type: BalleHandpickType | null

    // Adresse physique
    emplacement_id: string | null
    placed_at: string | null

    // Emprunt — une balle est empruntée ssi `borrowed_by` est renseigné.
    // Emprunter la sort de son emplacement ; la rendre l'y replace.
    borrowed_by: string | null
    borrowed_at: string | null

    // Éclatement — définitif. Retire la balle du stock sans la supprimer,
    // pour les stats. `is_eclatee` ⇔ `status === "eclatee"` (CHECK en base).
    is_eclatee: boolean
    eclatee_at: string | null
    eclatee_by: string | null
    /**
     * Nom de l'usine figé à l'éclatement (trigger). Seul repère restant
     * quand l'usine a été supprimée depuis : `fournisseur_id` est alors NULL.
     */
    fournisseur_label: string | null

    // Valorisation
    purchase_price: number | null
    treatment_cost: number | null
    notes: string | null

    created_at: string
    updated_at: string
    created_by: string | null

    // Jointures (présentes selon le SELECT du service)
    fournisseur?: Pick<FournisseurHandpick, "id" | "name" | "siege_localisation"> | null
    category?: Pick<CategoryHandpick, "id" | "name"> | null
    emplacement?: Pick<Emplacement, "id" | "code" | "zone_id"> | null
}

/**
 * Champs saisissables. Les timestamps et `created_by` sont posés en base ;
 * les jointures ne sont jamais écrites.
 */
export interface BalleHandpickFormInput {
    packing: number | null
    packing_mode: PackingMode
    import_date: string | null
    fournisseur_id: string | null
    category_id: string | null
    raw_name: string | null
    provenance: string | null
    is_original: boolean
    parent_balle_id: string | null
    status: BalleHandpickStatus
    location: BalleHandpickLocation | null
    type: BalleHandpickType | null
    emplacement_id: string | null
    purchase_price: number | null
    treatment_cost: number | null
    notes: string | null
}

/** `"all"` = pas de filtre, pour que le select ait toujours une valeur. */
export interface BalleHandpickFiltersState {
    status: BalleHandpickStatus | "all"
    location: BalleHandpickLocation | "all"
    type: BalleHandpickType | "all"
    fournisseur_id: string | "all"
    category_id: string | "all"
    emplacement_id: string | "all"
    /**
     * Où la balle est stockée : `all`, une clé de lieu (`B`, `B/R2`,
     * `B/R2/E3`…), `borrowed` (empruntées) ou `unplaced` (sans emplacement).
     * Voir `utils/placeGroups.ts`.
     */
    place: string
    dateFrom: string | null
    dateTo: string | null
}

export const DEFAULT_BALLE_HANDPICK_FILTERS: BalleHandpickFiltersState = {
    status: "all",
    location: "all",
    type: "all",
    fournisseur_id: "all",
    category_id: "all",
    emplacement_id: "all",
    place: "all",
    dateFrom: null,
    dateTo: null,
}

// ─── Historique d'emplacement ─────────────────────────────────────────────────

/**
 * Nature d'une ligne d'historique, déduite par le trigger
 * `log_balle_emplacement_handpick` : l'emprunt prime sur le simple
 * déplacement, puisqu'emprunter vide aussi l'emplacement.
 */
export type BalleEmplacementEventType =
    | "placed" | "moved" | "removed" | "borrowed" | "returned"

/**
 * Une ligne de `balles_emplacements_handpick`. Écrite uniquement par trigger.
 * Les chemins sont un instantané pris au moment du mouvement : ils restent
 * lisibles si l'emplacement est renommé ou supprimé depuis.
 */
export interface BalleEmplacementEvent {
    id: string
    balle_id: string
    event: BalleEmplacementEventType
    emplacement_from_id: string | null
    emplacement_to_id: string | null
    from_path: string | null
    to_path: string | null
    user_id: string | null
    created_at: string
}
