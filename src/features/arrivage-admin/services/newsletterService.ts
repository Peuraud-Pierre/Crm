import { supabase } from "@/integrations/supabase/client"
import { env } from "@/shared/lib/env"
import type {
    ApiLogLine,
    InvitationCode,
    LogFilters,
    NewsletterStats,
    SendEvent,
    SendRun,
    ServiceStatus,
    PgNetHealth,
    Subscriber,
    WebhookPingResponse,
    WebhookPingStart,
} from "@/features/arrivage-admin/types"

const NEWSLETTER_API = env.PUBLIC_NEWSLETTER_API_URL ?? ""

async function authHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token}` }
}

async function assertOk(res: Response, fallback: string) {
    if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || fallback)
    }
}

/**
 * GET authentifié sur l'API newsletter. `signal` permet à un hook d'abandonner
 * une requête devenue obsolète (changement de filtre, démontage).
 */
async function getJSON<T>(
    path: string,
    fallback: string,
    signal?: AbortSignal
): Promise<T> {
    const res = await fetch(`${NEWSLETTER_API}${path}`, {
        method: "GET",
        headers: await authHeaders(),
        signal,
    })
    await assertOk(res, fallback)
    return (await res.json()) as T
}

export async function resendNewsletterToSubscriber(userId: string): Promise<void> {
    const res = await fetch(`${NEWSLETTER_API}/subscribers/${userId}/resend`, {
        method: "POST",
        headers: await authHeaders(),
    })
    await assertOk(res, "Erreur lors du renvoi de la newsletter.")
}

export async function resendNewsletterToAll(): Promise<void> {
    const res = await fetch(`${NEWSLETTER_API}/pipeline/trigger`, {
        method: "POST",
        headers: await authHeaders(),
    })
    await assertOk(res, "Erreur lors de l'envoi de la newsletter.")
}

export async function adminSubscribeUser(payload: {
    user_id: string
    email: string
    full_name: string | null
    invitation_code: string
}): Promise<void> {
    const res = await fetch(`${NEWSLETTER_API}/admin/subscribers`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(await authHeaders()),
        },
        body: JSON.stringify(payload),
    })
    await assertOk(res, "Erreur lors de l'association du code.")
}

/*
 * Observabilité — lecture seule, servie par le service Go (tables
 * newsletter_send_runs / newsletter_send_events / newsletter_api_logs, qu'il
 * est seul à écrire). Toutes ces routes sont gardées par la permission
 * stock.arrivage.newsletter.admin côté service.
 */

export function fetchNewsletterStats(
    days: number,
    signal?: AbortSignal
): Promise<NewsletterStats> {
    return getJSON<NewsletterStats>(
        `/stats?days=${days}`,
        "Erreur lors du chargement des statistiques.",
        signal
    )
}

export function fetchNewsletterRuns(
    limit: number,
    status: string,
    signal?: AbortSignal
): Promise<SendRun[]> {
    const params = new URLSearchParams({ limit: String(limit) })
    if (status) params.set("status", status)

    return getJSON<SendRun[]>(
        `/runs?${params.toString()}`,
        "Erreur lors du chargement de l'historique des envois.",
        signal
    )
}

export function fetchRunEvents(
    runId: string,
    signal?: AbortSignal
): Promise<SendEvent[]> {
    return getJSON<SendEvent[]>(
        `/runs/${runId}/events`,
        "Erreur lors du chargement du détail de l'envoi.",
        signal
    )
}

export function fetchApiLogs(
    filters: LogFilters,
    limit: number,
    beforeId: number | null,
    signal?: AbortSignal
): Promise<ApiLogLine[]> {
    const params = new URLSearchParams({ limit: String(limit) })
    if (filters.levels.length > 0) params.set("level", filters.levels.join(","))
    if (filters.search) params.set("search", filters.search)
    if (filters.reqId) params.set("req_id", filters.reqId)
    if (filters.since) params.set("since", filters.since)
    if (filters.until) params.set("until", filters.until)
    if (beforeId) params.set("before_id", String(beforeId))

    return getJSON<ApiLogLine[]>(
        `/logs?${params.toString()}`,
        "Erreur lors du chargement des logs.",
        signal
    )
}

export function fetchServiceStatus(
    signal?: AbortSignal
): Promise<ServiceStatus> {
    return getJSON<ServiceStatus>(
        "/status",
        "Erreur lors de la lecture de l'état du service.",
        signal
    )
}

/**
 * Ping non authentifié du service. Distingue « API injoignable » (réseau) de
 * « API joignable mais requête refusée » (403), que le dashboard ne doit pas
 * présenter de la même façon.
 */
export async function pingNewsletterApi(signal?: AbortSignal): Promise<boolean> {
    try {
        const res = await fetch(`${NEWSLETTER_API}/health`, {
            method: "GET",
            signal,
        })
        return res.ok
    } catch {
        return false
    }
}

/*
 * Accès aux tables `newsletter_invitation_codes` et `newsletter_subscriptions`.
 * Déplacé depuis routes/ArrivageAdmin.tsx (déplacement mécanique) — seule la
 * couche service est autorisée à importer le client Supabase (règle ESLint
 * no-restricted-imports). Les casts `as any` existants sont conservés tels
 * quels (tables absentes du typage Supabase généré).
 */

export async function fetchInvitationCodes(): Promise<InvitationCode[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from("newsletter_invitation_codes")
        .select("*")
        .order("created_at", { ascending: false })
    if (error) throw new Error("Erreur lors du chargement des codes.")
    return (data as InvitationCode[]) ?? []
}

export async function fetchNewsletterSubscriptions(): Promise<Subscriber[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from("newsletter_subscriptions")
        .select("*")
        .order("created_at", { ascending: false })
    if (error) throw new Error("Erreur lors du chargement des abonnés.")
    return (data as Subscriber[]) ?? []
}

/**
 * Bascule la préférence "newsletter stats CRM" (`crm_stat`) d'un abonné.
 * Écriture directe Supabase (pas de route Go — pas de flux d'envoi associé
 * côté service pour cette préférence), gardée par la policy RLS
 * arrivage_admin_can_update_stats_preference (permission
 * stock.arrivage.newsletter.admin, déjà requise pour voir cette page).
 */
export async function updateSubscriberCrmStat(
    userId: string,
    crmStat: boolean
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from("newsletter_subscriptions")
        .update({ crm_stat: crmStat })
        .eq("user_id", userId)
        .select("user_id")
    if (error) throw new Error("Erreur lors de la mise à jour de la préférence.")
    // RLS qui bloque l'UPDATE ne renvoie pas d'erreur — juste 0 ligne
    // affectée. Sans ce garde-fou, l'échec est silencieux (le rollback de
    // l'appelant ne se déclenche jamais).
    if (!data || data.length === 0)
        throw new Error(
            "Mise à jour refusée (droits insuffisants ou abonné introuvable)."
        )
}

/**
 * Bascule la préférence "newsletter arrivage" (`arrivage`) d'un abonné.
 * Écriture directe Supabase (même policy RLS que updateSubscriberCrmStat —
 * elle ne restreint pas la colonne, seulement la ligne). Distinct de
 * `active`, que le service Go continue seul de lire/écrire pour son propre
 * flux (webhook, pipeline).
 */
export async function updateSubscriberArrivage(
    userId: string,
    arrivage: boolean
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from("newsletter_subscriptions")
        .update({ arrivage })
        .eq("user_id", userId)
        .select("user_id")
    if (error) throw new Error("Erreur lors de la mise à jour de la préférence.")
    if (!data || data.length === 0)
        throw new Error(
            "Mise à jour refusée (droits insuffisants ou abonné introuvable)."
        )
}

export async function insertInvitationCode(row: {
    code: string
    label: string | null
    created_by: string
}): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
        .from("newsletter_invitation_codes")
        .insert(row)
    if (error) throw new Error("Erreur lors de la création du code.")
}

/*
 * Diagnostic du webhook automatique (migration 20260827090000).
 *
 * Ces deux appels ne passent PAS par l'API Go : ils s'exécutent dans Postgres,
 * là où le trigger vit. C'est tout l'intérêt — ils testent le segment que
 * `/pipeline/trigger` et `/subscribers/{id}/resend` n'empruntent jamais, et qui
 * est précisément celui qui tombe en panne sans laisser de trace.
 */

export async function startWebhookPing(): Promise<WebhookPingStart> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("ping_newsletter_webhook")
    if (error)
        throw new Error(
            error.message || "Impossible de lancer le test du webhook."
        )
    return data as WebhookPingStart
}

export async function checkWebhookPing(
    requestId: number
): Promise<WebhookPingResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc(
        "check_newsletter_webhook_ping",
        { p_request_id: requestId }
    )
    if (error)
        throw new Error(
            error.message || "Impossible de lire le résultat du test."
        )
    return data as WebhookPingResponse
}

/**
 * État de la file pg_net. Lecture seule : le watchdog planifié
 * (public.pg_net_watchdog, toutes les 2 min) est seul à réparer.
 *
 * Renvoie `null` plutôt que de propager l'erreur : c'est un indicateur
 * d'appoint, son indisponibilité ne doit pas casser le chargement du
 * dashboard — typiquement avant que la migration ait été appliquée.
 */
export async function fetchPgNetHealth(): Promise<PgNetHealth | null> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("pg_net_health")
    if (error) return null
    return data as PgNetHealth
}
