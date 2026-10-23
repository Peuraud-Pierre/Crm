import type { UseQueryResult } from "@tanstack/react-query"
import BlockError from "./BlockError"
import Panel from "./Panel"
import StatCard, { type StatComparison } from "./StatCard"
import type { MatomoVisits } from "./types"
import { fmtDuration, fmtInt, fmtRate } from "../utils/format"
import { compareKpi, type CompareLabel } from "../utils/comparison"

export default function MatomoKPIGrid({
    query,
    previous,
    compareLabel,
    compareSpan,
    span,
}: {
    query: UseQueryResult<MatomoVisits>
    /** KPI de la période précédente ; requête inactive quand la vue n'est pas comparable. */
    previous: UseQueryResult<MatomoVisits>
    compareLabel?: CompareLabel
    /** Dates de la période de référence, déjà formatées. */
    compareSpan?: string
    /** Dates de la période affichée, déjà formatées. */
    span: string
}) {
    const data = query.data
    const loading = query.isPending
    const before = previous.data

    /** Rebond et temps moyen sont des moyennes par visite : sans visite, elles
        n'existent pas (le proxy renvoie « 0% », qui se lisait comme un résultat). */
    const PER_VISIT: (keyof MatomoVisits)[] = ["bounce_rate", "avg_time_on_site"]
    const hasVisits = (v?: MatomoVisits) => Number(v?.nb_visits) > 0

    /** Rien à comparer (« Aujourd'hui ») ou période précédente en erreur : pas de ligne. */
    const compare = (
        key: keyof MatomoVisits,
        options?: Parameters<typeof compareKpi>[2]
    ): StatComparison | undefined =>
        compareLabel && !previous.isError
            ? {
                  label: compareLabel,
                  span: compareSpan,
                  // Valeur et période précédente arrivent séparément : tant que
                  // l'une est celle de l'ancien filtre, l'écart serait faux.
                  loading:
                      loading ||
                      previous.isPending ||
                      query.isPlaceholderData ||
                      previous.isPlaceholderData,
                  delta:
                      PER_VISIT.includes(key) && !(hasVisits(data) && hasVisits(before))
                          ? null
                          : compareKpi(data?.[key], before?.[key], options),
              }
            : undefined
    return (
        <Panel
            // Les dates exactes de la période : « 30 derniers jours » s'arrête
            // hier, ce que le libellé seul ne dit pas.
            title={
                <>
                    Aperçu global
                    <span className="font-normal text-muted-foreground"> · {span}</span>
                </>
            }
            busy={query.isPlaceholderData}
        >
            {/* Les dates de référence étaient seulement dans un `title`, au
                survol : invisibles au toucher et au clavier. */}
            {compareSpan && !query.isError && (
                <p className="-mt-2 mb-4 text-xs text-muted-foreground">
                    Écarts calculés par rapport à la période du {compareSpan}.
                </p>
            )}
            {query.isError ? (
                <BlockError
                    error={query.error}
                    onRetry={() => query.refetch()}
                    retrying={query.isFetching}
                />
            ) : (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard
                    loading={loading}
                    label="Visiteurs uniques"
                    comparison={compare("nb_uniq_visitors")}
                    hint="Personnes distinctes, reconnues par leur navigateur. Revenue trois fois, une personne compte une fois."
                    value={fmtInt(data?.nb_uniq_visitors)}
                />
                <StatCard
                    loading={loading}
                    label="Visites"
                    comparison={compare("nb_visits")}
                    hint="Passages sur le site. Une visite se termine après 30 minutes sans activité."
                    value={fmtInt(data?.nb_visits)}
                />
                <StatCard
                    loading={loading}
                    label="Actions"
                    comparison={compare("nb_actions")}
                    hint="Pages vues, téléchargements et clics vers d'autres sites, cumulés."
                    value={fmtInt(data?.nb_actions)}
                />
                <StatCard
                    loading={loading}
                    label="Taux de rebond"
                    comparison={compare("bounce_rate", { higherIsBetter: false, points: true })}
                    hint="Part des visites qui n'ont vu qu'une seule page avant de partir."
                    value={hasVisits(data) ? fmtRate(data?.bounce_rate) : "—"}
                />
                <StatCard
                    loading={loading}
                    label="Temps moyen"
                    comparison={compare("avg_time_on_site")}
                    hint="Durée moyenne d'une visite, de la première à la dernière action."
                    value={hasVisits(data) ? fmtDuration(data?.avg_time_on_site) : "—"}
                />
            </dl>
            )}
        </Panel>
    )
}
