import { useMemo, useState } from "react"
import { PackageX, Weight } from "lucide-react"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { SkeletonGroup } from "@/shared/ui/molecules/skeleton-presets"
import { RecordTable, type RecordGroup } from "@/shared/ui/organisms/record-table"
import { TablePagination } from "@/shared/ui/molecules/table-pagination"
import { useMonthPages } from "@/shared/hooks/useMonthPages"
import { cn } from "@/shared/lib/utils"
import { FLUX_MONTHS_PER_PAGE, UPCOMING_FLUX_COUNT } from "@/features/stock_handpick/constants"
import {
    referenceFlux,
    type FluxHandpickRow,
} from "@/features/stock_handpick/types/flux.types"
import { buildFluxColumns, fmtNum } from "./fluxColumns"

const SKELETON_KEYS = ["a", "b", "c", "d", "e"]

interface FluxTableProps {
    rows: FluxHandpickRow[] | undefined
    canUpdate: boolean
    /** Clic de ligne : ouvre la fiche de lecture. */
    onOpen: (row: FluxHandpickRow) => void
    /** Bouton d'action : ouvre directement le formulaire. */
    onEdit: (row: FluxHandpickRow) => void
    emptyLabel: string
    emptyDescription: string
}

/**
 * Tableau des expéditions — jumeau de `ArrivageLimitedTable` du stock principal.
 *
 * Assemblage seul : les colonnes sont dans `fluxColumns.tsx`, le tri et la
 * pagination par mois dans `shared/hooks/useMonthPages`, le squelette de table
 * dans `shared/ui/organisms/record-table`. Ce qui reste ici relie les trois —
 * les états de bord, les teintes de ligne, la bannière de mois.
 */
export function FluxTable({
    rows,
    canUpdate,
    onOpen,
    onEdit,
    emptyLabel,
    emptyDescription,
}: FluxTableProps) {
    const [page, setPage] = useState<number | null>(null)

    const { pageGroups, currentPage, totalPages, upcomingIds, flaggedPages } = useMonthPages(
        rows,
        (row) => ({
            id: row.id,
            // Même cascade que le stock principal, et repli sur la date de
            // saisie pour qu'une expédition sans aucune date reste rattachée à
            // un mois au lieu de tomber dans « Sans date ».
            referenceAt: referenceFlux(row) ?? row.created_at,
            upcomingAt: row.prev_dechargement_at,
            weight: row.total_weight_kg,
        }),
        {
            page,
            monthsPerPage: FLUX_MONTHS_PER_PAGE,
            upcomingCount: UPCOMING_FLUX_COUNT,
        },
    )

    const columns = useMemo(
        () => buildFluxColumns({ canUpdate, onOpen, onEdit, upcomingIds }),
        [canUpdate, onOpen, onEdit, upcomingIds],
    )

    if (!rows) {
        return (
            <SkeletonGroup
                className="overflow-hidden rounded-xl border border-primary/20 divide-y divide-border"
                label="Chargement des expéditions…"
            >
                {SKELETON_KEYS.map((key) => (
                    <div key={key} className="flex items-center gap-4 px-3 py-3">
                        <Skeleton className="h-3 w-14 rounded-full" />
                        <Skeleton className="h-3 flex-1 max-w-40" />
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-12 ml-auto" />
                    </div>
                ))}
            </SkeletonGroup>
        )
    }

    if (rows.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={PackageX}
                title={emptyLabel}
                description={emptyDescription}
                className="rounded-xl border border-dashed border-border"
            />
        )
    }

    // Trois colonnes réservées en fin de bannière : le total sous « Poids »,
    // puis la quantité et les actions, laissées vides.
    const groups: RecordGroup<FluxHandpickRow>[] = pageGroups.map((group) => ({
        key: group.month,
        banner: (
            <>
                {group.month}
                <span className="ml-2 text-2xs font-normal text-muted-foreground">
                    ({group.rows.length} expédition{group.rows.length > 1 ? "s" : ""})
                </span>
            </>
        ),
        bannerTrailing: {
            colSpan: 3,
            content: (
                <span className="inline-flex items-center justify-end gap-1">
                    <Weight size={10} className="opacity-50" aria-hidden />
                    {fmtNum(group.totalWeight, " kg")}
                </span>
            ),
        },
        rows: group.rows,
    }))

    return (
        <div className="flex flex-col gap-2">
            <RecordTable
                columns={columns}
                groups={groups}
                rowKey={(row) => row.id}
                onRowClick={onOpen}
                animationKey={currentPage}
                fixedLayout
                // `min-w-[900px]` : les colonnes ont une largeur minimale
                // réelle en deçà de laquelle elles deviennent illisibles ; le
                // wrapper défile horizontalement plutôt que de les écraser.
                tableClassName="text-xs min-w-[900px]"
                wrapperClassName="overflow-x-auto rounded-xl border border-primary/20 animate-in fade-in-0 slide-in-from-bottom-1 duration-slow"
                headerRowClassName="bg-muted/40 border-border hover:bg-muted/40"
                headCellClassName="h-auto px-3 py-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground"
                bodyCellClassName="px-3 py-2.5"
                groupRowClassName="bg-muted/60 border-t border-b border-border hover:bg-muted/60"
                groupLabelClassName="px-3 py-1.5 font-semibold capitalize text-foreground"
                groupSummaryClassName="px-3 py-1.5 text-right font-semibold text-foreground whitespace-nowrap"
                rowClassName={(row) =>
                    cn(
                        "group border-b border-border transition-colors last:border-b-0 border-l-2",
                        upcomingIds.has(row.id)
                            ? "border-l-amber-400 dark:border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-50/70 dark:hover:bg-amber-950/20"
                            : "border-l-transparent hover:bg-muted/40",
                    )
                }
            />

            <TablePagination
                page={currentPage}
                totalPages={totalPages}
                flagged={(p) => flaggedPages.has(p)}
                onChange={setPage}
            />
        </div>
    )
}
