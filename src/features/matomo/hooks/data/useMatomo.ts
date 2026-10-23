import {
    keepPreviousData,
    useIsFetching,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query"
import { useCallback } from "react"

import * as matomoService from "@/features/matomo/services/matomoService"
import { fetchCountriesGeoJson } from "@/features/matomo/services/geoJsonService"
import type { MatomoQuery } from "@/features/matomo/services/matomoService"

/**
 * Une requête par bloc de la page : chaque panneau a son propre chargement et
 * sa propre erreur, et une panne de `/countries` n'éteint plus les KPI.
 *
 * Toutes les clés commencent par `MATOMO_KEY` : `useMatomoRefresh` les
 * invalide d'un coup, et `useIsFetching` dit si l'une d'elles tourne.
 */
const MATOMO_KEY = "matomo"

/** Matomo agrège côté serveur : 1 min de fraîcheur suffit, même sur « aujourd'hui ». */
const STALE_TIME = 60_000

export function useMatomoSites() {
    return useQuery({
        queryKey: [MATOMO_KEY, "sites"],
        queryFn: matomoService.fetchSites,
        staleTime: Infinity,
    })
}

function useMatomoBlock<T>(
    block: string,
    q: MatomoQuery,
    queryFn: (q: MatomoQuery) => Promise<T>
) {
    return useQuery({
        queryKey: [MATOMO_KEY, block, q],
        queryFn: () => queryFn(q),
        staleTime: STALE_TIME,
        // Au changement de filtre, l'ancien résultat reste affiché (atténué par
        // le panneau) au lieu de repasser toute la page en squelettes.
        placeholderData: keepPreviousData,
    })
}

export const useMatomoVisits = (q: MatomoQuery) =>
    useMatomoBlock("visits", q, matomoService.fetchVisits)
export const useMatomoPages = (q: MatomoQuery) =>
    useMatomoBlock("pages", q, matomoService.fetchPages)
export const useMatomoTimeline = (q: MatomoQuery) =>
    useMatomoBlock("timeline", q, matomoService.fetchTimeline)
export const useMatomoChannels = (q: MatomoQuery) =>
    useMatomoBlock("channels", q, matomoService.fetchChannels)
export const useMatomoCountries = (q: MatomoQuery) =>
    useMatomoBlock("countries", q, matomoService.fetchCountries)
/** Détail des moteurs : à monter seulement quand le canal est déplié. */
export const useMatomoSearchEngines = (q: MatomoQuery) =>
    useMatomoBlock("search-engines", q, matomoService.fetchSearchEngines)
export function useMatomoVisitsLog(q: MatomoQuery, limit: string) {
    return useQuery({
        queryKey: [MATOMO_KEY, "log", q, limit],
        queryFn: () => matomoService.fetchVisitsLog(q, limit),
        staleTime: STALE_TIME,
        placeholderData: keepPreviousData,
    })
}

/** Fond de carte : ne change jamais pendant la session. Hors clé `matomo`,
    il n'entre ni dans « Rafraîchir » ni dans son indicateur. */
export function useCountriesGeoJson() {
    return useQuery({
        queryKey: ["matomo-geojson"],
        queryFn: fetchCountriesGeoJson,
        staleTime: Infinity,
        gcTime: Infinity,
    })
}

/** KPI de la période précédente, pour la comparaison. Inactif si `q` est nul. */
export function useMatomoVisitsPrevious(q: MatomoQuery | null) {
    return useQuery({
        queryKey: [MATOMO_KEY, "visits-previous", q],
        queryFn: () => matomoService.fetchVisits(q!),
        enabled: q !== null,
        placeholderData: keepPreviousData,
        // Une période close ne bouge plus : inutile de la relire à chaque minute.
        staleTime: 10 * STALE_TIME,
    })
}

/** « En ligne » n'a de sens que rafraîchi : relu chaque minute, onglet visible. */
export function useMatomoLive(siteId: string) {
    return useQuery({
        // Clé par site seulement : changer de période ne fait plus disparaître
        // le compteur le temps d'un rechargement.
        queryKey: [MATOMO_KEY, "live", siteId],
        queryFn: () => matomoService.fetchLiveVisitors(siteId),
        refetchInterval: 60_000,
    })
}

export function useMatomoVisitorProfile(siteId: string, visitorId: string) {
    return useQuery({
        queryKey: [MATOMO_KEY, "profile", siteId, visitorId],
        queryFn: () => matomoService.fetchVisitorProfile(siteId, visitorId),
        staleTime: STALE_TIME,
    })
}

/**
 * Requêtes qui ne disent pas « la page recharge » : `live` est relu seul chaque
 * minute et `profile` appartient à la modale. Les compter faisait tourner le
 * bouton « Rafraîchir » (et le désactivait) sans aucune action de l'utilisateur.
 */
// `log` et `search-engines` : rechargés par « Voir plus » ou un dépliage, des
// gestes locaux qui n'ont pas à faire tourner le bouton de toute la page.
const BACKGROUND_BLOCKS = new Set(["live", "profile", "log", "search-engines"])

export const isPageBlock = (queryKey: readonly unknown[]) =>
    queryKey[0] === MATOMO_KEY && !BACKGROUND_BLOCKS.has(String(queryKey[1]))

/** Rafraîchit tous les blocs Matomo, et dit si un bloc de la page charge encore. */
export function useMatomoRefresh() {
    const queryClient = useQueryClient()
    const fetching =
        useIsFetching({ predicate: (query) => isPageBlock(query.queryKey) }) > 0
    const refresh = useCallback(
        () => {
            matomoService.bypassProxyCache()
            return queryClient.invalidateQueries({ queryKey: [MATOMO_KEY] })
        },
        [queryClient]
    )
    return { refresh, fetching }
}
