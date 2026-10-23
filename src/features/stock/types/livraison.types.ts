/**
 * Types du domaine Livraison.
 * Correspondent au DeliveryContext.
 */

import type { BalleType }            from "./balle.types"
import type { Fournisseur, CategoryDistribution } from "./referential.types"

// ─── Entity ───────────────────────────────────────────────────────────────────

export interface Delivery {
    id:            string
    din:           string
    fournisseur_id?: string
    delivery_date?: string
    delivery_type?: BalleType
    balles_count?:  number
    poids_moyen?:   number
    packing?:       string
    created_by:     string
    created_at:     string

    // Jointure
    fournisseur?: Pick<Fournisseur, "name" | "siege_localisation"> | null
}

// ─── Form ─────────────────────────────────────────────────────────────────────

export interface DeliveryFormInput {
    din:            string
    fournisseur_id: string
    delivery_date?: string
    delivery_type?: BalleType
    packing?:       string
    balles_count?:  number
    poids_moyen?:   number
    distributions?: CategoryDistribution[]
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export interface DeliveryFiltersState {
    fournisseur_id: string   // "all" | id
    type:           string   // "all" | BalleType
    dateFrom:       string
    dateTo:         string
    ballsCountMin:  string
    ballsCountMax:  string
}

export const DEFAULT_DELIVERY_FILTERS: DeliveryFiltersState = {
    fournisseur_id: "all",
    type:           "all",
    dateFrom:       "",
    dateTo:         "",
    ballsCountMin:  "",
    ballsCountMax:  "",
}
