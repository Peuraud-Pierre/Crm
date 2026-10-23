/**
 * calendar.ts — Événements calendrier et vues
 *
 * Regroupe les types liés au module calendrier : événements,
 * vues disponibles, colonnes de propriétaires (DayView).
 */

import type { Client } from "./client"
import type { EventCustomerRef } from "./user"

// ─────────────────────────────────────────────────────────────────────────────
// Vues calendrier
// ─────────────────────────────────────────────────────────────────────────────

export type CalendarView = "day" | "week" | "month" | "year"

export type EventTypeDef = {
    value: string
    label: string
    color: string
    btnColor: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Événement
// ─────────────────────────────────────────────────────────────────────────────

export interface Event_creation {
    id?: string
    owner?: string | null
    /** Nature du RDV : "rdv physique achat", , "appel", etc. */
    nom?: string | null
    id_client?: string | null
    /** Fiche client complète (jointure). */
    clientProfile?: Client | null
    debut: string
    fin: string | Date
    mail?: string[] | null
    participants: string | null
    lieu: string | null
    description: string | null
    /** Nom du participant (champ legacy). */
    client?: string | null
    customer?: EventCustomerRef
    creator_id?: string | null
    show?: boolean | null
    /** false = RDV Amelia en attente de confirmation (hors agenda). */
    confirmed?: boolean | null
    created_at?: string | null
    why?: string | null
}

/** Plage [from, to[ (ISO) chargée par l'agenda, sur `debut`. */
export interface EventDateRange {
    from: string
    to: string
}

// ─────────────────────────────────────────────────────────────────────────────
// DayView — regroupement par propriétaire
// ─────────────────────────────────────────────────────────────────────────────

export interface OwnerColumn {
    id: string
    ownerName: string
    events: Event_creation[]
}

/**
 * components/types.ts — Barrel de re-export (rétro-compatibilité)
 *
 * Les types domain sont dans @/features/crm/types.
 * Les constantes et utilitaires calendrier sont dans @/features/crm/utils/calendarConstants.
 * Le hook useCreateEventLogic est dans @/features/crm/hooks/CRM_hook/useCreateEventLogic.
 *
 * Ce fichier re-exporte tout pour que les imports existants dans les composants
 * Calendar continuent de fonctionner sans modification.
 */
// ── Constantes et utilitaires calendrier ─────────────────────────────────────
export {
    EVENT_TYPES,
    START_HOUR,
    END_HOUR,
    HOUR_HEIGHT,
    TIME_GRID_ARRAY,
    TIME_SLOTS,
    WEEKDAYS,
    safeDate,
    timeToMinutes,
    minutesToTime,
    getEventTheme,
    pendingEventClass,
    pendingDotClass,
} from "@/features/crm/utils/calendarConstants"

// ── Hook ─────────────────────────────────────────────────────────────────────
export { useCreateEventLogic } from "@/features/crm/hooks/CRM_hook/useCreateEventLogic"

// ── Types dérivés du hook ────────────────────────────────────────────────────
import { type useCreateEventLogic } from "@/features/crm/hooks/CRM_hook/useCreateEventLogic"
export type CreateEventLogic = ReturnType<typeof useCreateEventLogic>
export type FormData = CreateEventLogic["formData"]
