// ── shared/services/packingApiClient.ts ───────────────────────────────────────
// Accès HTTP au service `packing-api` (Python/FastAPI, dépôt `packing-api`).
//
// POURQUOI CE FICHIER EST DANS `shared`
// -------------------------------------
// Deux features l'appellent : `stock` (import d'une packing list, encart
// d'apprentissage) et `packing-admin` (console de supervision). Sans ce module,
// l'en-tête d'authentification, la lecture de l'URL de base et la traduction des
// codes HTTP en messages français existeraient en trois exemplaires — le
// troisième étant celui qu'on oublie de corriger. `newsletterService` en porte
// déjà une copie pour l'autre service ; on n'en ajoute pas une de plus.
// Précédent d'un service sous `shared` : `shared/services/permissionsService.ts`.
//
// AUTHENTIFICATION
// ----------------
// Le JWT Supabase de l'utilisateur est transmis tel quel. Le service le vérifie
// localement (HS256) puis le RETRANSMET à PostgREST : c'est la RLS de
// l'utilisateur qui décide de ce qu'il voit, et `imported_by` désigne bien la
// personne qui importe. Le service ne détient aucune clé service-role, et ça
// n'est pas une omission — voir `app/config.py` du dépôt `packing-api`.
//
// Une session SANS MFA reçoit 403 : toutes les routes exigent `aal2`, comme la
// RLS des tables packing. C'est pourquoi la route de la console porte
// `requireMfa: true`.

import { supabase } from "@/integrations/supabase/client"
import { env } from "@/shared/lib/env"

export class PackingApiError extends Error {
    readonly status: number | null

    constructor(message: string, status: number | null = null) {
        super(message)
        this.name = "PackingApiError"
        this.status = status
    }
}

/** Messages par code HTTP. `detail` du service, quand il existe, a priorité. */
export const PACKING_API_STATUS_MESSAGES: Record<number, string> = {
    401: "Session expirée — reconnectez-vous.",
    403: "Accès refusé : session sans MFA, ou droit « stock.packing.view » manquant.",
    409: "Cet arrivage a déjà une packing list.",
    413: "Fichier trop volumineux.",
    422: "Fichier illisible ou format de packing list non reconnu.",
}

/** URL du service, sans slash final. `null` quand la variable n'est pas posée. */
export function packingApiBaseUrl(): string | null {
    const raw = env.PUBLIC_PACKING_API_URL
    return raw ? raw.replace(/\/$/, "") : null
}

export function packingApiConfigured(): boolean {
    return packingApiBaseUrl() !== null
}

export async function packingApiAccessToken(): Promise<string> {
    const {
        data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) {
        throw new PackingApiError(PACKING_API_STATUS_MESSAGES[401], 401)
    }
    return session.access_token
}

function requireBaseUrl(): string {
    const baseUrl = packingApiBaseUrl()
    if (!baseUrl) {
        throw new PackingApiError(
            "Le service de packing lists n'est pas configuré (PUBLIC_PACKING_API_URL).",
        )
    }
    return baseUrl
}

/**
 * GET authentifié. `signal` permet à un hook d'abandonner une requête devenue
 * obsolète (changement de filtre, démontage) sans que sa réponse tardive écrase
 * un état plus récent.
 */
export async function packingApiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
    const baseUrl = requireBaseUrl()
    const token = await packingApiAccessToken()

    let response: Response
    try {
        response = await fetch(`${baseUrl}${path}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal,
        })
    } catch (error) {
        // Une requête annulée n'est pas une panne : la propager telle quelle
        // laisse l'appelant la distinguer (`signal.aborted`).
        if (error instanceof DOMException && error.name === "AbortError") throw error
        throw new PackingApiError("Service de packing lists injoignable.")
    }

    if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { detail?: unknown }
        const detail = typeof payload.detail === "string" ? payload.detail : null
        throw new PackingApiError(
            detail ??
                PACKING_API_STATUS_MESSAGES[response.status] ??
                `Erreur du service de packing lists (${response.status}).`,
            response.status,
        )
    }

    return (await response.json()) as T
}

/** POST multipart authentifié — l'envoi d'un fichier d'import. */
export async function packingApiPostForm<T>(path: string, body: FormData): Promise<T> {
    const baseUrl = requireBaseUrl()
    const token = await packingApiAccessToken()

    let response: Response
    try {
        response = await fetch(`${baseUrl}${path}`, {
            method: "POST",
            body,
            headers: { Authorization: `Bearer ${token}` },
        })
    } catch {
        throw new PackingApiError("Service d'import injoignable. Réessayez dans un instant.")
    }

    if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { detail?: unknown }
        const detail = typeof payload.detail === "string" ? payload.detail : null
        throw new PackingApiError(
            detail ??
                PACKING_API_STATUS_MESSAGES[response.status] ??
                `Erreur du service d'import (${response.status}).`,
            response.status,
        )
    }

    return (await response.json()) as T
}

/**
 * Le service répond-il ? Non authentifié, et volontairement muet sur la cause.
 *
 * Distinguer « injoignable » (réseau) de « joignable mais refuse » (403) change
 * l'action à mener : dans un cas on relance le service, dans l'autre on regarde
 * les droits ou la MFA. Les deux ne doivent donc pas remonter la même alerte.
 */
export async function packingApiReachable(signal?: AbortSignal): Promise<boolean> {
    const baseUrl = packingApiBaseUrl()
    if (!baseUrl) return false
    try {
        const response = await fetch(`${baseUrl}/health`, { signal })
        return response.ok
    } catch {
        return false
    }
}
