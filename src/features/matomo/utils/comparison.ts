/**
 * Plages de dates de la vue et de sa période de comparaison.
 *
 * Les vues glissantes portent sur des périodes COMPLÈTES, qui s'arrêtent hier
 * (ou à la dernière semaine / au dernier mois clos) — comme « 28 derniers
 * jours » dans Google Analytics. Inclure la journée entamée biaisait chaque
 * comparaison vers la baisse (≈ −25 % le matin sur « 2 derniers jours ») et
 * faisait plonger le dernier point de la courbe.
 *
 * Les dates sont toujours explicites (`date=début,fin`) : en `period=range`
 * Matomo agrège lui-même (visiteurs uniques dédupliqués, une ligne par canal ou
 * par page) ; en `period=day|week|month` il renvoie la série de la courbe.
 */

/** Libellés de la référence : court à l'écran, long pour les lecteurs d'écran. */
export interface CompareLabel {
    short: string
    spoken: string
}

export interface DateSpan {
    from: string
    to: string
}

export interface PeriodRanges {
    /** Granularité des séries (courbe, pays) : day, week ou month. */
    period: string
    current: DateSpan
    /** `null` : pas de comparaison (« Aujourd'hui », journée entamée). */
    previous: DateSpan | null
}

export const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

const addDays = (d: Date, n: number) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

const span = (from: Date, to: Date): DateSpan => ({ from: iso(from), to: iso(to) })

/** Lundi de la semaine de `d` : Matomo découpe les semaines du lundi au dimanche. */
const weekStart = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))

/** Dernier jour du mois `monthIndex` (débordements gérés par Date). */
const monthEnd = (y: number, monthIndex: number) => new Date(y, monthIndex + 1, 0)

/**
 * ponytail: dates du navigateur, pas du fuseau du site Matomo — décalage d'un
 * jour possible autour de minuit si les deux diffèrent ; passer le fuseau du
 * site (SitesManager) si ça gêne.
 */
export function periodRanges(periodKey: string, today: Date = new Date()): PeriodRanges {
    const [period, date] = periodKey.split(":")
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())

    if (date === "today") return { period: "day", current: span(t, t), previous: null }
    if (date === "yesterday") {
        const y = addDays(t, -1)
        const before = addDays(t, -2)
        return { period: "day", current: span(y, y), previous: span(before, before) }
    }

    const n = Number(/^last(\d+)$/.exec(date)?.[1]) || 1

    if (period === "week") {
        const ws = weekStart(t)
        return {
            period,
            current: span(addDays(ws, -7 * n), addDays(ws, -1)),
            previous: span(addDays(ws, -14 * n), addDays(ws, -7 * n - 1)),
        }
    }
    if (period === "month") {
        const y = t.getFullYear()
        const m = t.getMonth()
        return {
            period,
            current: span(new Date(y, m - n, 1), monthEnd(y, m - 1)),
            previous: span(new Date(y, m - 2 * n, 1), monthEnd(y, m - n - 1)),
        }
    }
    return {
        period: "day",
        current: span(addDays(t, -n), addDays(t, -1)),
        previous: span(addDays(t, -2 * n), addDays(t, -n - 1)),
    }
}

export type Tone = "good" | "bad" | "flat" | "none"

export interface Delta {
    tone: Tone
    /** Texte visible : « +12 % », « \u22123,2 pts », « stable », « aucune donnée avant ». */
    text: string
    /** Sens, pour la flèche et les lecteurs d'écran. */
    direction: "up" | "down" | null
}

/** Sous ce seuil, l'écart est du bruit : affiché « stable », sans couleur. */
const FLAT_PERCENT = 2
const FLAT_POINTS = 1

const MINUS = "\u2212"
const fmtSigned = (v: number, unit: string) => {
    const abs = Math.abs(v).toLocaleString("fr-FR", {
        maximumFractionDigits: Math.abs(v) < 10 ? 1 : 0,
    })
    return `${v < 0 ? MINUS : "+"}${abs}\u00a0${unit}`
}

/**
 * Écart entre deux valeurs d'un KPI.
 * - `higherIsBetter` : vrai partout sauf pour le taux de rebond.
 * - `points` : pour un taux, l'écart se lit en points, pas en % d'un %.
 */
export function compareKpi(
    current: unknown,
    previous: unknown,
    { higherIsBetter = true, points = false } = {}
): Delta | null {
    const cur = Number.parseFloat(String(current))
    const prev = Number.parseFloat(String(previous))
    if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null

    let diff: number
    if (points) {
        diff = cur - prev
    } else {
        if (prev === 0)
            return cur === 0
                ? { tone: "flat", text: "stable", direction: null }
                : { tone: "none", text: "aucune donnée avant", direction: null }
        diff = ((cur - prev) / prev) * 100
    }

    if (Math.abs(diff) < (points ? FLAT_POINTS : FLAT_PERCENT))
        return { tone: "flat", text: "stable", direction: null }

    const up = diff > 0
    return {
        tone: up === higherIsBetter ? "good" : "bad",
        text: fmtSigned(diff, points ? "pts" : "%"),
        direction: up ? "up" : "down",
    }
}
