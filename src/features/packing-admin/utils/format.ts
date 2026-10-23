/**
 * Formatage de la console. Pur, testé, hors composant — comme
 * `arrivage-admin/utils/format.ts`, dont ce fichier reprend le rôle.
 */

const EMPTY = "—"

const percentFormatter = new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 1,
})

const dateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
})

/** Part sur 0-1 → « 67 % ». `null` n'est pas « 0 % » : c'est « on ne sait pas ». */
export function formatShare(value: number | null | undefined): string {
    return value === null || value === undefined ? EMPTY : percentFormatter.format(value)
}

/**
 * Confiance d'une proposition, plus précise qu'un pourcentage arrondi : la
 * différence entre 0,981 et 0,990 décide si la garde laisse passer, donc elle
 * doit se voir.
 */
export function formatConfidence(value: number | null | undefined): string {
    return value === null || value === undefined ? EMPTY : value.toFixed(3)
}

export function formatDateTime(value: string | null | undefined): string {
    if (!value) return EMPTY
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? EMPTY : dateTimeFormatter.format(date)
}

/** Durée de fonctionnement en « 3 j 4 h », « 12 min », « 45 s ». */
export function formatUptime(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return EMPTY
    const s = Math.max(0, Math.floor(seconds))
    if (s < 60) return `${s} s`

    const minutes = Math.floor(s / 60)
    if (minutes < 60) return `${minutes} min`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} h ${minutes % 60} min`

    const days = Math.floor(hours / 24)
    return `${days} j ${hours % 24} h`
}
