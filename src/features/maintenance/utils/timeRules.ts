/**
 * Règles horaires d'édition d'une fenêtre de maintenance.
 *
 * Reprises telles quelles de `manager/components/Maintenance/utils/timeRules.ts` :
 * elles dépendent de l'instant de l'édition, pas de la ligne, et restent
 * donc applicatives (la base ne porte que la cohérence de la fenêtre —
 * contrainte `app_maintenance_window_ordered`).
 */
export interface TimeDiffInfo {
    /** Millisecondes jusqu'au début, ou null si aucune date. */
    diffMs: number | null
    /** Édition verrouillée : le créneau est trop proche. */
    lessThan12h: boolean
    /** Activation autorisée : on entre dans la fenêtre d'intervention. */
    lessThan4h: boolean
    /** Le créneau est passé. */
    inPast: boolean
}

const HOUR_MS = 1000 * 60 * 60

export function getTimeDiffInfo(date?: string | null): TimeDiffInfo {
    if (!date) {
        return {
            diffMs: null,
            lessThan12h: false,
            lessThan4h: false,
            inPast: false,
        }
    }

    const diff = new Date(date).getTime() - Date.now()

    return {
        diffMs: diff,
        lessThan12h: diff <= HOUR_MS * 12,
        lessThan4h: diff <= HOUR_MS * 4,
        inPast: diff <= 0,
    }
}
