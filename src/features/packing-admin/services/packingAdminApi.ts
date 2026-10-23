// ── services/packingAdminApi.ts ───────────────────────────────────────────────
// Ce que la console demande à `packing-api`. Trois routes, toutes en LECTURE :
// la console ne pilote rien à distance, elle regarde.
//
//   GET /status                → PackingServiceStatus
//   GET /model/stats           → PackingModelStats (+ simulation par paramètres)
//   GET /model/replay          → PackingReplayReport
//   GET /health                → joignabilité, non authentifié
//
// L'authentification, l'URL de base et la traduction des codes HTTP vivent dans
// `shared/services/packingApiClient` — partagées avec l'import.

import {
    packingApiConfigured,
    packingApiGet,
    packingApiReachable,
} from "@/shared/services/packingApiClient"
import type {
    PackingGuardSettings,
    PackingModelStats,
    PackingReplayReport,
    PackingServiceStatus,
} from "@/features/packing-admin/types"

export { packingApiConfigured, packingApiReachable }

/** Surcharges de garde d'une simulation. Toutes optionnelles. */
export type GuardOverrides = Partial<PackingGuardSettings>

function guardParams(overrides?: GuardOverrides): URLSearchParams {
    const params = new URLSearchParams()
    if (overrides?.target_precision !== undefined) {
        params.set("target_precision", String(overrides.target_precision))
    }
    if (overrides?.min_evidence !== undefined) {
        params.set("min_evidence", String(overrides.min_evidence))
    }
    if (overrides?.min_margin !== undefined) {
        params.set("min_margin", String(overrides.min_margin))
    }
    return params
}

function withQuery(path: string, params: URLSearchParams): string {
    const query = params.toString()
    return query ? `${path}?${query}` : path
}

export function fetchPackingServiceStatus(signal?: AbortSignal): Promise<PackingServiceStatus> {
    return packingApiGet<PackingServiceStatus>("/status", signal)
}

/**
 * État du modèle. Sans surcharge, c'est la production ; avec, une SIMULATION —
 * la réponse porte alors `simulated: true`, et l'écran doit l'annoncer.
 */
export function fetchPackingModelReport(
    overrides?: GuardOverrides,
    signal?: AbortSignal,
): Promise<PackingModelStats> {
    return packingApiGet<PackingModelStats>(
        withQuery("/model/stats", guardParams(overrides)),
        signal,
    )
}

/**
 * Rejeu de l'historique validé. `limit` borne depuis le DÉBUT de l'histoire :
 * un rejeu part d'un dictionnaire vide, tronquer les premiers conteneurs
 * fausserait la courbe.
 */
export function fetchPackingReplay(
    limit: number,
    overrides?: GuardOverrides,
    signal?: AbortSignal,
): Promise<PackingReplayReport> {
    const params = guardParams(overrides)
    params.set("limit", String(limit))
    return packingApiGet<PackingReplayReport>(withQuery("/model/replay", params), signal)
}
