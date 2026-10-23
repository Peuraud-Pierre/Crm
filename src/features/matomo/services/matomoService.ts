// ── services/matomoService.ts ─────────────────────────────────────────────────
// Couche service — proxy Matomo (fonction edge `${SUPABASE_URL}/matomo`).
//
// Les `fetch` vivaient dans la route et les composants, sans contrôle de
// `res.ok` : une réponse d'erreur (JSON `{ error }`) entrait telle quelle dans
// l'état, puis faisait planter le rendu (`timeline.sort` sur un objet). Tout
// passe désormais par `matomoGet`, qui lève une erreur lisible.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useMatomo.ts   → requêtes TanStack Query de la page
//   - components/MatomoMap.tsx, VisitsLog/* → `flagUrl` (images de drapeaux)

import { env } from "@/shared/lib/env"
import type {
    MatomoChannel,
    MatomoCountry,
    MatomoPage,
    MatomoSite,
    MatomoTimelinePoint,
    MatomoVisits,
} from "@/features/matomo/components/types"
import type { Visit } from "@/features/matomo/components/VisitsLog/utils"
import type { MatomoSource } from "@/features/matomo/utils/sources"

export const MATOMO_API_BASE = `${env.PUBLIC_SUPABASE_URL}/matomo`

/**
 * Requête d'un bloc : site, plage de dates explicite, granularité des séries.
 * Voir `utils/comparison.ts` (`periodRanges`) pour le calcul des plages.
 */
export interface MatomoQuery {
    siteId: string
    /** Granularité des séries (courbe, pays) : day, week ou month. */
    period: string
    from: string
    to: string
}

/** Erreur porteuse d'un message affichable tel quel à l'utilisateur. */
export class MatomoError extends Error {
    constructor(
        message: string,
        readonly status?: number,
        /** Code stable renvoyé par le proxy (`error`), ex. « visits_log_disabled ». */
        readonly code?: string
    ) {
        super(message)
        this.name = "MatomoError"
    }
}

/**
 * Journal des visites (et profil visiteur) désactivé dans les réglages Matomo
 * du site : un choix d'administration, pas une panne. Le proxy répond 403 avec
 * ce code ; réessayer n'y changerait rien.
 */
export const VISITS_LOG_DISABLED = "visits_log_disabled"

export const isVisitsLogDisabled = (error: unknown) =>
    error instanceof MatomoError && error.code === VISITS_LOG_DISABLED

function messageForStatus(status: number): string {
    if (status === 401 || status === 403)
        return "Accès refusé par Matomo. Vérifiez vos droits sur ce site."
    if (status === 404) return "Ce site n'existe pas ou plus dans Matomo."
    if (status === 429)
        return "Matomo limite les requêtes. Réessayez dans une minute."
    if (status >= 500)
        return "Matomo ne répond pas correctement. Réessayez dans quelques instants."
    return `Requête refusée par Matomo (code ${status}).`
}

/**
 * « Rafraîchir » doit contourner le cache du proxy (5 à 30 s selon la route),
 * sinon il resservait les mêmes chiffres. Fenêtre courte plutôt qu'un paramètre
 * à faire traverser chaque hook : seules les requêtes lancées juste après le
 * clic portent `nocache=1`.
 */
let bypassCacheUntil = 0
export function bypassProxyCache() {
    bypassCacheUntil = Date.now() + 5_000
}

async function matomoGet<T>(
    path: string,
    params: Record<string, string> = {}
): Promise<T> {
    const query = new URLSearchParams(params)
    if (Date.now() < bypassCacheUntil) query.set("nocache", "1")
    const url = `${MATOMO_API_BASE}/${path}?${query}`

    let res: Response
    try {
        res = await fetch(url)
    } catch {
        throw new MatomoError(
            "Impossible de joindre Matomo. Vérifiez votre connexion."
        )
    }

    if (!res.ok) {
        const code = await res
            .json()
            .then((b: { error?: unknown }) => (typeof b?.error === "string" ? b.error : undefined))
            .catch(() => undefined)
        throw new MatomoError(messageForStatus(res.status), res.status, code)
    }

    // Les réponses `{ result: "error" }` de Matomo sont déjà converties en 502
    // par le proxy (callMatomo) : elles arrivent ici comme un statut en échec.
    return (await res.json().catch(() => {
        throw new MatomoError("Réponse de Matomo illisible.")
    })) as T
}

/**
 * Un total sur toute la plage : Matomo agrège lui-même. C'est la seule façon
 * d'avoir des visiteurs uniques dédupliqués et une seule ligne par canal ou par
 * page — en `period=day`, il renvoie une liste PAR JOUR que le proxy aplatissait
 * (« Moteurs de recherche » y figurait 30 fois sur 30 jours).
 */
const rangeParams = (q: MatomoQuery) => ({
    idSite: q.siteId,
    period: "range",
    date: `${q.from},${q.to}`,
})

