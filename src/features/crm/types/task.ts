/**
 * task.ts — Tâches CRM
 *
 * Regroupe les tâches, leurs statuts, et les filtres de la page tâches.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Référence client dans une tâche
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Référence courte à un client telle que renvoyée par Supabase
 * dans les jointures de tâche (`select("*, client(id, nom)")`).
 */
export interface ClientType {
    id: string
    nom: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Tâche
// ─────────────────────────────────────────────────────────────────────────────

export interface Tache {
    id: string
    type: string
    /** UUID string en base, objet complet après jointure. */
    client: string | ClientType | null
    content: string | null
    date: string | null
    valide?: boolean | null
    owner?: string | null
    placement?: string | null
    /** "crm" ou "insta" — sous-menu d'origine du type choisi. */
    categorie?: string | null
    /** Rôle du owner, jointure en lecture seule (voir tacheService). */
    owner_role?: { role: { nom: string } | null } | null
    /** Qui a créé la tâche (distinct de owner = à qui elle est assignée). */
    creator_id?: string | null
    /** Rôle du créateur, jointure en lecture seule (voir tacheService). */
    creator_role?: { role: { nom: string } | null } | null
}

/**
 * Type pour l'insertion en base.
 * `id` est généré par la DB, `client` est un UUID string ou null (colonne
 * nullable — une tâche n'est pas obligatoirement liée à un client).
 */
export type TacheInsert = Omit<
    Tache,
    "id" | "client" | "owner_role" | "creator_role"
> & {
    client: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtres de la page Tâches
// ─────────────────────────────────────────────────────────────────────────────

/** Filtre d'affichage de la liste des tâches. */
export type FilterType = "today" | "venir" | "retard" | "tout" | "assignees"
