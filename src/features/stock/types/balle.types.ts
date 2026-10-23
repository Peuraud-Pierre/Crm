/**
 * Types du domaine Balle.
 * Correspondent au BalleContext.
 */

import type { Fournisseur, BalleCategory } from "./referential.types"

// ─── Enums ────────────────────────────────────────────────────────────────────

export type BalleStatus =
    | "stocked"
    | "used"
    | "exported"
    | "transfered"
    | "imported"
    | "delivered"
    | "shipped"

export type BalleLocation =
    | "warehouse"
    | "out"
    | "import_bay"
    | "export_bay"
    | "tri_gros"
    | "tri_retail"
    | "handpick"

export type BalleType   = "push" | "bags" | "balle" | "palette" | "other"
export type PackingMode = "kilos" | "pieces"

// ─── Entities ─────────────────────────────────────────────────────────────────

export interface Historique {
    id:         string
    type:       string
    date:       string
    user:       string
    details:    string
    created_at: string
}

export interface Balle {
    // Système
    id:         string
    created_at: string
    created_by: string
    updated_at?: string
    bin:        string
    delivery_id?: string

    // Métier
    packing:        number
    import_date:    string
    fournisseur_id: string
    category_id:    string
    raw_name?:      string   // description brute issue de la packing list
    provenance?:    string
    is_original:    boolean
    parent_balle_id?: string
    status?:   BalleStatus
    location?: BalleLocation
    type?:     BalleType

    // Finances
    purchase_price?: number   // prix figé à la création (packing × unit_price du moment)
    treatment_cost?: number   // coût de traitement post-import (colonne DB à venir)

    // Jointures
    fournisseur?: Pick<Fournisseur, "name" | "siege_localisation"> | null
    category?:    Pick<BalleCategory, "name"> & { poids_unitaire: number } | null
    historique?:  Historique[]
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export interface BalleFormInput {
    bin:            string
    fournisseur_id: string
    category_id:    string
    delivery_id:    string
    raw_name?:      string
    packing?:       number
    purchase_price?: number
    treatment_cost?: number
    import_date?:   string       // "YYYY-MM-DDTHH:mm"
    provenance?:    string
    location?:      BalleLocation
    type?:          BalleType
    is_original?:   boolean
    status?:        string
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface BalleFiltersState {
    status:         string   // "all" | BalleStatus
    type:           string   // "all" | BalleType
    location:       string   // "all" | BalleLocation
    category_id:    string   // "all" | id
    fournisseur_id: string   // "all" | id
    dateFrom:       string
    dateTo:         string
}

export const DEFAULT_BALLE_FILTERS: BalleFiltersState = {
    status:         "all",
    type:           "all",
    location:       "all",
    category_id:    "all",
    fournisseur_id: "all",
    dateFrom:       "",
    dateTo:         "",
}
