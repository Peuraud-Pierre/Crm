import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router"

import type { MatomoQuery } from "@/features/matomo/services/matomoService"
import {
    periodRanges,
    type CompareLabel,
} from "@/features/matomo/utils/comparison"

/**
 * Filtres de l'onglet Matomo, portés par la query string (docs/ROUTING.md :
 * « path pour la navigation, query pour le filtre ») :
 *
 *     /analytics/matomo?site=71&periode=day:last30&limite=50
 *
 * Une vue se partage donc par lien et survit au rechargement. Les valeurs par
 * défaut sont omises de l'URL, et toute valeur inconnue retombe sur le défaut :
 * un vieux lien ne casse jamais la page.
 */

/**
 * Option = couple `period:date` de l'API Matomo. Source unique de la liste.
 * `compare` nomme la période précédente ; absent, pas de comparaison des KPI.
 */
export const PERIOD_OPTIONS: readonly {
    value: string
    label: string
    compare?: CompareLabel
}[] = [
    { value: "day:today", label: "Aujourd'hui" },
    {
        value: "day:yesterday",
        label: "Hier",
        compare: { short: "vs avant-hier", spoken: "à avant-hier" },
    },
    {
        value: "day:last2",
        label: "2 derniers jours",
        compare: { short: "vs 2 j précédents", spoken: "aux 2 jours précédents" },
    },
    {
        value: "day:last7",
        label: "7 derniers jours",
        compare: { short: "vs 7 j précédents", spoken: "aux 7 jours précédents" },
    },
    {
        value: "day:last30",
        label: "30 derniers jours",
        compare: { short: "vs 30 j précédents", spoken: "aux 30 jours précédents" },
    },
    {
        value: "week:last12",
        label: "12 dernières semaines",
        compare: {
            short: "vs 12 sem. précédentes",
            spoken: "aux 12 semaines précédentes",
        },
    },
    {
        value: "month:last12",
        label: "12 derniers mois",
        compare: { short: "vs 12 mois précédents", spoken: "aux 12 mois précédents" },
    },
]

export const LIMIT_OPTIONS = ["10", "20", "50", "100"] as const

/** 30 jours par défaut : sur « Aujourd'hui », la courbe de tendance n'a qu'un
    point (« pas assez de données ») et les KPI sont quasi nuls le matin. La
    première vue doit montrer quelque chose. */
const DEFAULTS = { site: "71", periode: "day:last30", limite: "20" } as const

const isPeriod = (v: string | null): v is string =>
    PERIOD_OPTIONS.some((o) => o.value === v)
const isLimit = (v: string | null): v is string =>
    LIMIT_OPTIONS.some((o) => o === v)

export function useMatomoFilters() {
    const [params, setParams] = useSearchParams()

    const site = params.get("site") || DEFAULTS.site
    const periodKey = isPeriod(params.get("periode"))
        ? params.get("periode")!
        : DEFAULTS.periode
    const limit = isLimit(params.get("limite"))
        ? params.get("limite")!
        : DEFAULTS.limite

    // Clé du jour : la page est re-rendue chaque minute (compteur « en ligne »),
    // donc un onglet resté ouvert passe à la nouvelle plage après minuit.
    const dayKey = new Date().toDateString()

    const ranges = useMemo(
        // dayKey n'est lu que pour invalider : periodRanges prend la date courante.
        () => (void dayKey, periodRanges(periodKey)),
        [periodKey, dayKey]
    )

    const query: MatomoQuery = useMemo(
        () => ({ siteId: site, period: ranges.period, ...ranges.current }),
        [site, ranges]
    )

    /** Même requête sur la période précédente, ou `null` (pas de comparaison). */
    const previousQuery: MatomoQuery | null = useMemo(
        () => (ranges.previous ? { ...query, ...ranges.previous } : null),
        [query, ranges]
    )

    const compareLabel = PERIOD_OPTIONS.find((o) => o.value === periodKey)?.compare

    /** `replace` : changer un filtre ne doit pas empiler l'historique. */
    const set = useCallback(
        (key: keyof typeof DEFAULTS, value: string) =>
            setParams(
                (prev) => {
                    const next = new URLSearchParams(prev)
                    if (value === DEFAULTS[key]) next.delete(key)
                    else next.set(key, value)
                    return next
                },
                { replace: true }
            ),
        [setParams]
    )

    // Stable : la route s'en sert dans un effet (repli sur un site accessible).
    const setSite = useCallback((v: string) => set("site", v), [set])

    return {
        query,
        /** Nombre de visites du journal : hors de `query`, il ne touche que le journal. */
        limit,
        periodKey,
        /** Plages affichables (dates ISO) de la vue et de sa comparaison. */
        ranges,
        previousQuery,
        compareLabel,
        setSite,
        setPeriodKey: (v: string) => set("periode", v),
        setLimit: (v: string) => set("limite", v),
    }
}
