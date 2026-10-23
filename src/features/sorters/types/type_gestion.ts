// Type hérité de l'ancienne feature `gestion` (renommée `stock`). La feature
// sorters n'est plus routée (routes commentées dans app/routes), mais son code
// doit rester compilable. Ce type reflète la forme des objets « balle / colis »
// tels que consommés par les composants manager_trie et Manage_Sorter — il est
// volontairement distinct de `@/features/stock/types` (forme différente).
export interface Balle {
    id: string
    category?: string | null
    receiption_date?: string | null
    fournisseur?: { name?: string | null } | null
    unit?: string | null
    weight?: number | null
    piece?: number | null
    assigned_to?: { full_name?: string | null; user_id?: string | null } | null
}
