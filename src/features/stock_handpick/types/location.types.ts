// Modèle de localisation — plan de l'entrepôt handpick.
//
// Aucune UI de plan n'existe en V1 : ces types décrivent le modèle de données
// posé dès maintenant (migration 20260914142000) pour qu'un futur éditeur 2D
// s'y branche sans migration lourde.
//
// Deux niveaux seulement, et c'est délibéré :
//   • ZoneNode    = conteneur (zone / allée / étagère), arbre libre
//   • Emplacement = FEUILLE, seule adresse qu'une balle peut porter

export type ZoneKind = "zone" | "allee" | "etagere"

/**
 * Géométrie destinée au futur canvas, relative au parent.
 * `null` = pas encore positionné — un état que l'éditeur présentera dans une
 * palette « à placer », là où un 0 par défaut aurait empilé tous les
 * rectangles à l'origine.
 */
export interface PlanRect {
    pos_x: number | null
    pos_y: number | null
    width: number | null
    height: number | null
}

export interface ZoneNode extends PlanRect {
    id: string
    parent_id: string | null
    kind: ZoneKind
    /** Code relatif au parent : « A », « 01 », « 3 ». */
    code: string
    label: string | null
    rotation: number
    /** Couleur hexadécimale (#RRGGBB) ou null. */
    color: string | null
    sort_order: number
    is_active: boolean
    created_at: string
    updated_at: string
    created_by: string | null
}

export interface Emplacement extends PlanRect {
    id: string
    zone_id: string
    code: string
    label: string | null
    /** Nombre de balles maximum. Informatif : aucune contrainte ne l'impose. */
    capacity: number | null
    is_active: boolean
    notes: string | null
    created_at: string
    updated_at: string
    created_by: string | null
}

/**
 * Arbre assemblé côté client à partir des deux listes plates. Aucune requête
 * récursive n'est faite en base : le volume d'un plan d'entrepôt tient en
 * mémoire, et un `WITH RECURSIVE` par écran serait payé pour rien.
 */
export interface ZoneTreeNode extends ZoneNode {
    children: ZoneTreeNode[]
    emplacements: Emplacement[]
}

/**
 * Chemin lisible d'un emplacement, calculé depuis l'arbre.
 * Pas de colonne dénormalisée en base : elle exigerait de recalculer toute la
 * descendance à chaque renommage de zone.
 */
export interface EmplacementPath {
    emplacement_id: string
    /** Du plus général au plus précis : ["A", "01", "3", "P02"]. */
    segments: string[]
    /** Segments joints par EMPLACEMENT_PATH_SEPARATOR. */
    full_code: string
}

/** Emplacement tel qu'affiché dans un select plat (Inventaire). */
export interface EmplacementOption {
    id: string
    full_code: string
    /** Du plus général au plus précis : ["B", "R2", "E3", "H1"]. */
    segments: string[]
    is_active: boolean
}

export interface ZoneFormInput {
    parent_id: string | null
    kind: ZoneKind
    code: string
    label: string | null
    color: string | null
    sort_order: number
    is_active: boolean
}

export interface EmplacementFormInput {
    zone_id: string
    code: string
    label: string | null
    capacity: number | null
    notes: string | null
    is_active: boolean
}
