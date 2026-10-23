export function formatDate(value: string): string {
    if (!value) return "Date à définir"
    const date = new Date(value)
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
          })
}

export function getTaskAge(createdAt: string): string {
    const created = new Date(createdAt)
    if (Number.isNaN(created.getTime())) return ""
    const now = new Date()
    const diffMs = now.getTime() - created.getTime()
    const diffMin = Math.floor(diffMs / 60_000)
    const diffH = Math.floor(diffMin / 60)
    const diffD = Math.floor(diffH / 24)
    const diffW = Math.floor(diffD / 7)
    const diffM = Math.floor(diffD / 30)

    if (diffMin < 1) return "à l'instant"
    if (diffMin < 60) return `${diffMin} min`
    if (diffH < 24) return `${diffH}h`
    if (diffD < 7) return `${diffD}j`
    if (diffW < 5) return `${diffW} sem.`
    if (diffM < 12) return `${diffM} mois`
    return `${Math.floor(diffD / 365)} an${Math.floor(diffD / 365) > 1 ? "s" : ""}`
}

export function formatDateRange(start: string, end: string): string {
    if (start && end) return `${formatDate(start)} → ${formatDate(end)}`
    if (start) return `À partir du ${formatDate(start)}`
    if (end) return `Jusqu'au ${formatDate(end)}`
    return "Dates à définir"
}
