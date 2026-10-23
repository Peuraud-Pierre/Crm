import {
    MIN_CURVE_POINTS,
    STALLED_IMPORT_MINUTES,
} from "@/features/packing-admin/constants"
import { formatDateTime, formatShare } from "@/features/packing-admin/utils/format"
import type {
    PackingAdminAlert,
    PackingDictionaryConflict,
    PackingImportRow,
    PackingModelMiss,
    PackingModelStats,
    PackingReplayReport,
    PackingServiceStatus,
} from "@/features/packing-admin/types"

/**
 * Alertes de la console. Fonction PURE : elle ne lit que ce qu'on lui passe, ce
 * qui la rend testable sans monter un composant — même principe que
 * `arrivage-admin/utils/alerts.ts`.
 *
 * Deux règles de fond :
 *
 *  1. **Le tableau est vide quand tout va bien.** L'absence de bandeau est elle
 *     même l'information ; une alerte permanente cesse d'être lue.
 *  2. **Chaque description porte l'ACTION à mener**, pas seulement le constat.
 *     « Le service ne répond pas » n'aide personne si la correction dépend de
 *     savoir s'il est arrêté ou s'il refuse la session.
 *
 * Les alertes sont rendues de la plus grave à la moins grave.
 */

export interface PackingAlertInput {
    /** `PUBLIC_PACKING_API_URL` est-elle posée dans cet environnement ? */
    apiConfigured: boolean
    /** `/health` répond-il ? `null` : pas encore sondé. */
    reachable: boolean | null
    status: PackingServiceStatus | null
    /** Erreur de la dernière lecture de `/status`, avec son code HTTP s'il y en a. */
    statusError: { message: string; status: number | null } | null
    model: PackingModelStats | null
    replay: PackingReplayReport | null
    imports: PackingImportRow[]
    misses: PackingModelMiss[]
    conflicts: PackingDictionaryConflict[]
    /** Vrai quand la table du journal n'existe pas encore (migration à appliquer). */
    feedbackTableMissing: boolean
}

