/**
 * Types du domaine Historique.
 * Alimentés par les triggers Supabase sur balles_gestion,
 * deliveries_gestion, categories_gestion, fournisseur_gestion, la salle de
 * tri (RPC `save_fiche_tri`, trieurs) et la salle de commande (commandes,
 * livraisons boutiques, cartons).
 */

export type ViewMode = "journal" | "analyse" | "prix"

export type ActivityEntityType =
    | "balle" | "delivery" | "category" | "fournisseur" | "arrivage"
    // Salle de tri (20261001100000) et salle de commande (20261001110000).
    | "fiche_tri" | "trieur" | "commande" | "livraison_boutique" | "carton"
export type ActivityAction     = "create" | "update" | "delete"

export interface ActivityLog {
    id:           string
    created_at:   string
    user_id:      string | null
    entity_type:  ActivityEntityType
    entity_id:    string | null
    entity_label: string | null
    action:       ActivityAction
    description:  string | null
    changes:      Record<string, unknown> | null
}

export interface CategoryPriceHistory {
    id:            string
    created_at:    string
    category_id:   string
    category_name: string | null
    user_id:       string | null
    old_price:     number | null
    new_price:     number
}

export interface LogGroup {
    key:          string
    action:       ActivityAction
    entity_type:  ActivityEntityType
    user_id:      string | null
    count:        number
    logs:         ActivityLog[]
    created_at:   string
    entity_label: string | null
    description:  string | null
}

export interface ChartDataPoint {
    date: string
    [k: string]: string | number
}

export const ENTITY_LABEL: Record<ActivityEntityType, string> = {
    balle:       "Balle",
    delivery:    "Livraison",
    category:    "Catégorie",
    fournisseur: "Fournisseur",
    arrivage:    "Arrivage",
    fiche_tri:          "Fiche de tri",
    trieur:             "Trieur",
    commande:           "Commande",
    livraison_boutique: "Livraison boutique",
    carton:             "Carton",
}

export const ACTION_LABEL: Record<ActivityAction, string> = {
    create: "Créé",
    update: "Modifié",
    delete: "Supprimé",
}
