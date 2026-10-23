// Contrats TypeScript du domaine « catégorie de wiki ».
// Les catégories forment une arborescence de profondeur arbitraire
// (parent_id auto-référent).

export interface WikiCategory {
    id: string
    parent_id: string | null
    name: string
    position: number
    created_at: string
}

export interface WikiCategoryFormInput {
    name: string
    parent_id?: string | null
    position?: number
}

/** Catégorie enrichie de ses enfants (arborescence construite côté front). */
export interface WikiCategoryNode extends WikiCategory {
    children: WikiCategoryNode[]
}

/** Catégorie aplatie avec sa profondeur (pour les <select> indentés). */
export interface WikiCategoryFlat {
    category: WikiCategory
    depth: number
}

/**
 * Une catégorie déplacée : nouveau parent + nouveau rang dans la fratrie.
 * Contrat de la RPC `wiki_reorder_categories`.
 */
export interface WikiCategoryMove {
    id: string
    parent_id: string | null
    position: number
}
