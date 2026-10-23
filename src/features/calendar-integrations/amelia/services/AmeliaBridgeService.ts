/**
 * Service appelant le bridge Go (morgane/amelia-bridge-crm) pour propager
 * les CRUD du calendrier CRM vers Amelia (WordPress).
 *
 * Le bridge requiert :
 *  - Header X-Bridge-Key : clé statique partagée (VITE_BRIDGE_KEY)
 *  - Header Authorization : Bearer <JWT Supabase> (récupéré côté hook)
 *
 * Endpoints utilisés :
 *  - POST /crm/sync-to-wp  → create / update (body WPBlockRequest)
 *  - PUT  /crm/sync-to-wp  → update (idempotent)
 *  - DELETE /crm/delete-from-wp/:id → delete
 *  - GET /crm/rebook-link?email= → lien de reprise de RDV client existant
 */

import { getAccessToken } from "../../services/calendarSessionService"

import { env } from "@/shared/lib/env"

const BRIDGE_URL = env.PUBLIC_VITE_BRIDGE_URL || ""
const BRIDGE_KEY = env.PUBLIC_VITE_BRIDGE_KEY || ""

/** Safari (« Load failed ») rejette le fetch sans réponse HTTP quand il réutilise
 *  une connexion keep-alive déjà fermée par Cloudflare, et ne rejoue jamais un
 *  PUT/POST/DELETE. On retente une seule fois sur ces TypeError réseau. Sans
 *  risque côté bridge : sync_history rend create/update idempotents. */
async function fetchOnceRetry(url: string, init: RequestInit): Promise<Response> {
    try {
        return await fetch(url, init)
    } catch (err) {
        if (!(err instanceof TypeError)) throw err
        await new Promise((r) => setTimeout(r, 500))
        return fetch(url, init)
    }
}

export type AmeliaSyncAction = "create" | "update" | "delete"

/** Infos client pour la création d'un véritable appointment Amelia. */
export interface AmeliaCustomer {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
}

export interface AmeliaSyncPayload {
    id: string
    name: string
    startDateTime: string
    endDateTime: string
    /** user_id Supabase du commercial choisi dans la modale (utilisé par le bridge
     *  pour résoudre le providerId Amelia via amelia_provider_mapping). */
    owner?: string | null
    /** Override explicite du providerId Amelia (court-circuite la résolution owner). */
    providerId?: number
    /** serviceId Amelia explicite. Si absent, le bridge le déduit de `name`
     *  (nature du RDV) ; un serviceId résolu => création d'un appointment. */
    serviceId?: number
    /** Infos client jointes lors de la création d'un appointment. */
    customer?: AmeliaCustomer
}

class AmeliaBridgeService {
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

    async syncEvent(
        action: AmeliaSyncAction,
        payload: AmeliaSyncPayload,
        jwt: string
    ): Promise<void> {
        if (!this.isConfigured) {
            console.warn(
                "[AmeliaBridge] VITE_BRIDGE_URL ou VITE_BRIDGE_KEY non défini — sync ignorée"
            )
            return
        }

        if (action === "delete") {
            const res = await fetchOnceRetry(
                `${BRIDGE_URL}/crm/delete-from-wp/${encodeURIComponent(payload.id)}`,
                {
                    method: "DELETE",
                    headers: this.headers(jwt),
                }
            )
            if (!res.ok) {
                throw new Error(
                    `Amelia delete failed: HTTP ${res.status} ${await res.text()}`
                )
            }
            return
        }

        const method = action === "create" ? "POST" : "PUT"
        const res = await fetchOnceRetry(`${BRIDGE_URL}/crm/sync-to-wp`, {
            method,
            headers: this.headers(jwt),
            body: JSON.stringify(payload),
        })
        if (!res.ok) {
            throw new Error(
                `Amelia ${action} failed: HTTP ${res.status} ${await res.text()}`
            )
        }
    }

    /** Lien signé (GET /crm/rebook-link) permettant à un client existant de
     *  reprendre RDV sur Amelia sans ressaisir son brief. */
    async rebookLink(email: string): Promise<string> {
        const jwt = await getAccessToken()
        if (!this.isConfigured || !jwt) {
            throw new Error("Bridge non configuré ou session expirée")
        }
        const res = await fetch(
            `${BRIDGE_URL}/crm/rebook-link?email=${encodeURIComponent(email)}`,
            { headers: this.headers(jwt) }
        )
        if (!res.ok) {
            throw new Error(
                `Rebook link failed: HTTP ${res.status} ${await res.text()}`
            )
        }
        const { url } = (await res.json()) as { url: string }
        return url
    }
}

export const ameliaBridgeService = new AmeliaBridgeService()
