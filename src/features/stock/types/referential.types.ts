/**
 * Types référentiels — données stables partagées entre tous les domaines.
 * Correspondent au ReferentialContext.
 */

export interface Fournisseur {
    id:                 string
    name:               string
    siege_localisation: string
    tag:                string
    created_at:         string
}

export interface BalleCategory {
    id:          string
    name:        string
    tag:         string
    unit_price:  number
    unit_weight: number
}

/** Distribution de catégories dans une livraison */
export interface CategoryDistribution {
    category_id: string
    count:       number
}