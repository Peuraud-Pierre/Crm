/** Formatage partagé par les trois onglets. Aucun état, aucune dépendance React. */

export function formatDate(iso: string | null): string {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    })
}

export function formatDateTime(iso: string | null): string {
    if (!iso) return "—"
    return new Date(iso).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

export function formatTime(iso: string | null): string {
    if (!iso) return "—"
    return new Date(iso).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })
}

/** Durée lisible : « 320 ms », « 4,2 s », « 3 min 12 s ». */
export function formatDuration(ms: number | null): string {
    if (ms === null || Number.isNaN(ms)) return "—"
    if (ms < 1000) return `${ms} ms`

    const seconds = ms / 1000
    if (seconds < 60) return `${seconds.toFixed(1).replace(".", ",")} s`

    const minutes = Math.floor(seconds / 60)
    const rest = Math.round(seconds % 60)
    return `${minutes} min ${rest} s`
}

export function formatBytes(bytes: number | null): string {
    if (bytes === null || bytes <= 0) return "—"
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`
}

export function formatPercent(ratio: number): string {
    return `${(ratio * 100).toFixed(1).replace(".", ",")} %`
}

/** Étiquette courte d'un jour de la série journalière (« 14/08 »). */
export function formatDayLabel(isoDate: string): string {
    const [, month, day] = isoDate.split("-")
    return `${day}/${month}`
}

/** Un uuid tronqué, comme le faisait déjà la table des codes. */
export function shortId(id: string | null): string {
    if (!id) return "—"
    return id.length > 8 ? `${id.slice(0, 8)}…` : id
}
