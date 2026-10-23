export function formatMessageTime(
    isoDate: string,
    locale: string = "fr-FR"
): string {
    const date = new Date(isoDate)
    if (Number.isNaN(date.getTime())) return ""
    return date.toLocaleTimeString(locale)
}

export function formatMessageDate(
    isoDate: string,
    locale: string = "fr-FR"
): string {
    const date = new Date(isoDate)
    if (Number.isNaN(date.getTime())) return ""
    return date.toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    })
}

export function formatMessageDateTime(
    isoDate: string,
    locale: string = "fr-FR"
): string {
    const date = new Date(isoDate)
    if (Number.isNaN(date.getTime())) return ""
    const d = date.toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    })
    const t = date.toLocaleTimeString(locale)
    return `${d} - ${t}`
}

export function formatFileSize(bytes?: number | null): string {
    if (!bytes || bytes <= 0) return ""
    const sizeKb = bytes / 1024
    if (sizeKb < 1024) return `${sizeKb.toFixed(1)} KB`
    const sizeMb = sizeKb / 1024
    return `${sizeMb.toFixed(1)} MB`
}

/**
 * Heure courte d'un message : "14:23".
 *
 * Les bulles affichaient jusqu'ici `formatMessageDateTime` en entier
 * ("01/09/2026 - 14:23:45"), secondes comprises, sur *chaque* message. La date
 * complète reste disponible en infobulle et via les séparateurs de jour.
 */
export function formatMessageTimeShort(
    isoDate: string,
    locale: string = "fr-FR"
): string {
    const date = new Date(isoDate)
    if (Number.isNaN(date.getTime())) return ""
    return date.toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
    })
}

/** Clé de regroupement par jour civil local (jamais affichée). */
export function getDayKey(isoDate: string): string {
    const date = new Date(isoDate)
    if (Number.isNaN(date.getTime())) return ""
    // Composants locaux, pas `toISOString()` : ce dernier bascule en UTC et
    // rangerait un message de 23h30 dans le jour suivant.
    const month = `${date.getMonth() + 1}`.padStart(2, "0")
    const day = `${date.getDate()}`.padStart(2, "0")
    return `${date.getFullYear()}-${month}-${day}`
}

/** Libellé d'un séparateur de jour : "Aujourd'hui", "Hier", ou la date. */
export function formatDayLabel(
    isoDate: string,
    locale: string = "fr-FR",
    now: Date = new Date()
): string {
    const date = new Date(isoDate)
    if (Number.isNaN(date.getTime())) return ""

    const key = getDayKey(isoDate)
    if (key === getDayKey(now.toISOString())) return "Aujourd'hui"

    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (key === getDayKey(yesterday.toISOString())) return "Hier"

    // L'année n'est utile que hors année courante — l'ajouter systématiquement
    // alourdit un séparateur qui revient tous les jours.
    const sameYear = date.getFullYear() === now.getFullYear()
    return date.toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        ...(sameYear ? {} : { year: "numeric" }),
    })
}
