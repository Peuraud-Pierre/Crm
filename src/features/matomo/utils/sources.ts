/** Une source de trafic sous un canal : réseau, assistant IA, moteur, campagne, site. */
export interface MatomoSource {
    label: string
    nb_visits: number
}

export interface SourceRow {
    label: string
    visits: number
    /** Part des visites AU SEIN du canal, en %. */
    share: number
}

export interface TopSources {
    rows: SourceRow[]
    /** Longue traîne résumée : `null` quand tout tient dans le top. */
    others: { count: number; visits: number } | null
}

/**
 * Top N des sources d'un canal, par visites décroissantes. Matomo renvoie les
 * sous-lignes par ordre alphabétique, avec une longue traîne (des sites à une
 * visite) : le reste est résumé en une ligne « N autres ».
 */
export function topSources(sources: MatomoSource[] | undefined, n = 5): TopSources {
    const all = (sources ?? [])
        .map((s) => ({ label: s.label || "—", visits: Number(s.nb_visits) || 0 }))
        .filter((s) => s.visits > 0)
        .sort((a, b) => b.visits - a.visits)
    const total = all.reduce((sum, s) => sum + s.visits, 0)
    const share = (v: number) => (total > 0 ? (v / total) * 100 : 0)

    const rows = all.slice(0, n).map((s) => ({ ...s, share: share(s.visits) }))
    const rest = all.slice(n)
    return {
        rows,
        others: rest.length
            ? { count: rest.length, visits: rest.reduce((sum, s) => sum + s.visits, 0) }
            : null,
    }
}
