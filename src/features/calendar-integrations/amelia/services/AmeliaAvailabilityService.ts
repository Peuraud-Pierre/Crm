/**
 * Service de gestion de la disponibilité des commerciaux via le bridge Go.
 *
 * Source de vérité : Supabase (tables amelia_availability_*). Le bridge écrit
 * Supabase puis pousse le planning vers Amelia. Le CRM ne tape jamais Amelia
 * directement.
 *
 * Endpoints bridge (auth X-Bridge-Key + Bearer JWT) :
 *   - GET /crm/availability?userId=...  → planning d'un commercial
 *   - PUT /crm/availability             → remplace le planning (+ push Amelia)
 *
 * Convention dayOfWeek : ISO 1=lundi … 7=dimanche.
 */

import { env } from "@/shared/lib/env"

const BRIDGE_URL = env.PUBLIC_VITE_BRIDGE_URL || ""
const BRIDGE_KEY = env.PUBLIC_VITE_BRIDGE_KEY || ""

export interface WeeklySlot {
    dayOfWeek: number // 1..7 (ISO)
    start: string // "HH:MM"
    end: string // "HH:MM"
}

export interface DayOff {
    day: string // "YYYY-MM-DD"
    name?: string
}

export interface SpecialDay {
    day: string // "YYYY-MM-DD"
    start: string // "HH:MM"
    end: string // "HH:MM"
}

/** Période de fermeture d'entreprise (plage continue). Entreprise uniquement. */
export interface ClosurePeriod {
    startDate: string // "YYYY-MM-DD"
    endDate: string // "YYYY-MM-DD"
    name?: string
}

export interface AvailabilityPayload {
    /** user_id Supabase ciblé. Omis = sa propre dispo (l'appelant). */
    userId?: string
    weekly: WeeklySlot[]
    daysOff: DayOff[]
    special: SpecialDay[]
    /** Périodes de fermeture (canal entreprise uniquement). */
    closures?: ClosurePeriod[]
}

class AmeliaAvailabilityService {
    private get isConfigured(): boolean {
        return Boolean(BRIDGE_URL && BRIDGE_KEY)
    }

    private headers(jwt: string): HeadersInit {
        return {
            "Content-Type": "application/json",
            "X-Bridge-Key": BRIDGE_KEY,
            Authorization: `Bearer ${jwt}`,
        }
    }

    async get(jwt: string, userId?: string): Promise<AvailabilityPayload> {
        if (!this.isConfigured) {
            throw new Error("VITE_BRIDGE_URL / VITE_BRIDGE_KEY manquants")
        }
        const qs = userId ? `?userId=${encodeURIComponent(userId)}` : ""
        const res = await fetch(`${BRIDGE_URL}/crm/availability${qs}`, {
            headers: this.headers(jwt),
        })
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${await res.text()}`)
        }
        return res.json()
    }

    /** Remplace intégralement le planning et déclenche le push Amelia côté bridge. */
    async save(
        jwt: string,
        payload: AvailabilityPayload
    ): Promise<{ saved: boolean; pushedToAmelia: boolean }> {
        if (!this.isConfigured) {
            throw new Error("VITE_BRIDGE_URL / VITE_BRIDGE_KEY manquants")
        }
        const res = await fetch(`${BRIDGE_URL}/crm/availability`, {
            method: "PUT",
            headers: this.headers(jwt),
            body: JSON.stringify(payload),
        })
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${await res.text()}`)
        }
        return res.json()
    }

    /**
     * Re-push groupé : ré-applique la dispo individuelle (Supabase) de tous les
     * commerciaux mappés vers Amelia. Admin only. Sert à réparer/resynchroniser.
     */
    async resyncAllAvailability(
        jwt: string
    ): Promise<{ pushed: number; skipped: number; failed: number; total: number }> {
        if (!this.isConfigured) {
            throw new Error("VITE_BRIDGE_URL / VITE_BRIDGE_KEY manquants")
        }
        const res = await fetch(`${BRIDGE_URL}/crm/availability/resync-all`, {
            method: "POST",
            headers: this.headers(jwt),
        })
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${await res.text()}`)
        }
        return res.json()
    }

    /** Jours de fermeture d'entreprise (globaux, Admin only). */
    async getCompany(jwt: string): Promise<AvailabilityPayload> {
        if (!this.isConfigured) {
            throw new Error("VITE_BRIDGE_URL / VITE_BRIDGE_KEY manquants")
        }
        const res = await fetch(`${BRIDGE_URL}/crm/company-availability`, {
            headers: this.headers(jwt),
        })
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${await res.text()}`)
        }
        return res.json()
    }

    /**
     * Remplace les jours de fermeture d'entreprise et les pousse au réglage GLOBAL
     * Amelia (amelia_settings.daysOff). `ameliaUpdated` indique si le push a réussi.
     */
    async saveCompany(
        jwt: string,
        payload: Omit<AvailabilityPayload, "userId">
    ): Promise<{ saved: boolean; ameliaUpdated: boolean; pushError?: string }> {
        if (!this.isConfigured) {
            throw new Error("VITE_BRIDGE_URL / VITE_BRIDGE_KEY manquants")
        }
        const res = await fetch(`${BRIDGE_URL}/crm/company-availability`, {
            method: "PUT",
            headers: this.headers(jwt),
            body: JSON.stringify(payload),
        })
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${await res.text()}`)
        }
        return res.json()
    }
}

export const ameliaAvailabilityService = new AmeliaAvailabilityService()
