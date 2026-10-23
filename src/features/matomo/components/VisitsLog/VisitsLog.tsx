import { useMemo, useState } from "react"
import { SearchX } from "lucide-react"
import { useMatomoVisitsLog } from "@/features/matomo/hooks/data/useMatomo"
import {
    isVisitsLogDisabled,
    type MatomoQuery,
} from "@/features/matomo/services/matomoService"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { LoadMore } from "@/shared/ui/molecules/load-more"
import { SkeletonTable } from "@/shared/ui/molecules/skeleton-presets"

import BlockError from "../BlockError"
import Panel from "../Panel"
import { iso } from "../../utils/comparison"
import { fmtSpan } from "../../utils/format"
import VisitorProfileModal from "./VisitorProfileModal"
import VisitsLogDisabled from "./VisitsLogDisabled"
import VisitsList from "./VisitsList"

/**
 * Suit les filtres de la page, à une exception près : la plage va jusqu'à
 * aujourd'hui. Les KPI s'arrêtent hier pour comparer des jours complets, mais
 * le journal sert à voir qui vient d'arriver — l'en exclure contredisait le
 * compteur « en ligne » juste au-dessus.
 */
export default function VisitsLog({
    query: q,
    limit,
    onShowMore,
}: {
    query: MatomoQuery
    /** Passe au palier suivant (20 → 50 → 100) ; absent au dernier palier. */
    /** Nombre de visites demandées (20, 50, 100). */
    limit: string
    onShowMore?: () => void
}) {
    const [selectedVisitor, setSelectedVisitor] = useState<string | null>(null)
    const today = iso(new Date())
    const logQuery = useMemo(
        () => ({ ...q, to: q.to < today ? today : q.to }),
        [q, today]
    )
    const query = useMatomoVisitsLog(logQuery, limit)
    const log = query.data ?? []

    return (
        <Panel
            title={
                <>
                    Journal des visites
                    <span className="font-normal text-muted-foreground">
                        {" "}·{" "}
                        {logQuery.from === today
                            ? "aujourd'hui"
                            : `${fmtSpan(logQuery.from, logQuery.to)}, aujourd'hui compris`}
                    </span>
                </>
            }
            busy={query.isPlaceholderData}
        >

            {query.isPending && <SkeletonTable rows={6} columns={5} label="Chargement du journal…" />}
            {query.isError &&
                (isVisitsLogDisabled(query.error) ? (
                    <VisitsLogDisabled />
                ) : (
                    <BlockError
                        error={query.error}
                        onRetry={() => query.refetch()}
                        retrying={query.isFetching}
                    />
                ))}
            {query.isSuccess && log.length === 0 && (
                <EmptyState
                    size="sm"
                    variant="search"
                    icon={SearchX}
                    title="Aucune visite trouvée"
                    description="Élargissez la période dans la barre du haut."
                />
            )}

            <VisitsList
                log={log}
                onSelectVisitor={setSelectedVisitor}
            />

            {/* Le réglage vivait dans la barre du haut, à cinq panneaux de la
                liste qu'il pilotait : il est maintenant au pied du journal. La
                liste est pleine (= la limite) quand d'autres visites existent. */}
            {onShowMore && query.isSuccess && log.length >= Number(limit) && (
                <LoadMore
                    onClick={onShowMore}
                    label="Voir plus de visites"
                    className="mt-4 flex items-center rounded-full border border-border bg-card px-6 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
            )}

            {selectedVisitor && (
                <VisitorProfileModal
                    siteId={q.siteId}
                    visitorId={selectedVisitor}
                    onClose={() => setSelectedVisitor(null)}
                />
            )}
        </Panel>
    )
}
