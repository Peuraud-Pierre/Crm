/**
 * activity.ts — Activités et historique client
 *
 * Regroupe les entrées de journal d'activité liées à un client :
 * notes, appels, rendez-vous passés, etc.
 */

import type { CRMUser } from "./user"
import type { Event_creation } from "./calendar"

// ─────────────────────────────────────────────────────────────────────────────
// Activité
// ─────────────────────────────────────────────────────────────────────────────

export interface activites {
    id: string
    client: string
    date: string
    created_at?: string
    title?: string
    content?: string
    /** Événement calendrier lié (optionnel). */
    rdv?: Event_creation
    /** Propriétaire de l'activité (UUID ou profil joint). */
    owner?: string | CRMUser
}

export type ActiviteInput = Partial<activites> & { client: string }
