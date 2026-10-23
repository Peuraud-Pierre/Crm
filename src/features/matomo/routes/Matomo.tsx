import MatomoChannels from "@/features/matomo/components/MatomoChannels"
import MatomoCharts from "@/features/matomo/components/MatomoCharts"
import MatomoConfigBar from "@/features/matomo/components/MatomoConfigBar"
import MatomoKPIGrid from "@/features/matomo/components/MatomoKPIGrid"
import MatomoMap from "@/features/matomo/components/MatomoMap"
import VisitsLog from "@/features/matomo/components/VisitsLog/VisitsLog"
import {
    useMatomoChannels,
    useMatomoCountries,
    useMatomoLive,
    useMatomoPages,
    useMatomoRefresh,
    useMatomoSites,
    useMatomoTimeline,
    useMatomoVisits,
    useMatomoVisitsPrevious,
} from "@/features/matomo/hooks/data/useMatomo"
import { useEffect } from "react"
import { LIMIT_OPTIONS, useMatomoFilters } from "./matomoFilters"
import { fmtSpan } from "@/features/matomo/utils/format"

export default function MatomoPage() {
    // Une seule source de filtres pour toute la page, journal compris.
    const filters = useMatomoFilters()
    const q = filters.query

    const sites = useMatomoSites()

    // Un site absent de la liste (lien périmé, `?site=999`, droits retirés)
    // mettait les six panneaux en erreur. On bascule sur le premier site
    // accessible ; la liste vient du proxy, donc des droits réels du token.
    const { setSite } = filters
    const firstSite = sites.data?.[0]?.idsite
    const siteKnown = sites.data?.some((s) => String(s.idsite) === q.siteId)
    useEffect(() => {
        if (firstSite && siteKnown === false) setSite(String(firstSite))
    }, [firstSite, siteKnown, setSite])

    const visits = useMatomoVisits(q)
    const visitsPrevious = useMatomoVisitsPrevious(filters.previousQuery)
    const live = useMatomoLive(q.siteId)
    const pages = useMatomoPages(q)
    const timeline = useMatomoTimeline(q)
    const countries = useMatomoCountries(q)
    const channels = useMatomoChannels(q)
    const { refresh, fetching } = useMatomoRefresh()
    const nextLimit = LIMIT_OPTIONS[LIMIT_OPTIONS.findIndex((n) => n === filters.limit) + 1]

    return (
        <div className="flex-1 flex flex-col">
            {/* Pas de <main> : le shell (SidebarInset) en rend déjà un, et une
                page n'en a qu'un pour les lecteurs d'écran. */}
            <section
                aria-label="Trafic du site"
                className="flex-1 space-y-4 p-4 sm:space-y-6 sm:p-6"
            >
                <MatomoConfigBar
                    {...{
                        filters,
                        sites,
                        fetching,
                        refresh,
                        live: live.data,
                        updatedAt: visits.dataUpdatedAt,
                    }}
                />

                <MatomoKPIGrid
                    query={visits}
                    previous={visitsPrevious}
                    compareLabel={filters.compareLabel}
                    span={fmtSpan(filters.ranges.current.from, filters.ranges.current.to)}
                    compareSpan={
                        filters.ranges.previous
                            ? fmtSpan(filters.ranges.previous.from, filters.ranges.previous.to)
                            : undefined
                    }
                />
                <MatomoCharts pages={pages} timeline={timeline} />
                <MatomoMap countries={countries} />
                <MatomoChannels channels={channels} query={q} />
                <VisitsLog
                    query={q}
                    limit={filters.limit}
                    onShowMore={nextLimit ? () => filters.setLimit(nextLimit) : undefined}
                />
            </section>
        </div>
    )
}
