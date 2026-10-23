/**
 * user.ts — Profils utilisateurs et références d'ownership
 *
 * Regroupe tout ce qui concerne les utilisateurs CRM :
 * profils joints Supabase, propriétaires d'événements/clients, listes de recherche.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Profil partiel (jointures Supabase)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Référence partielle à un profil utilisateur telle que renvoyée par Supabase
 * dans les jointures (customer, closers, owner…).
 * Tous les champs sont optionnels car Supabase peut retourner un objet incomplet.
 */
export interface CRMUser {
    id?: string | null
    user_id?: string | null
    full_name?: string | null
}

/**
 * Profil utilisateur complet garanti (ligne de la table `profiles`).
 * Tous les champs sont obligatoires et non-nuls.
 */
export interface Owner {
    id: string
    user_id: string
    full_name: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Références polymorphes (string UUID ou objet partiel)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Référence à un propriétaire d'événement calendrier.
 * À l'écriture : UUID string. À la lecture (jointure) : objet CRMUser.
 */
export type EventCustomerRef = string | CRMUser | null

/**
 * @deprecated Utiliser `CRMUser` à la place.
 * Conservé pour la rétro-compatibilité avec les imports existants.
 */
export type CustomerObject = CRMUser

/**
 * @deprecated Utiliser `EventCustomerRef` à la place.
 * Conservé pour la rétro-compatibilité avec les imports existants.
 */
export type CustomerRef = string | CRMUser | null | undefined

// ─────────────────────────────────────────────────────────────────────────────
// Liste de recherche / filtres d'équipe
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Profil utilisateur minimal pour les listes de recherche et les filtres
 * par commercial (nom affiché : `name`, pas `full_name`).
 */
export interface Search {
    id: string
    user_id: string
    name: string
}
