/**
 * eventForm.ts — État initial du formulaire "Nouvelle interaction" (AddEventModal).
 *
 * Centralise la construction de l'état du formulaire pour qu'il soit réinitialisé
 * proprement à CHAQUE ouverture de la modale (création comme édition). Les dates
 * sont formatées en heure LOCALE (helpers ci-dessous) pour les `<input type="date">`,
 * ce qui évite le décalage d'un jour induit par `toISOString()` (UTC).
 */

import type { activites } from "@/features/crm/types"

/** Formate une date en YYYY-MM-DD en heure locale (évite le décalage UTC). */
export const toLocalDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
    ).padStart(2, "0")}`

/** Formate une date en HH:MM en heure locale. */
export const toLocalTimeStr = (d: Date) =>
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(
        2,
        "0"
    )}`

export interface MainActivityState {
    title: string
    date: string
    time: string
    description: string
}

export interface RdvState {
    enabled: boolean
    type: string
    owner: string
    startDate: string
    startTime: string
    endDate: string
    endTime: string
    description: string
}

export interface TaskState {
    enabled: boolean
    type: string
    owner: string
    date: string
    time: string
    content: string
}

export interface EventFormState {
    mainActivity: MainActivityState
    rdvData: RdvState
    taskData: TaskState
    selectedDelayValue: string
}

/**
 * Construit l'état initial du formulaire.
 * - Création (`!edit || !event`) : valeurs par défaut, tâche attribuée à `userId`.
 * - Édition : reprend `event` (titre, compte-rendu, et RDV lié si présent) en
 *   dates LOCALES.
 */
export function buildEventFormState(
    edit: boolean,
    event: activites | null,
    userId: string | undefined,
    now: Date
): EventFormState {
    const todayStr = toLocalDateStr(now)

    const state: EventFormState = {
        mainActivity: {
            title: "",
            date: todayStr,
            time: toLocalTimeStr(now),
            description: "",
        },
        rdvData: {
            enabled: false,
            type: "",
            owner: "",
            startDate: todayStr,
            startTime: "12:00",
            endDate: todayStr,
            endTime: "13:00",
            description: "",
        },
        taskData: {
            enabled: false,
            type: "",
            owner: userId ?? "",
            date: todayStr,
            time: "",
            content: "",
        },
        selectedDelayValue: "",
    }

    if (!edit || !event) return state

    let d = event.date ? new Date(event.date) : new Date()
    if (isNaN(d.getTime())) d = new Date()
    state.mainActivity = {
        title: event.title || "",
        description: event.content || "",
        date: toLocalDateStr(d),
        time: toLocalTimeStr(d),
    }

    if (event.rdv) {
        const start = new Date(event.rdv.debut as string)
        const end = new Date(event.rdv.fin as string)
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            state.rdvData = {
                enabled: true,
                type: event.rdv.nom || "",
                owner: event.rdv.owner || userId || "",
                startDate: toLocalDateStr(start),
                startTime: toLocalTimeStr(start),
                endDate: toLocalDateStr(end),
                endTime: toLocalTimeStr(end),
                description: event.rdv.description || "",
            }
        }
    }

    return state
}

/**
 * Second RDV planifié depuis la même interaction : même créneau que le
 * premier (deux RDV en même temps — deux commerciaux, ou deux natures de
 * RDV), type et commercial à choisir.
 */
export function secondRdvFrom(first: RdvState): RdvState {
    return {
        enabled: true,
        type: "",
        owner: "",
        startDate: first.startDate,
        startTime: first.startTime,
        endDate: first.endDate,
        endTime: first.endTime,
        description: "",
    }
}

/** Message d'erreur d'un RDV incomplet ou incohérent, `null` s'il est valide. */
export function rdvValidationError(rdv: RdvState): string | null {
    if (!rdv.type) return "Veuillez choisir un type de RDV."
    const start = new Date(`${rdv.startDate}T${rdv.startTime}`)
    const end = new Date(`${rdv.endDate}T${rdv.endTime}`)
    if (!(end > start)) return "La fin du RDV doit être après le début."
    return null
}

/** Change la date de début ; une fin désormais antérieure suit le début. */
export function withStartDate(rdv: RdvState, startDate: string): RdvState {
    const isAfterEnd = new Date(startDate) > new Date(rdv.endDate)
    return { ...rdv, startDate, endDate: isAfterEnd ? startDate : rdv.endDate }
}
