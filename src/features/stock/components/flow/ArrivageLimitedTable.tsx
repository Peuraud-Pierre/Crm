import { useMemo, useState } from "react"
import { PackageX, Weight } from "lucide-react"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { SkeletonGroup } from "@/shared/ui/molecules/skeleton-presets"
import { RecordTable, type RecordGroup } from "@/shared/ui/organisms/record-table"
import { cn } from "@/shared/lib/utils"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useArrivageManuelContext } from "@/features/stock/hooks/context/StockProvider"
import { useArrivagePages } from "@/features/stock/hooks/ui/useArrivagePages"
import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import { STOCK_PERMISSIONS } from "@/features/stock/constants"
import { isArrivageInvoiceAlert } from "@/features/stock/utils/arrivageHelpers"
import { buildArrivageColumns, fmtNum } from "./arrivageColumns"
import { TablePagination } from "@/shared/ui/molecules/table-pagination"

const SKELETON_KEYS = ["a", "b", "c", "d", "e"]

/**
 * Tableau des arrivages : assemblage seul.
 *
 * Les colonnes sont dans `arrivageColumns.tsx`, le calcul des pages dans
 * `hooks/ui/useArrivagePages.ts`, le squelette de table dans
 * `shared/ui/organisms/record-table.tsx`. Ce qui reste ici, c'est ce qui relie
 * les trois : les états de bord, les teintes de ligne et la pagination.
 *
 * L'ordre des lignes suit la même date d'ancrage que l'export Excel
 * (`arrivageGrouping::compareByReferenceDesc` : date de référence, à défaut
 * création, date seule lue à minuit local) — c'est `useArrivagePages` qui
 * l'applique.
 */
export default function ArrivageLimitedTable({
    onOpen,
    onEdit,
    onPacking,
}: {
    /** Clic de ligne : ouvre la fiche de lecture. */
    onOpen: (row: ArrivageManuelRow) => void
    /** Bouton d'action : ouvre directement le formulaire. */
    onEdit: (row: ArrivageManuelRow) => void
    /** Icône packing : importe ou ouvre la packing list. Absent, pas d'icône. */
    onPacking?: (row: ArrivageManuelRow) => void
}) {
    const { rows } = useArrivageManuelContext()
    const { hasPermission } = useAuth()
    const canUpdate = hasPermission(STOCK_PERMISSIONS.arrivageUpdate)
    const canPackingView = hasPermission(STOCK_PERMISSIONS.packingView)
    const canPackingCreate = hasPermission(STOCK_PERMISSIONS.packingCreate)
    const [page, setPage] = useState<number | null>(null)

    const { pageGroups, currentPage, totalPages, upcomingIds, flaggedPages } =
        useArrivagePages(rows, page)

    const columns = useMemo(
        () =>
            buildArrivageColumns({
                canUpdate,
                onOpen,
                onEdit,
                upcomingIds,
                canPackingView,
                canPackingCreate,
                onPacking,
            }),
        [canUpdate, onOpen, onEdit, upcomingIds, canPackingView, canPackingCreate, onPacking],
    )

    if (!rows) {
        return (
            <SkeletonGroup
                className="overflow-hidden rounded-xl border border-primary/20 divide-y divide-border"
                label="Chargement des arrivages…"
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
                title="Aucun arrivage enregistré"
                description="Les arrivages saisis apparaîtront dans ce tableau."
                className="rounded-xl border border-dashed border-border"
            />
        )
    }

    // Trois colonnes réservées en fin de bannière : le total de poids, puis le
    // n° interne et les actions, laissés vides.
    const groups: RecordGroup<ArrivageManuelRow>[] = pageGroups.map((entry) => ({
        key: entry.month,
        banner: (
            <>
                {entry.month}
                <span className="ml-2 text-2xs font-normal text-muted-foreground">
                    ({entry.rows.length} arrivage{entry.rows.length > 1 ? "s" : ""})
                </span>
            </>
        ),
        bannerTrailing: {
            colSpan: 3,
            content: (
                <span className="inline-flex items-center justify-end gap-1">
                    <Weight size={10} className="opacity-50" aria-hidden />
                    {fmtNum(entry.totalWeight, " kg")}
                </span>
            ),
        },
        rows: entry.rows,
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
                // `min-w-[900px]` : douze colonnes ont une largeur minimale
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
                // L'alerte facture l'emporte sur le surlignage des prochains
                // arrivages : une facture manquante est une action à mener, un
                // arrivage proche une simple information.
                rowClassName={(row) =>
                    cn(
                        "group border-b border-border transition-colors last:border-b-0 border-l-2",
                        isArrivageInvoiceAlert(row)
                            ? "border-l-red-500 dark:border-l-red-500 bg-red-50/30 dark:bg-red-950/10 hover:bg-red-50/50 dark:hover:bg-red-950/20"
                            : upcomingIds.has(row.id)
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
