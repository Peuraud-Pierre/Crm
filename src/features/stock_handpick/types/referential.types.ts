// Référentiel du stock handpick : fournisseurs, catégories, et la liaison
// many-to-many entre les deux (table `fournisseurs_categories_handpick`).

export interface FournisseurHandpick {
    id: string
    name: string
    siege_localisation: string | null
    /** Code court d'affichage. */
    tag: string | null
    notes: string | null
    /**
     * Les FK des balles sont en ON DELETE RESTRICT : un fournisseur utilisé ne
     * peut pas être supprimé. On le désactive — il disparaît des selects sans
     * perdre la trace des achats passés.
     */
    is_active: boolean
    created_at: string
    updated_at: string
    created_by: string | null
}

export interface CategoryHandpick {
    id: string
    name: string
    tag: string | null
    /** Prix au kilo. */
    is_active: boolean
    created_at: string
    updated_at: string
    created_by: string | null
}

/** Une ligne de `fournisseurs_categories_handpick`. */
export interface FournisseurCategoryLink {
    fournisseur_id: string
    category_id: string
    created_at: string
}

/** Catégorie telle qu'affichée dans un select de formulaire. */
export type CategoryOption = Pick<
    CategoryHandpick,
    "id" | "name" | "tag"
>

/**
 * Fournisseur enrichi de ses catégories autorisées. C'est cette forme que
 * consomme la saisie d'une balle : choisir un fournisseur restreint la liste
 * des catégories proposées, en miroir du trigger
 * `balles_handpick_check_fournisseur_category`.
 */
export interface FournisseurWithCategories extends FournisseurHandpick {
    categories: CategoryOption[]
}

export interface FournisseurHandpickFormInput {
    name: string
    siege_localisation: string | null
    tag: string | null
    notes: string | null
    is_active: boolean
    /** Catégories rattachées — écrites dans la table de liaison, pas la table fournisseur. */
    category_ids: string[]
}

export interface CategoryHandpickFormInput {
    name: string
    tag: string | null
    unit_price: number | null
    unit_weight: number | null
    is_active: boolean
}
