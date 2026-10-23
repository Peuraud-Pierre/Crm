import { isSameDay } from "date-fns"

/**
 * Calcul de la date de Pâques (algorithme de Butcher/Meeus).
 */
function computeEaster(year: number): Date {
    const a = year % 19
    const b = Math.floor(year / 100)
    const c = year % 100
    const d = Math.floor(b / 4)
    const e = b % 4
    const f = Math.floor((b + 8) / 25)
    const g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4)
    const k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451)
    const month = Math.floor((h + l - 7 * m + 114) / 31)
    const day = ((h + l - 7 * m + 114) % 31) + 1
    return new Date(year, month - 1, day)
}

export interface JourFerie {
    date: Date
    nom: string
}

/**
 * Renvoie la liste des jours fériés français pour une année donnée.
 */
export function getJoursFeries(year: number): JourFerie[] {
    const easter = computeEaster(year)
    const easterMs = easter.getTime()
    const day = 86400000 // ms dans un jour

    return [
        { date: new Date(year, 0, 1), nom: "Jour de l'An" },
        { date: new Date(easterMs + 1 * day), nom: "Lundi de Pâques" },
        { date: new Date(year, 4, 1), nom: "Fête du Travail" },
        { date: new Date(year, 4, 8), nom: "Victoire 1945" },
        { date: new Date(easterMs + 39 * day), nom: "Ascension" },
        { date: new Date(easterMs + 50 * day), nom: "Lundi de Pentecôte" },
        { date: new Date(year, 6, 14), nom: "Fête Nationale" },
        { date: new Date(year, 7, 15), nom: "Assomption" },
        { date: new Date(year, 10, 1), nom: "Toussaint" },
        { date: new Date(year, 10, 11), nom: "Armistice 1918" },
        { date: new Date(year, 11, 25), nom: "Noël" },
    ]
}

/**
 * Vérifie si un jour donné est férié et renvoie le nom, ou null.
 */
export function getJourFerie(day: Date): string | null {
    const feries = getJoursFeries(day.getFullYear())
    const match = feries.find((f) => isSameDay(f.date, day))
    return match ? match.nom : null
}
