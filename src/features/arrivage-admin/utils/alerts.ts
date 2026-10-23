import {
    FAILURE_RATE_ALERT_THRESHOLD,
    LOW_INVITATION_CODES_THRESHOLD,
    RUN_STATUS_LABELS,
} from "@/features/arrivage-admin/constants"
import { formatDateTime, formatPercent } from "@/features/arrivage-admin/utils/format"
import type {
    DashboardAlert,
    NewsletterStats,
    ServiceHealth,
} from "@/features/arrivage-admin/types"

/**
 * Dérive les alertes du dashboard. Fonction pure : elle ne lit que ce qu'on lui
 * passe, ce qui la rend testable sans monter de composant.
 *
 * Les alertes sont retournées de la plus grave à la moins grave, et le tableau
 * est vide quand tout va bien — le bandeau ne s'affiche alors pas du tout.
 */
export function buildDashboardAlerts(
    health: ServiceHealth,
    stats: NewsletterStats | null,
    statsError: string | null
): DashboardAlert[] {
    const alerts: DashboardAlert[] = []

    // En tête, et avant même le test de joignabilité : une file pg_net bloquée
    // coupe TOUT le sortant HTTP de la base — webhook newsletter, mais aussi
    // notifications push et confirmations de RDV. C'est la panne du 26/08, et
    // elle ne se voyait nulle part : le service Go répondait normalement, les
    // envois manuels partaient, aucune erreur n'était journalisée.
    const pgNet = health.pgNet
    if (pgNet?.available && pgNet.stalled && pgNet.orphaned) {
        // Distinction qui change l'action : ces lignes ne partiront jamais,
        // relancer le worker n'y peut rien. Le sortant HTTP peut très bien
        // fonctionner par ailleurs — c'est le cas observé le 27/08.
        const depth = pgNet.queue_depth ?? 0
        alerts.push({
            id: "pg-net-orphaned",
            tone: "warning",
            title: "Requêtes orphelines dans la file pg_net",
            description: `${depth} requête(s) restent dans la file sans qu'aucun worker ne les reprenne — vestiges d'un crash passé. Les nouveaux envois ne sont pas forcément affectés : vérifier avec « Tester le webhook ». Pour nettoyer : delete from net.http_request_queue where id <= ${pgNet.oldest_id ?? 0};`,
        })
    } else if (pgNet?.available && pgNet.stalled) {
        const depth = pgNet.queue_depth ?? 0
        alerts.push({
            id: "pg-net-stalled",
            tone: "destructive",
            title: "La base n'émet plus aucune requête sortante",
            description: `${depth} requête(s) sont bloquées dans la file pg_net : le déclenchement automatique de la newsletter est interrompu, comme les notifications et les confirmations de RDV. Le watchdog tente une relance toutes les 2 minutes. Si l'alerte persiste, le worker a crashé et aucune commande SQL ne le ramènera : vider la file puis redémarrer l'instance (Dashboard Supabase > Settings > General > Restart project).`,
        })
    } else if (pgNet && pgNet.available === false) {
        alerts.push({
            id: "pg-net-absent",
            tone: "destructive",
            title: "Extension pg_net absente",
            description:
                "La base ne peut émettre aucune requête HTTP : aucun envoi automatique n'est possible. Activer pg_net dans le Dashboard Supabase.",
        })
    }

    if (health.reachable === false) {
        alerts.push({
            id: "api-unreachable",
            tone: "destructive",
            title: "Service newsletter injoignable",
            description:
                "L'API ne répond pas. Aucun envoi automatique ne partira tant qu'elle est à l'arrêt — les chiffres ci-dessous sont ceux du dernier état connu.",
        })
        // Inutile d'empiler les symptômes d'une seule et même panne — mais
        // l'alerte pg_net éventuellement déjà empilée est conservée : elle
        // désigne une autre cause, et une autre correction.
        return alerts
    }

    if (statsError) {
        alerts.push({
            id: "stats-error",
            tone: "destructive",
            title: "Statistiques indisponibles",
            description: statsError,
        })
    }

    if (!stats) return alerts

    const lastRun = stats.last_run
    if (lastRun && (lastRun.status === "failed" || lastRun.status === "aborted")) {
        alerts.push({
            id: "last-run-failed",
            tone: "destructive",
            title: `Dernier envoi ${RUN_STATUS_LABELS[lastRun.status].toLowerCase()}`,
            description:
                lastRun.error ??
                `Envoi du ${formatDateTime(lastRun.started_at)} : aucun destinataire n'a été servi.`,
        })
    } else if (lastRun?.status === "partial") {
        alerts.push({
            id: "last-run-partial",
            tone: "warning",
            title: "Dernier envoi partiel",
            description: `${lastRun.failed_count} destinataire(s) sur ${lastRun.subscribers_total} n'ont pas reçu la newsletter du ${formatDateTime(lastRun.started_at)}.`,
        })
    }

    if (
        stats.failure_rate > FAILURE_RATE_ALERT_THRESHOLD &&
        stats.failed > 0 &&
        // Une alerte « taux d'échec » sur trois envois n'a pas de sens.
        stats.sent + stats.failed >= 10
    ) {
        alerts.push({
            id: "failure-rate",
            tone: "warning",
            title: `Taux d'échec de ${formatPercent(stats.failure_rate)}`,
            description: `${stats.failed} envoi(s) en échec sur les ${stats.days} derniers jours. Vérifier le journal SMTP dans l'onglet Logs.`,
        })
    }

    if (stats.invitation_codes.available <= LOW_INVITATION_CODES_THRESHOLD) {
        alerts.push({
            id: "low-invitation-codes",
            tone: "warning",
            title:
                stats.invitation_codes.available === 0
                    ? "Plus aucun code d'invitation disponible"
                    : `Plus que ${stats.invitation_codes.available} code(s) d'invitation`,
            description:
                "Générer de nouveaux codes depuis l'onglet Abonnés pour pouvoir inscrire d'autres utilisateurs.",
        })
    }

    if (stats.subscribers.active === 0 && stats.subscribers.total > 0) {
        alerts.push({
            id: "no-active-subscriber",
            tone: "warning",
            title: "Aucun abonné actif",
            description:
                "Tous les abonnements sont désactivés : les envois ne toucheront personne.",
        })
    }

    return alerts
}