/** Une série découpée par jour, semaine ou mois (courbe d'évolution). */
const seriesParams = (q: MatomoQuery) => ({
    idSite: q.siteId,
    period: q.period,
    date: `${q.from},${q.to}`,
})

/** Normalise une réponse attendue en tableau (Matomo renvoie `{}` à vide). */
const asArray = <T>(value: unknown): T[] =>
    Array.isArray(value) ? (value as T[]) : []

// ─── Lecture ──────────────────────────────────────────────────────────────────

export async function fetchSites(): Promise<MatomoSite[]> {
    return asArray<MatomoSite>(await matomoGet("sites"))
}

export async function fetchVisits(q: MatomoQuery): Promise<MatomoVisits> {
    return matomoGet<MatomoVisits>("visits", rangeParams(q))
}

export async function fetchPages(q: MatomoQuery): Promise<MatomoPage[]> {
    // flat=1 : des pages, pas l'arbre de dossiers (« en », « contact »…).
    // Le graphique n'en montre que 5.
    const raw = await matomoGet<unknown>("pages", {
        ...rangeParams(q),
        flat: "1",
        filter_limit: "5",
        // Le top est choisi sur les vues (barres affichées), pas sur les visites,
        // l'ordre par défaut de Matomo : sinon les barres n'étaient pas décroissantes.
        filter_sort_column: "nb_hits",
        filter_sort_order: "desc",
    })
    return Array.isArray(raw)
        ? (raw as MatomoPage[])
        : (Object.values(raw ?? {}) as MatomoPage[])
}

/** Visiteurs des 30 dernières minutes : ne dépend que du site, pas de la période. */
export async function fetchLiveVisitors(siteId: string): Promise<number> {
    const raw = await matomoGet<{ visitors?: number }[]>("live", { idSite: siteId })
    return Number(asArray<{ visitors?: number }>(raw)[0]?.visitors) || 0
}

export async function fetchTimeline(
    q: MatomoQuery
): Promise<MatomoTimelinePoint[]> {
    const raw = await matomoGet<unknown>("timeline", seriesParams(q))
    const points = Array.isArray(raw)
        ? (raw as MatomoTimelinePoint[])
        : Object.entries((raw ?? {}) as Record<string, Partial<MatomoTimelinePoint>>).map(
              ([date, v]) => ({ ...v, date }) as MatomoTimelinePoint
          )
    return points
        .map((p) => ({
            ...p,
            nb_visits: Number(p.nb_visits) || 0,
            nb_uniq_visitors: Number(p.nb_uniq_visitors) || 0,
            nb_actions: Number(p.nb_actions) || 0,
        }))
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

export async function fetchChannels(q: MatomoQuery): Promise<MatomoChannel[]> {
    // expanded=1 : chaque canal arrive avec ses sources (réseaux, assistants
    // IA, campagnes, sites) — un seul appel pour tous les détails dépliables.
    return asArray<MatomoChannel>(
        await matomoGet("channels", {
            ...rangeParams(q),
            filter_limit: "-1",
            expanded: "1",
        })
    )
}

/**
 * Moteurs de recherche (Google, Bing…). La sous-table du canal « Moteurs de
 * recherche » ne donne que des mots-clés, masqués par Google : route dédiée du
 * proxy, chargée au premier dépliage seulement.
 */
export async function fetchSearchEngines(q: MatomoQuery): Promise<MatomoSource[]> {
    return asArray<MatomoSource>(
        await matomoGet("search-engines", { ...rangeParams(q), filter_limit: "-1" })
    )
}

/**
 * Pays : en série, car en `range` Matomo ne fournit plus de visiteurs uniques
 * par pays et le proxy les ramène à 0. Le proxy fusionne les jours par code
 * pays et additionne `nb_visits`, qui s'additionne exactement (contrairement aux
 * visiteurs uniques). Sans limite : un plafond tronquait des pays visités.
 */
export async function fetchCountries(q: MatomoQuery): Promise<MatomoCountry[]> {
    return asArray<MatomoCountry>(
        await matomoGet("countries", { ...seriesParams(q), filter_limit: "-1" })
    )
}

/**
 * La limite est un argument du journal seul, pas un champ de `MatomoQuery` :
 * dans la requête commune, elle entrait dans la clé de cache de TOUS les blocs,
 * et « Voir plus de visites » rechargeait toute la page.
 */
export async function fetchVisitsLog(q: MatomoQuery, limit: string): Promise<Visit[]> {
    return asArray<Visit>(
        await matomoGet("log", { ...rangeParams(q), filter_limit: limit })
    )
}

/** Profil visiteur brut : la forme Matomo est large et lue champ par champ. */
export async function fetchVisitorProfile(
    siteId: string,
    visitorId: string
): Promise<Record<string, unknown>> {
    return matomoGet("profile", { idSite: siteId, visitorId })
}

export const flagUrl = (path: string) =>
    `${MATOMO_API_BASE}/flag?${new URLSearchParams({ path })}`