export function buildPackingAdminAlerts(input: PackingAlertInput): PackingAdminAlert[] {
    const alerts: PackingAdminAlert[] = []

    // ── Le service est-il là, et nous parle-t-il ? ────────────────────────────
    // La configuration passe AVANT la joignabilité : sans URL, « injoignable »
    // désignerait une panne là où il n'y a qu'une variable manquante, et enverrait
    // regarder le mauvais endroit.
    if (!input.apiConfigured) {
        alerts.push({
            id: "api-unconfigured",
            level: "error",
            title: "Service de classement non configuré",
            detail:
                "La variable PUBLIC_PACKING_API_URL est absente de cet environnement. La console ne montre que ce que la base sait : ni l'état du service, ni la courbe d'apprentissage.",
        })
        return alerts
    }

    if (input.reachable === false) {
        alerts.push({
            id: "api-unreachable",
            level: "error",
            title: "Service de classement injoignable",
            detail:
                "Le service ne répond pas. Les imports de packing list échoueront tant qu'il est à l'arrêt, et les chiffres du modèle affichés ici sont ceux du dernier état connu.",
        })
        // Inutile d'empiler les symptômes d'une seule panne.
        return alerts
    }

    if (input.statusError) {
        const refused = input.statusError.status === 401 || input.statusError.status === 403
        alerts.push({
            id: refused ? "api-forbidden" : "status-error",
            level: "error",
            title: refused ? "Le service refuse la session" : "État du service indisponible",
            detail: refused
                ? "Le service répond mais refuse la requête. Deux causes distinctes : une session sans MFA (se reconnecter en validant le second facteur), ou le droit « stock.packing.view » manquant (à accorder depuis Administration)."
                : input.statusError.message,
        })
    }

    // ── La version du normaliseur ─────────────────────────────────────────────
    // Panne silencieuse par excellence : le dictionnaire cesse simplement de
    // reconnaître, la charge de vérification remonte, et rien ne le signale.
    const serviceNormalizer = input.status?.normalizer_version
    const dictionaryEntries = input.model?.dictionary_entries ?? 0
    if (serviceNormalizer !== undefined && dictionaryEntries === 0 && (input.model?.examples ?? 0) > 0) {
        alerts.push({
            id: "dictionary-empty",
            level: "warning",
            title: "Le tableau de correspondances est vide",
            detail: `Des décisions humaines existent (${input.model?.examples}) mais aucune correspondance n'est enregistrée. Vérifier que la version du normaliseur du service (v${serviceNormalizer}) est bien celle des lignes en base : si elles divergent, plus rien n'est reconnu et personne n'en est averti.`,
            tab: "ecarts",
        })
    }

    // ── Le classement seul est-il actif ? ─────────────────────────────────────
    if (input.model && input.model.threshold === null) {
        const missing = Math.max(0, input.model.min_evidence - input.model.evidence)
        alerts.push({
            id: "threshold-inactive",
            level: "warning",
            title: "Le modèle ne classe pas encore seul",
            detail:
                missing > 0
                    ? `Il manque ${missing} proposition(s) vérifiée(s) sur les ${input.model.min_evidence} exigées (${input.model.evidence} à ce jour). D'ici là le modèle propose, sans jamais décider.`
                    : `Les ${input.model.evidence} propositions vérifiées suffisent en nombre, mais leur précision mesurée (${formatShare(input.model.overall_precision)}) reste sous la cible de ${formatShare(input.model.target_precision)}. Corriger ses erreurs récentes est ce qui la fera remonter.`,
            tab: "ecarts",
        })
    }

    // ── Le chiffre qui doit rester à zéro ─────────────────────────────────────
    const autoWrong = input.replay?.steps.reduce((sum, step) => sum + step.auto_wrong, 0) ?? 0
    if (autoWrong > 0) {
        alerts.push({
            id: "auto-wrong",
            level: "error",
            title: `${autoWrong} ligne(s) classée(s) seule(s) à tort`,
            detail:
                "Le modèle a tranché sans qu'un humain regarde, et il avait tort. C'est le seul chiffre qui ne doit jamais bouger : vérifier les écarts, puis relever la précision cible dans l'onglet Simulation avant de la porter en configuration du service.",
            tab: "ecarts",
        })
    }

    const autoMisses = input.misses.filter((m) => m.was_auto).length
    if (autoMisses > 0 && autoWrong === 0) {
        alerts.push({
            id: "auto-corrected",
            level: "warning",
            title: `${autoMisses} auto-classement(s) corrigé(s) à la main`,
            detail:
                "Des lignes classées au-dessus du seuil ont été corrigées par un relecteur. La garde est donc passée un peu trop large sur ces libellés.",
            tab: "ecarts",
        })
    }

    // ── L'état des imports ────────────────────────────────────────────────────
    const failed = input.imports.filter((row) => row.status === "echec")
    if (failed.length > 0) {
        const last = failed[0]
        alerts.push({
            id: "imports-failed",
            level: "error",
            title: `${failed.length} import(s) en échec`,
            detail: `Dernier échec le ${formatDateTime(last.imported_at)}${
                last.container_label ? ` (${last.container_label})` : ""
            } : ${last.error_message ?? "aucun message enregistré"}.`,
            tab: "imports",
        })
    }

    const stalledBefore = Date.now() - STALLED_IMPORT_MINUTES * 60_000
    const stalled = input.imports.filter(
        (row) => row.status === "en_traitement" && new Date(row.imported_at).getTime() < stalledBefore,
    )
    if (stalled.length > 0) {
        alerts.push({
            id: "imports-stalled",
            level: "warning",
            title: `${stalled.length} import(s) bloqué(s) en traitement`,
            detail: `En traitement depuis plus de ${STALLED_IMPORT_MINUTES} minutes. Le service a probablement redémarré en cours d'import : remplacer le fichier depuis la sheet de l'arrivage.`,
            tab: "imports",
        })
    }

    // ── Le dictionnaire contredit ─────────────────────────────────────────────
    if (input.conflicts.length > 0) {
        const repeats = input.conflicts.reduce((sum, c) => sum + c.hit_count, 0)
        alerts.push({
            id: "dictionary-contradicted",
            level: "warning",
            title: `${input.conflicts.length} correspondance(s) contredite(s)`,
            detail: `Une décision humaine plus récente dit autre chose que le tableau, qui a déjà servi ${repeats} fois. Le tableau ne reconnaît que des libellés identiques : une erreur apprise se répète à l'identique sur tous les conteneurs suivants, elle ne se corrige jamais d'elle-même. À reprendre dans Stock → Paramètres → Correspondances.`,
            tab: "ecarts",
        })
    }

    // ── Migration pas encore appliquée ────────────────────────────────────────
    if (input.feedbackTableMissing) {
        alerts.push({
            id: "feedback-table-missing",
            level: "info",
            title: "Journal des décisions indisponible",
            detail:
                "La table packing_label_feedback n'existe pas encore : la migration 20260918100000 n'est pas appliquée. Les écarts du modèle resteront vides jusque-là.",
            tab: "ecarts",
        })
    }

    // ── Trop tôt pour une courbe ──────────────────────────────────────────────
    const validated = input.replay?.total_packings ?? 0
    if (input.replay && validated < MIN_CURVE_POINTS) {
        alerts.push({
            id: "curve-too-early",
            level: "info",
            title: "Pas encore de courbe d'apprentissage",
            detail: `Il faut ${MIN_CURVE_POINTS} conteneurs validés pour qu'une tendance veuille dire quelque chose (${validated} à ce jour). D'ici là, les chiffres sont justes mais ne dessinent rien.`,
        })
    }

    // Tri STABLE par gravité : les règles sont écrites dans l'ordre où on les
    // raconte (le service, puis le modèle, puis les imports), ce qui n'est pas
    // l'ordre où il faut les lire. `sort` de V8 est stable, donc l'ordre narratif
    // survit à gravité égale.
    return alerts.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level])
}

const LEVEL_RANK: Record<PackingAdminAlert["level"], number> = {
    error: 0,
    warning: 1,
    info: 2,
}
