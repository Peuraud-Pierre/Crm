import { Users, Gauge, ScrollText } from "lucide-react"
import type { ComponentType } from "react"
import type { RunStatus, RunTrigger } from "./types"

/**
 * Registre des codes de permission de la feature. Tout `hasPermission(...)`
 * passe par ces constantes, jamais par un littéral en dur.
 */
export const ARRIVAGE_ADMIN_PERMISSIONS = {
    /** Accès à la page (gaté aussi par le router). */
    admin: "stock.arrivage.newsletter.admin",
    /** Autorise le déclenchement d'un envoi (global ou ciblé). */
    send: "stock.arrivage.newsletter.send",
} as const

export const ARRIVAGE_ADMIN_TABS = [
    {
        value: "dashboard",
        label: "Dashboard",
        description: "Santé du service, envois et alertes.",
        icon: Gauge,
    },
    {
        value: "abonnes",
        label: "Abonnés",
        description: "Abonnements et codes d'invitation.",
        icon: Users,
    },
    {
        value: "logs",
        label: "Logs",
        description: "Historique des envois et journal de l'API.",
        icon: ScrollText,
    },
] as const satisfies readonly {
    value: string
    label: string
    description: string
    icon: ComponentType<{ className?: string }>
}[]

export type ArrivageAdminTab = (typeof ARRIVAGE_ADMIN_TABS)[number]["value"]

export const DEFAULT_TAB: ArrivageAdminTab = "dashboard"

export const BASE_PATH = "/arrivage-admin"

/** Fenêtres d'analyse proposées sur le dashboard. */
export const STATS_PERIODS = [
    { value: 7, label: "7 jours" },
    { value: 30, label: "30 jours" },
    { value: 90, label: "90 jours" },
] as const

export const DEFAULT_STATS_DAYS = 30

/** Masque affiché à la place d'un code d'invitation non révélé. */
export const CODE_MASK = "•••••••••••••"

/** Niveaux slog, dans l'ordre de gravité croissante. */
export const LOG_LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"] as const

export type LogLevel = (typeof LOG_LEVELS)[number]

/** Nombre de lignes de log chargées par page (curseur). */
export const LOGS_PAGE_SIZE = 100

/** Période de l'auto-rafraîchissement du journal (ms), quand il est activé. */
export const LOGS_AUTO_REFRESH_MS = 15_000

/** Nombre de runs affichés par page dans l'historique. */
export const RUNS_PAGE_SIZE = 25

/**
 * Nombre de runs rapatriés en une fois. La pagination de l'historique est
 * ensuite faite côté client, comme celle de l'ErrorConsole : le volume est
 * borné (un run par diffusion) et ça évite un aller-retour par page.
 */
export const RUNS_FETCH_LIMIT = 200

/** Nombre de runs mis en avant sur le dashboard. */
export const RECENT_RUNS_COUNT = 5

/** Intervalle de rafraîchissement de l'état du service (ms). */
export const SERVICE_STATUS_POLL_MS = 30_000

/**
 * Seuil de taux d'échec au-delà duquel le dashboard lève une alerte.
 * Volontairement bas : un envoi sur vingt qui échoue mérite un regard.
 */
export const FAILURE_RATE_ALERT_THRESHOLD = 0.05

/** En deçà, on alerte sur l'épuisement du stock de codes d'invitation. */
export const LOW_INVITATION_CODES_THRESHOLD = 2

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
    running: "En cours",
    success: "Réussi",
    partial: "Partiel",
    failed: "Échoué",
    aborted: "Interrompu",
}

export const RUN_TRIGGER_LABELS: Record<RunTrigger, string> = {
    webhook: "Automatique",
    manual: "Manuel",
    resend: "Renvoi",
}

/*
 * Diagnostic du webhook (bouton « Tester le webhook »). pg_net est asynchrone :
 * la réponse n'apparaît qu'une fois son worker passé, d'où le polling. Douze
 * tentatives d'une seconde couvrent largement le timeout de 5 s du trigger,
 * tout en bornant l'attente à quelque chose de supportable devant un écran.
 */
export const WEBHOOK_PING_POLL_MS = 1_000
export const WEBHOOK_PING_MAX_ATTEMPTS = 12
