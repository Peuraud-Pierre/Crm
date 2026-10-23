import { format } from "date-fns"
import { fr } from "date-fns/locale"

/**
 * Lecture d'une expédition : date de déchargement et alerte facture.
 *
 * Les deux modules de stock suivent le même cycle — une expédition est
 * planifiée, part, arrive, et doit être facturée avant d'être déchargée. Ces
 * trois fonctions portaient exactement le même code de part et d'autre.
 *
 * Aucune entité métier ici : les fonctions travaillent sur la forme minimale
 * `{ prev_dechargement_at, invoice_date, status }`, que les deux modules
 * partagent.
 */

/** Déchargement prévu, décomposé pour un affichage sur deux lignes. */
export function parseDechargement(ts: string | null | undefined) {
    if (!ts) return null
    try {
        const d = new Date(ts)
        return {
            jour: format(d, "EEEE", { locale: fr }),
            date: format(d, "dd/MM/yy"),
            heure: format(d, "HH:mm"),
        }
    } catch {
        return null
    }
}

/**
 * Jours d'ici au déchargement. Positif = à venir, négatif = dépassé, 0 =
 * aujourd'hui.
 *
 * `now` est injectable pour les tests (export des arrivages, alignement avec
 * la newsletter) ; les écrans l'omettent.
 */
export function daysFromDechargement(
    ts: string | null | undefined,
    now: Date = new Date(),
): number | null {
    if (!ts) return null
    try {
        return Math.ceil((new Date(ts).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    } catch {
        return null
    }
}

/**
 * Lecture d'une date de jalon.
 *
 * Reprend la précaution des deux fichiers de colonnes : une date seule
 * (YYYY-MM-DD) se lit à minuit LOCAL et non UTC, sans quoi elle recule d'un
 * jour à l'ouest de Greenwich. Ces fichiers gardent leur propre copie — les
 * fusionner changerait un rendu que des tests d'iso-comportement fixent.
 */
function parseShipmentDate(d: string | null | undefined): Date | null {
    if (!d) return null
    const date = d.length === 10 ? new Date(`${d}T00:00`) : new Date(d)
    return Number.isNaN(date.getTime()) ? null : date
}

/** Date d'étape, formatée pour la frise. */
export function formatShipmentDate(d: string | null | undefined): string | null {
    const date = parseShipmentDate(d)
    return date ? format(date, "dd/MM/yy") : null
}

/**
 * État d'un segment de trajet — celui que parcourt un véhicule sur la frise.
 *
 *   unknown : une des deux bornes manque, aucune progression calculable
 *   pending : le trajet n'a pas commencé
 *   moving  : en cours, `ratio` dit où
 *   done    : terminé
 */
export type LegState = "unknown" | "pending" | "moving" | "done"

export interface LegProgress {
    state: LegState
    /** Part du trajet écoulée, de 0 à 1. Vaut 0 ou 1 en dehors du trajet. */
    ratio: number
}

/**
 * Avancement d'un segment, du temps écoulé entre ses deux bornes.
 *
 * C'est une DONNÉE et non une décoration : la position du véhicule sur la
 * frise en découle, et doit donc se lire comme « voilà où en est ce trajet ».
 * D'où le `ratio` borné à [0, 1] — un départ dépassé ne pousse pas le véhicule
 * au-delà de son arrivée.
 *
 * `now` est injectable pour les tests : sans cela, aucune assertion sur un
 * trajet en cours ne serait reproductible.
 */
export function legProgress(
    from: string | null | undefined,
    to: string | null | undefined,
    now: number = Date.now(),
): LegProgress {
    const start = parseShipmentDate(from)?.getTime() ?? null
    const end = parseShipmentDate(to)?.getTime() ?? null

    if (start === null || end === null) return { state: "unknown", ratio: 0 }
    if (now >= end) return { state: "done", ratio: 1 }
    if (now <= start) return { state: "pending", ratio: 0 }

    // `end > start` est garanti ici : le cas `end <= start` (dates inversées ou
    // identiques) est déjà sorti par `now >= end`.
    return { state: "moving", ratio: (now - start) / (end - start) }
}

/**
 * Échéance du déchargement, en toutes lettres.
 *
 * Le tableau signale les prochaines expéditions par leur RANG (les cinq
 * suivantes) ; une fiche ouverte seule n'a pas ce classement, et une date brute
 * n'apprend rien sans compter les jours de tête. D'où ce libellé.
 */
export function dechargementCountdown(
    ts: string | null | undefined,
): { days: number; label: string } | null {
    const days = daysFromDechargement(ts)
    if (days === null) return null

    if (days === 0) return { days, label: "aujourd'hui" }
    if (days === 1) return { days, label: "demain" }
    if (days === -1) return { days, label: "hier" }
    if (days > 1) return { days, label: `dans ${days} jours` }
    return { days, label: `il y a ${-days} jours` }
}

interface InvoiceAlertSubject {
    prev_dechargement_at: string | null
    invoice_date: string | null
    status: string
}

/**
 * Une expédition qui approche de son déchargement sans facture est un incident
 * comptable et douanier — c'est ce que signale la ligne rouge du tableau.
 *
 * L'alerte ne se déclenche que sur un déchargement À VENIR : une fois la date
 * passée, l'expédition n'est plus un incident à prévenir mais un fait à
 * régulariser, et laisser la ligne rouge indéfiniment noierait les vraies
 * alertes. Une expédition annulée n'alerte jamais.
 */
export function isInvoiceAlert(
    row: InvoiceAlertSubject,
    withinDays: number,
    now: Date = new Date(),
): boolean {
    if (row.invoice_date) return false
    if (row.status === "annulé") return false
    const days = daysFromDechargement(row.prev_dechargement_at, now)
    if (days === null) return false
    return days >= 0 && days <= withinDays
}
