/**
 * Formatage des valeurs Matomo pour l'affichage, en un seul endroit.
 *
 * Trois `fmtInt` et deux `secondsToHMS` coexistaient, avec des résultats
 * différents pour la même donnée (une durée nulle valait « 0s » dans les KPI
 * et « — » dans le profil visiteur).
 */

/** Matomo renvoie des nombres ou des chaînes numériques selon l'endpoint. */
export function fmtInt(value: unknown): string {
    const n = Number(value)
    return value != null && value !== "" && Number.isFinite(n)
        ? n.toLocaleString("fr-FR")
        : "—"
}

/** « 42 s », « 3 min 05 s », « 1 h 12 min ». Absent → « — », zéro → « 0 s ». */
export function fmtDuration(seconds: unknown): string {
    const s = Number(seconds)
    if (seconds == null || seconds === "" || !Number.isFinite(s) || s < 0)
        return "—"
    if (s < 60) return `${Math.round(s)} s`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m} min ${String(Math.round(s % 60)).padStart(2, "0")} s`
    return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`
}

/** Matomo renvoie le taux de rebond déjà formaté (« 42% ») ou un nombre. */
export function fmtRate(value: unknown): string {
    if (value == null || value === "") return "—"
    const n = typeof value === "number" ? value : Number.parseFloat(String(value))
    return Number.isFinite(n) ? `${n.toLocaleString("fr-FR")} %` : String(value)
}

/** Le mot seul, accordé : `pluralWord(3, "visite")` → « visites ». */
export const pluralWord = (n: unknown, singular: string, pluralForm = `${singular}s`) =>
    Math.abs(Number(n)) >= 2 ? pluralForm : singular

/** Accord simple : `plural(1, "visiteur")` → « 1 visiteur ». */
export function plural(n: number, singular: string, pluralForm = `${singular}s`) {
    return `${fmtInt(n)} ${Math.abs(n) >= 2 ? pluralForm : singular}`
}

const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" })
const DAY_YEAR = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" })
const DATE_TIME = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
})
const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" })

const localDate = (iso: string) => {
    const [y, m, d = 1] = iso.split("-").map(Number)
    return new Date(y, m - 1, d)
}

/**
 * Clé de période Matomo → libellé d'axe :
 * « 2026-09-30 » → « 30 sept. », « 2026-09-28,2026-10-04 » → « sem. du 28 sept. »,
 * « 2026-09 » → « sept. 2026 ». Toute autre forme est rendue telle quelle.
 */
export function fmtPeriodKey(key: string): string {
    if (/^\d{4}-\d{2}-\d{2},/.test(key))
        return `sem. du ${DAY.format(localDate(key.split(",")[0]))}`
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return DAY.format(localDate(key))
    if (/^\d{4}-\d{2}$/.test(key)) return MONTH.format(localDate(key))
    return key
}

/**
 * Plage ISO → « 5 sept. → 4 oct. 2026 ». L'année n'apparaît qu'une fois quand
 * elle est commune, et un seul jour s'écrit sans flèche.
 */
export function fmtSpan(from: string, to: string): string {
    if (from === to) return DAY_YEAR.format(localDate(from))
    const sameYear = from.slice(0, 4) === to.slice(0, 4)
    const start = sameYear ? DAY.format(localDate(from)) : DAY_YEAR.format(localDate(from))
    return `${start} → ${DAY_YEAR.format(localDate(to))}`
}

/** Horodatage Unix (s) → « 4 oct., 14:32 » dans le fuseau du navigateur. */
export const fmtTimestamp = (seconds: unknown) => {
    const n = Number(seconds)
    return Number.isFinite(n) && n > 0 ? DATE_TIME.format(new Date(n * 1000)) : ""
}

/** Types de référent Matomo (`referrerType`) dans la langue de la Console. */
const REFERRER_LABELS: Record<string, string> = {
    direct: "Accès direct",
    search: "Moteur de recherche",
    website: "Site web",
    campaign: "Campagne",
    social: "Réseau social",
}

export const fmtReferrerType = (type?: string) =>
    (type && REFERRER_LABELS[type]) || type || ""

/** Libellés de canaux de `Referrers.getReferrerType`, renvoyés en anglais. */
const CHANNEL_LABELS: Record<string, string> = {
    "Direct Entry": "Accès direct",
    "Search Engines": "Moteurs de recherche",
    Websites: "Sites web",
    Campaigns: "Campagnes",
    "Social Networks": "Réseaux sociaux",
    "AI Assistants": "Assistants IA",
}

export const fmtChannelLabel = (label: string) => CHANNEL_LABELS[label] ?? label
