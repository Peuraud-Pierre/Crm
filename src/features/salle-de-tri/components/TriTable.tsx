import { useMemo, useState } from "react"
import { format, subDays } from "date-fns"
import { fr } from "date-fns/locale"
import { AlertTriangle, ClipboardList, FilterX } from "lucide-react"
import { RecordTable, type RecordColumn, type RecordGroup } from "@/shared/ui/organisms/record-table"
import { TablePagination } from "@/shared/ui/molecules/table-pagination"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { SkeletonTable } from "@/shared/ui/molecules/skeleton-presets"
import { GESTION_THEME } from "@/features/stock"
import { defaultTriFilters, useTriContext } from "@/features/salle-de-tri/hooks/context/TriContext"
import { ecarts, formatDuree, formatKg, fournisseursDe, kgParSortie, poidsInitial, qualitePonderee } from "@/features/salle-de-tri/utils/triAnalytics"
import type { FicheTriComplete, TriAffichage } from "@/features/salle-de-tri/types/tri.types"
import { FicheTriCard } from "./FicheTriCard"
import { QualiteStars } from "./QualiteStars"
import { useSortieColor } from "./RepartitionBar"

const PAGE_SIZE = 25

const day90 = () => format(subDays(new Date(), 90), "yyyy-MM-dd")

interface TriTableProps {
    onOpen: (fiche: FicheTriComplete) => void
    onCreate?: () => void
    /** `liste` par défaut. */
    affichage?: TriAffichage
}

/**
 * Historique des fiches de tri, groupé par jour, en liste ou en cartes (même
 * pagination, mêmes groupes). Les totaux de la ligne sont
 * ceux des balles FILTRÉES : filtrer sur une catégorie montre les kilos de
 * cette catégorie, et filtrer sur « MAG » ne garde dans les sorties que MAG.
 * Une fiche dont une balle est en écart porte une pastille d'alerte.
 */
