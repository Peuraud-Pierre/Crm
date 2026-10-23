import type { MatomoSource } from "../utils/sources"

export interface MatomoVisits {
    nb_uniq_visitors: number
    nb_users: number
    nb_visits: number
    nb_actions: number
    bounce_rate: string
    avg_time_on_site: number
}

export interface MatomoPage {
    label: string
    nb_hits: number
    nb_visits: number
    url?: string
    segment?: string
    subtable?: MatomoPage[]
}

export interface MatomoTimelinePoint {
    date: string
    nb_visits: number
    nb_uniq_visitors: number
    nb_actions: number
    bounce_rate: string
    avg_time_on_site: number
}

export interface MatomoChannel {
    label: string
    nb_visits: number
    nb_actions: number
    nb_uniq_visitors: number
    nb_users: number
    percentage: number
    /** 1 = accès direct, 2 = moteurs de recherche (Referrers.getReferrerType). */
    referrer_type?: number | string
    referrer_name?: string
    idsubdatatable?: number
    /** Sources du canal, présentes avec `expanded=1`. */
    subtable?: MatomoSource[]
}

export interface MatomoCountry {
    code: string
    label: string
    /** Visites, additionnées exactement par le proxy. Absent avec un proxy antérieur. */
    nb_visits?: number
    /** Somme de visiteurs uniques journaliers : repli tant que le proxy n'expose pas nb_visits. */
    nb_uniq_visitors: number
    percentage: number
}

/** Visites d'un pays : `nb_visits` (exact), repli sur l'ancien champ du proxy. */
export const countryVisits = (c: MatomoCountry | undefined) =>
    Number(c?.nb_visits ?? c?.nb_uniq_visitors) || 0

export type RankedCountry = MatomoCountry & { visits: number }

export interface MatomoSite {
    idsite: string
    name: string
    main_url: string
}

export interface MatomoVisitAction {
    url: string
    pageTitle?: string
    timestamp: number
}

export interface MatomoVisitLog {
    idVisit: string
    visitorId: string
    country: string
    city?: string
    deviceType?: string
    browser?: string
    visitDuration: number
    referrerType?: string
    visitCount: number
    actions: MatomoVisitAction[]
}

export interface MatomoVisitorProfile {
    idSite: number
    visitorId: string
    visits: MatomoVisitLog[]
    totalVisits: number
    firstVisit: string
    lastVisit: string
}
