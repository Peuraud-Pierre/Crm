/**
 * Types de la feature. Les tables `newsletter_*` sont absentes du typage
 * Supabase généré (`src/integrations/supabase/types.ts` est en retard sur les
 * migrations), et les payloads d'observabilité viennent du service Go
 * `newsletter-console` : dans les deux cas la forme est déclarée ici.
 */

export interface InvitationCode {
    id: string
    code: string
    label: string | null
    created_by: string
    used_by: string | null
    used_at: string | null
    created_at: string
}

export interface Subscriber {
    user_id: string
    email: string
    full_name: string | null
    visible_columns: string[]
    /** Flag global du service Go (webhook/pipeline) — distinct de arrivage/crm_stat. */
    active: boolean
    created_at: string
    /** Préférences par newsletter, éditables depuis SubscribersTab. */
    arrivage: boolean | null
    crm_stat: boolean | null
}

/** Origine d'un envoi — miroir de `newsletter_send_runs.trigger`. */
export type RunTrigger = "webhook" | "manual" | "resend"

/** Issue d'un envoi — miroir de `newsletter_send_runs.status`. */
export type RunStatus =
    | "running"
    | "success"
    | "partial"
    | "failed"
    | "aborted"

/** Une exécution du pipeline. */
export interface SendRun {
    id: string
    trigger: RunTrigger
    triggered_by: string | null
    started_at: string
    finished_at: string | null
    status: RunStatus
    rows_count: number
    subscribers_total: number
    sent_count: number
    failed_count: number
    duration_ms: number | null
    error: string | null
}

/** Une tentative de livraison vers un abonné. */
export interface SendEvent {
    id: string
    run_id: string
    user_id: string
    email: string
    status: "sent" | "failed"
    error: string | null
    xlsx_size_bytes: number | null
    excel_ms: number | null
    smtp_ms: number | null
    changed_cells: number | null
    created_at: string
}

/** Une ligne de log du service Go. */
export interface ApiLogLine {
    id: number
    ts: string
    level: string
    msg: string
    req_id: string | null
    method: string | null
    path: string | null
    status: number | null
    duration_ms: number | null
    attrs: Record<string, unknown> | null
}

export interface DailyPoint {
    /** Format YYYY-MM-DD. */
    date: string
    sent: number
    failed: number
}

/** Payload complet du dashboard, agrégé côté service. */
export interface NewsletterStats {
    days: number
    sent: number
    failed: number
    /** Ratio 0..1 sur la période. */
    failure_rate: number
    runs_total: number
    runs_failed: number
    avg_run_duration_ms: number
    last_run: SendRun | null
    daily: DailyPoint[]
    subscribers: {
        total: number
        active: number
        inactive: number
        new: number
    }
    invitation_codes: {
        available: number
        used: number
    }
}

/** État du debouncer, tel que renvoyé par `GET /status`. */
export interface ServiceStatus {
    debounce: "idle" | "pending"
    /** ISO 8601, présent uniquement quand `debounce === "pending"`. */
    fire_at?: string
}

/**
 * État de la file pg_net, par laquelle sort TOUT le HTTP émis par la base
 * (webhook newsletter, notifications push, confirmations de RDV). Renvoyé par
 * la RPC `pg_net_health()` — migration 20260827100000.
 */
export interface PgNetHealth {
    /** `false` si l'extension pg_net n'est pas installée. */
    available: boolean
    queue_depth?: number
    oldest_id?: number | null
    /** File non vide qui n'avance plus : le worker est arrêté. */
    stalled?: boolean
    /**
     * Le watchdog a épuisé ses relances : les lignes restantes sont des
     * orphelines (en vol lors d'un crash, jamais reprises), pas une file en
     * attente. Aucune relance ne les enlèvera, seule une purge.
     */
    orphaned?: boolean
    /** Dernier instant où la file a effectivement avancé. */
    stalled_since?: string | null
    last_restart_at?: string | null
    /** Cumul des relances du watchdog. Un chiffre qui grimpe = problème de fond. */
    restart_count?: number
}

/** Santé du service, dérivée côté front de `GET /health` et `GET /status`. */
export interface ServiceHealth {
    /** `null` tant que le premier appel n'a pas abouti. */
    reachable: boolean | null
    status: ServiceStatus | null
    /**
     * Optionnel : les tests et les rendus antérieurs à la migration
     * 20260827100000 n'en fournissent pas. `null` = non encore chargé.
     */
    pgNet?: PgNetHealth | null
}

/** Filtres de la console de logs. */
export interface LogFilters {
    levels: string[]
    search: string
    /** Isole les lignes d'une même requête HTTP. Vide = pas de filtre. */
    reqId: string
    /** Bornes ISO 8601, alimentées par le sélecteur de plage de dates. */
    since: string | null
    until: string | null
}

/** Une alerte affichée en tête du dashboard. */
export interface DashboardAlert {
    id: string
    tone: "destructive" | "warning"
    title: string
    description: string
}

/*
 * Diagnostic du webhook « arrivage → newsletter-console ».
 * Formes renvoyées par les RPC ping_newsletter_webhook() et
 * check_newsletter_webhook_ping() (migration 20260827090000).
 */

/** Motif d'un ping qui n'a même pas pu partir. */
export type WebhookPingReason =
    | "pg_net_absent"
    | "trigger_absent"
    | "trigger_disabled"
    | "trigger_unparsable"

/** Réponse de `ping_newsletter_webhook()`. */
export interface WebhookPingStart {
    ok: boolean
    reason?: WebhookPingReason
    message?: string
    trigger_found?: boolean
    trigger_name?: string
    trigger_enabled?: boolean
    /** URL appelée par le trigger. Les en-têtes ne sont jamais exposés. */
    url?: string
    request_id?: number
}

/** Réponse de `check_newsletter_webhook_ping()`. */
export interface WebhookPingResponse {
    /** `queued` = pg_net a la requête mais ne l'a pas encore dépilée. */
    state: "done" | "queued" | "pending"
    status_code?: number | null
    timed_out?: boolean
    error_msg?: string | null
}

/** Verdict présenté à l'admin, dérivé des deux réponses ci-dessus. */
export interface WebhookPingVerdict {
    tone: "success" | "warning" | "destructive"
    title: string
    detail: string
    /** Marche à suivre. `null` quand il n'y a rien à faire. */
    remedy: string | null
    url: string | null
    triggerName: string | null
    statusCode: number | null
}