export function TriTable({ onOpen, onCreate, affichage = "liste" }: TriTableProps) {
    const { fiches, filtered, filters, setFilters, loading, sortieById } = useTriContext()
    const sortieColor = useSortieColor()
    const [page, setPage] = useState(0)

    // Un filtre change la liste : revenir à la première page. Pas sur
    // `filtered`, qui change aussi à chaque rechargement realtime — la page
    // sauterait sous les yeux de qui consulte. Ajusté pendant le rendu.
    const [prevFilters, setPrevFilters] = useState(filters)
    if (filters !== prevFilters) {
        setPrevFilters(filters)
        setPage(0)
    }

    const columns = useMemo<RecordColumn<FicheTriComplete>[]>(() => [
        {
            key: "code", header: "N°", width: "6.5rem", cardPrimary: true,
            cell: (f) => <span className="font-mono font-semibold">{f.code}</span>,
        },
        {
            key: "trieur", header: "Trieur", width: "16%", cardLabel: "Trieur",
            cell: (f) => <span className="font-medium">{f.trieur_nom}</span>,
        },
        {
            key: "fournisseur", header: "Fournisseurs", width: "18%", cardLabel: "Fournisseurs",
            cell: (f) => <span className="line-clamp-1 text-muted-foreground">{fournisseursDe(f)}</span>,
        },
        {
            key: "types", header: "Répartition", cardLabel: "Répartition",
            cell: (f) => (
                <span className="flex flex-wrap gap-1">
                    {[...kgParSortie(f.balles)].sort((a, b) => b[1] - a[1]).map(([id, value]) => (
                        <span
                            key={id}
                            className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-xs"
                        >
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sortieColor(id) }} aria-hidden />
                            <span className="font-mono font-semibold">{sortieById.get(id)?.code ?? "?"}</span>
                            <span className="tabular-nums text-muted-foreground">{formatKg(value)}</span>
                        </span>
                    ))}
                </span>
            ),
        },
        {
            key: "balles", header: "Balles", width: "5rem", headClassName: "text-right", cellClassName: "text-right", cardLabel: "Balles",
            cell: (f) => <span className="tabular-nums text-muted-foreground">{f.balles.length}</span>,
        },
        {
            key: "total", header: "Poids trié", width: "8rem", headClassName: "text-right", cellClassName: "text-right", cardTrailing: true,
            cell: (f) => {
                const e = ecarts(f.balles).balles
                return (
                    <span className="inline-flex items-center justify-end gap-1.5">
                        {e > 0 && (
                            <span title={`${e} balle${e > 1 ? "s" : ""} en écart`} className="text-warning">
                                <AlertTriangle size={13} aria-label={`${e} balle${e > 1 ? "s" : ""} en écart`} />
                            </span>
                        )}
                        <span className="font-semibold tabular-nums">{formatKg(poidsInitial(f.balles))}</span>
                    </span>
                )
            },
        },
        {
            key: "qualite", header: "Qualité", width: "6rem", cardLabel: "Qualité",
            cell: (f) => <QualiteStars value={qualitePonderee(f.balles)} size="sm" />,
        },
        {
            key: "duree", header: "Temps", width: "5.5rem", cardLabel: "Temps",
            cardOmitWhen: (f) => !f.duree_minutes,
            cell: (f) => <span className="tabular-nums text-muted-foreground">{formatDuree(f.duree_minutes)}</span>,
        },
    ], [sortieById, sortieColor])

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

    // Groupes par jour de tri, dans l'ordre de la liste (plus récent d'abord).
    const groups = useMemo<RecordGroup<FicheTriComplete>[]>(() => {
        const byDay = new Map<string, FicheTriComplete[]>()
        for (const f of pageRows) byDay.set(f.date_tri, [...(byDay.get(f.date_tri) ?? []), f])
        return [...byDay].map(([day, rows]) => ({
            key: day,
            banner: format(new Date(`${day}T12:00:00`), "EEEE d MMMM yyyy", { locale: fr }),
            bannerTrailing: {
                colSpan: 4,
                content: `${rows.length} fiche${rows.length > 1 ? "s" : ""} · ${formatKg(rows.reduce((s, f) => s + poidsInitial(f.balles), 0))}`,
            },
            rows,
        }))
    }, [pageRows])

    if (loading) return <SkeletonTable />

    if (filtered.length === 0) {
        // Rien sur la période, ou des filtres trop serrés : deux situations,
        // deux sorties différentes.
        return fiches.length > 0 ? (
            <EmptyState
                icon={FilterX}
                variant="search"
                title="Aucune fiche pour ces filtres"
                description={`${fiches.length} fiche${fiches.length > 1 ? "s" : ""} sur la période, aucune ne correspond. Retirez un filtre ou élargissez la période.`}
                action={{ label: "Réinitialiser les filtres", onClick: () => setFilters(defaultTriFilters()) }}
                className={GESTION_THEME.board.emptyState}
            />
        ) : (
            <EmptyState
                icon={ClipboardList}
                title="Aucune fiche de tri sur la période"
                description="Les feuilles des trieurs saisies ici apparaissent groupées par jour. Élargissez la période ou saisissez la première."
                action={onCreate ? { label: "Nouvelle fiche", onClick: onCreate } : undefined}
                secondaryAction={{ label: "Voir les 90 derniers jours", onClick: () => setFilters({ ...filters, dateFrom: day90(), dateTo: "" }) }}
                className={GESTION_THEME.board.emptyState}
            />
        )
    }

    if (affichage === "cartes") {
        return (
            <div className="flex flex-col gap-5">
                {groups.map((g) => (
                    <section key={g.key} className="flex flex-col gap-2.5" aria-label={String(g.banner)}>
                        <h3 className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="font-semibold capitalize">{g.banner}</span>
                            <span className="text-xs font-semibold tabular-nums text-muted-foreground">{g.bannerTrailing?.content}</span>
                        </h3>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                            {g.rows.map((f) => <FicheTriCard key={f.id} fiche={f} onOpen={onOpen} />)}
                        </div>
                    </section>
                ))}
                {totalPages > 1 && <TablePagination page={page} totalPages={totalPages} onChange={setPage} />}
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-3">
            <RecordTable
                columns={columns}
                groups={groups}
                rowKey={(f) => f.id}
                onRowClick={onOpen}
                animationKey={page}
                fixedLayout
                tableClassName="text-sm"
                wrapperClassName="hidden overflow-x-auto rounded-xl border border-border md:block"
                headerRowClassName="bg-muted/40 border-border hover:bg-muted/40"
                headCellClassName="h-auto px-3 py-2.5 text-xs font-medium whitespace-nowrap text-muted-foreground"
                bodyCellClassName="px-3 py-2.5"
                groupRowClassName="bg-muted/60 border-t border-b border-border hover:bg-muted/60"
                groupLabelClassName="px-3 py-1.5 font-semibold capitalize text-foreground"
                groupSummaryClassName="px-3 py-1.5 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap"
                rowClassName={() => "border-b border-border transition-colors last:border-b-0 hover:bg-muted/30"}
                cardList={GESTION_THEME.board.cardList}
            />
            {totalPages > 1 && <TablePagination page={page} totalPages={totalPages} onChange={setPage} />}
        </div>
    )
}
