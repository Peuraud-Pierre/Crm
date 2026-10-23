import type {
    WebhookPingResponse,
    WebhookPingStart,
    WebhookPingVerdict,
} from "@/features/arrivage-admin/types"

/**
 * Traduit le résultat brut des RPC de diagnostic en un verdict lisible.
 *
 * Fonction pure, comme `buildDashboardAlerts` : toute la logique de lecture des
 * codes d'erreur est ici, testable sans monter de composant ni toucher à la
 * base.
 *
 * Chaque cas de panne porte sa marche à suivre. C'est le point du bouton : un
 * `status_code` nu ne dit rien à qui n'a pas la chaîne complète en tête, alors
 * que « 401 » et « timeout » demandent deux corrections sans rapport (un secret
 * à réaligner d'un côté, un reverse proxy à reconfigurer de l'autre).
 *
 * @param start    réponse de `ping_newsletter_webhook()`
 * @param last     dernière réponse de `check_newsletter_webhook_ping()`, ou
 *                 `null` si le front a épuisé ses tentatives sans rien obtenir
 */
export function buildWebhookPingVerdict(
    start: WebhookPingStart,
    last: WebhookPingResponse | null
): WebhookPingVerdict {
    const url = start.url ?? null
    const triggerName = start.trigger_name ?? null

    // ── Le ping n'a même pas pu partir : le problème est dans Postgres ──────
    if (!start.ok) {
        switch (start.reason) {
            case "trigger_absent":
                return {
                    tone: "destructive",
                    title: "Le trigger a disparu",
                    detail:
                        "Aucun webhook n'est branché sur la table des arrivages. Une modification du tableau ne déclenche donc plus rien, et l'incident ne laisse aucune trace : ni erreur, ni envoi en échec.",
                    remedy:
                        "Recréer le hook (Dashboard Supabase > Database > Webhooks), ou appliquer la migration 20260826120000_arrivage_manuel_newsletter_webhook.sql qui le rétablit.",
                    url,
                    triggerName,
                    statusCode: null,
                }
            case "trigger_disabled":
                return {
                    tone: "destructive",
                    title: "Le trigger est désactivé",
                    detail:
                        "Le webhook existe toujours et s'affiche dans le Dashboard, mais il est désactivé : il ne partira sur aucune modification.",
                    remedy: triggerName
                        ? `Le réactiver : ALTER TABLE public.arrivage_manuel ENABLE TRIGGER ${triggerName};`
                        : "Le réactiver avec ALTER TABLE public.arrivage_manuel ENABLE TRIGGER …",
                    url,
                    triggerName,
                    statusCode: null,
                }
            case "pg_net_absent":
                return {
                    tone: "destructive",
                    title: "pg_net n'est pas installé",
                    detail:
                        "La base ne peut émettre aucune requête HTTP sortante. C'est l'extension dont dépendent tous les Database Webhooks.",
                    remedy:
                        "Activer l'extension pg_net dans le Dashboard Supabase (Database > Extensions).",
                    url,
                    triggerName,
                    statusCode: null,
                }
            default:
                return {
                    tone: "warning",
                    title: "Test impossible",
                    detail:
                        start.message ??
                        "La configuration du webhook n'a pas pu être lue.",
                    remedy: null,
                    url,
                    triggerName,
                    statusCode: null,
                }
        }
    }

    // ── Le ping est parti, mais rien n'est revenu ──────────────────────────
    if (last === null || last.state !== "done") {
        // pg_net a accepté la requête et ne l'a jamais dépilée : son worker
        // est à l'arrêt. Panne silencieuse classique — la file grossit, aucun
        // webhook ne part, et rien ne le signale nulle part.
        if (last?.state === "queued") {
            return {
                tone: "destructive",
                title: "pg_net ne traite plus les requêtes",
                detail:
                    "La requête est restée dans la file d'attente de pg_net sans jamais être envoyée. Le worker de l'extension est arrêté : plus aucun webhook ne sort de la base.",
                remedy:
                    "Relancer le worker : select net.worker_restart(); puis refaire ce test.",
                url,
                triggerName,
                statusCode: null,
            }
        }

        return {
            tone: "warning",
            title: "Aucune réponse dans le délai imparti",
            detail:
                "La requête est partie mais aucun résultat n'est encore enregistré. Ce n'est pas concluant : soit la réponse tarde, soit elle n'arrivera jamais.",
            remedy: "Relancer le test dans quelques instants.",
            url,
            triggerName,
            statusCode: null,
        }
    }

    // ── Une réponse existe ────────────────────────────────────────────────
    if (last.timed_out || last.error_msg) {
        return {
            tone: "destructive",
            title: "Le service est injoignable depuis la base",
            detail: last.error_msg
                ? `La requête a échoué au niveau réseau : ${last.error_msg}`
                : "La requête a expiré avant d'obtenir une réponse.",
            remedy:
                "Le conteneur n'écoute que sur 127.0.0.1 : vérifier que le reverse proxy route bien l'URL ci-dessous vers son port, et que le conteneur tourne.",
            url,
            triggerName,
            statusCode: null,
        }
    }

    const code = last.status_code ?? null

    if (code === 200) {
        return {
            tone: "success",
            title: "Chaîne opérationnelle",
            // Formulation resserrée volontairement : le ping rejoue l'appel du
            // trigger, il ne l'exécute pas. Il ne peut donc pas prouver que
            // Postgres le déclenche bien sur un UPDATE — annoncer le contraire
            // ferait passer pour vérifié le seul maillon qui ne l'est pas.
            detail:
                "Le trigger est actif, pg_net a émis la requête, le service l'a reçue et le token a été accepté. Tout le transport est fonctionnel — reste le déclenchement sur modification réelle, que ce test ne couvre pas.",
            remedy: null,
            url,
            triggerName,
            statusCode: code,
        }
    }

    if (code === 401) {
        return {
            tone: "destructive",
            title: "Token refusé par le service",
            detail:
                "Le service répond, mais rejette l'en-tête x-webhook-token du trigger. Les deux valeurs ont divergé.",
            remedy:
                "Réaligner le header x-webhook-token du webhook sur le secret WEBHOOK_SECRET injecté au conteneur.",
            url,
            triggerName,
            statusCode: code,
        }
    }

    if (code === 404) {
        return {
            tone: "destructive",
            title: "Route introuvable",
            detail:
                "L'hôte répond, mais l'URL appelée par le trigger ne correspond à aucune route du service.",
            remedy:
                "Vérifier que l'URL du webhook pointe bien sur /webhook, et que le proxy ne réécrit pas le chemin.",
            url,
            triggerName,
            statusCode: code,
        }
    }

    if (code !== null && code >= 500) {
        return {
            tone: "destructive",
            title: `Erreur ${code} en réponse`,
            detail:
                "La requête atteint le proxy, mais le service ne répond pas correctement — conteneur arrêté, en boucle de redémarrage, ou proxy pointant vers le mauvais port.",
            remedy:
                "Regarder les logs du conteneur newsletter_console et l'état du reverse proxy.",
            url,
            triggerName,
            statusCode: code,
        }
    }

    return {
        tone: "warning",
        title: `Réponse inattendue (${code ?? "sans code"})`,
        detail:
            "Le service a répondu, mais pas ce qu'on attend d'un webhook accepté.",
        remedy: "Consulter le journal de l'API dans l'onglet Logs.",
        url,
        triggerName,
        statusCode: code,
    }
}
