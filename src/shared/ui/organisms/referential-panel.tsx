import { useMemo, useState, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/shared/ui/atoms/table"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/shared/ui/atoms/alert-dialog"
import { cn } from "@/shared/lib/utils"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

/**
 * Panneau de CRUD d'un référentiel : table (>= md) / cartes (< md), recherche,
 * pagination, édition inline et confirmation de suppression.
 *
 * Vit dans le design system et non dans une feature : il ne connaît aucune
 * entité métier. Il vivait sous `features/stock/components/settings/shared/`
 * et lisait STOCK_PERMISSIONS, GESTION_THEME et SETTINGS_PAGE_SIZE en dur —
 * ces trois dépendances sont devenues des props (`canCreate`/`canUpdate`/
 * `canDelete`, `sectionTheme`, `pageSize`), pour que `stock` et
 * `stock_handpick` partagent le composant sans partager leurs constantes.
 *
 * Les droits arrivent RÉSOLUS : le panneau n'appelle pas `hasPermission`, ce
 * qui le laisse hors de toute dépendance à la feature auth.
 */

/**
 * Une colonne décrit la donnée une seule fois ; le panneau la rend en table
 * (>= md) et en carte (< md), selon le pattern maison. `primary` marque la
 * colonne d'identité, mise en avant en tête de carte sur mobile.
 */
export interface ReferentialColumn<T> {
    key: string
    header: string
    cell: (item: T) => ReactNode
    primary?: boolean
    /** Classes appliquées à la cellule ET à l'en-tête (largeur, alignement…). */
    className?: string
}

export interface ReferentialPanelLabels {
    title: string
    description: string
    searchPlaceholder: string
    createLabel: string
    emptyTitle: string
    emptyHint: string
    /** Singulier, pour les phrases de comptage : « 3 fournisseurs ». */
    unit: string
}

/** Classes du bloc d'en-tête, fournies par le thème de la feature appelante. */
export interface ReferentialSectionTheme {
    title: string
    description: string
}

interface ReferentialPanelProps<T extends { id: string }> {
    labels: ReferentialPanelLabels
    icon: LucideIcon
    /** Droits déjà résolus par l'appelant (voir la note en tête de fichier). */
    canCreate: boolean
    canUpdate: boolean
    canDelete: boolean
    sectionTheme: ReferentialSectionTheme
    /** Lignes par page. */
    pageSize: number
    items: T[]
    loading?: boolean
    columns: ReferentialColumn<T>[]
    /** Prédicat de recherche, propre au domaine. */
    matches: (item: T, query: string) => boolean
    /** Libellé de l'élément dans la confirmation de suppression. */
    itemLabel: (item: T) => string
    /** Phrase d'impact chiffrée affichée avant suppression, si pertinente. */
    deleteImpact?: (item: T) => string | null
    /** Le résultat éventuel (succès, élément) est ignoré : seule la fin de l'appel compte. */
    onDelete: (item: T) => Promise<unknown>
    /** Ligne d'édition inline, rendue à la place de la ligne courante. */
    renderEditRow: (item: T, done: () => void) => ReactNode
    onCreateClick: () => void
    /** Sheet de création, montée par le menu du domaine. */
    createSheet: ReactNode
}

const SKELETON_ROWS = ["sk1", "sk2", "sk3", "sk4", "sk5"]

export function ReferentialPanel<T extends { id: string }>({
    labels, icon: Icon, items, loading = false, columns, matches, itemLabel,
    deleteImpact, onDelete, renderEditRow, onCreateClick, createSheet,
    canCreate, canUpdate, canDelete, sectionTheme, pageSize: PAGE_SIZE,
}: ReferentialPanelProps<T>) {
    const canAct = canUpdate || canDelete

    const [search, setSearch]       = useState("")
    const [page, setPage]           = useState(1)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [pendingDelete, setPendingDelete] = useState<T | null>(null)
    const [deleting, setDeleting]   = useState(false)

    const handleSearch = (value: string) => { setSearch(value); setPage(1) }

    const filtered = useMemo(
        () => (search ? items.filter((item) => matches(item, search.toLowerCase())) : items),
        [items, search, matches],
    )

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const safePage   = Math.min(page, totalPages)
    const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

    const confirmDelete = async () => {
        if (!pendingDelete) return
        setDeleting(true)
        try {
            await onDelete(pendingDelete)
            setPendingDelete(null)
        } finally {
            setDeleting(false)
        }
    }

    const primaryColumn = columns.find((col) => col.primary) ?? columns[0]
    const impact = pendingDelete ? deleteImpact?.(pendingDelete) ?? null : null

    const rowActions = (item: T) => (
        <div className="flex items-center justify-end gap-1 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            {canUpdate && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    aria-label={`Modifier ${itemLabel(item)}`}
                    onClick={() => setEditingId(item.id)}
                >
                    <Pencil size={14} />
                </Button>
            )}
            {canDelete && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    aria-label={`Supprimer ${itemLabel(item)}`}
                    onClick={() => setPendingDelete(item)}
                >
                    <Trash2 size={14} />
                </Button>
            )}
        </div>
    )

    return (
        <div className="flex flex-col gap-5">

            {/* En-tête */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h3 className={sectionTheme.title}>{labels.title}</h3>
                    <p className={sectionTheme.description}>{labels.description}</p>
                </div>
                {canCreate && (
                    <Button className="w-full gap-2 shadow-sm sm:w-auto" onClick={onCreateClick}>
                        <Plus size={16} />
                        {labels.createLabel}
                    </Button>
                )}
            </div>

            {/* Recherche */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:w-80">
                    <Search
                        size={16}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                        placeholder={labels.searchPlaceholder}
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        aria-label={labels.searchPlaceholder}
                        className="h-10 w-full border-border bg-background pl-10"
                    />
                </div>
                {!loading && (
                    <span className="text-sm text-muted-foreground tabular-nums">
                        {filtered.length} {labels.unit}{filtered.length > 1 ? "s" : ""}
                    </span>
                )}
            </div>

            {/* Contenu */}
            <div aria-busy={loading}>
                {loading ? (
                    <div className="flex flex-col gap-2">
                        {SKELETON_ROWS.map((key) => (
                            <Skeleton key={key} aria-hidden className="h-14 w-full rounded-lg" />
                        ))}
                    </div>
                ) : paginated.length === 0 ? (
                    <EmptyState
                        icon={Icon}
                        variant={search ? "search" : "default"}
                        title={search ? "Aucun résultat" : labels.emptyTitle}
                        description={
                            search
                                ? "Aucun élément ne correspond à votre recherche."
                                : labels.emptyHint
                        }
                        action={
                            !search && canCreate
                                ? {
                                      label: labels.createLabel,
                                      onClick: onCreateClick,
                                      icon: Plus,
                                  }
                                : undefined
                        }
                        className="rounded-xl border-2 border-dashed border-border bg-muted/20"
                    />
                ) : (
                    <>
                        {/* Desktop : table */}
                        <div className="hidden overflow-hidden rounded-xl border border-border md:block">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        {columns.map((col) => (
                                            <TableHead key={col.key} className={col.className}>
                                                {col.header}
                                            </TableHead>
                                        ))}
                                        {canAct && <TableHead className="w-24 text-right">Actions</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginated.map((item) =>
                                        editingId === item.id ? (
                                            <TableRow key={item.id} className="hover:bg-transparent">
                                                <TableCell colSpan={columns.length + (canAct ? 1 : 0)} className="p-2">
                                                    {renderEditRow(item, () => setEditingId(null))}
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            <TableRow key={item.id} className="group">
                                                {columns.map((col) => (
                                                    <TableCell
                                                        key={col.key}
                                                        className={cn(col.primary && "font-medium text-foreground", col.className)}
                                                    >
                                                        {col.cell(item)}
                                                    </TableCell>
                                                ))}
                                                {canAct && <TableCell>{rowActions(item)}</TableCell>}
                                            </TableRow>
                                        ),
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile : cartes */}
                        <div className="flex flex-col gap-3 md:hidden">
                            {paginated.map((item) =>
                                editingId === item.id ? (
                                    <div key={item.id}>{renderEditRow(item, () => setEditingId(null))}</div>
                                ) : (
                                    <div
                                        key={item.id}
                                        className="group flex flex-col gap-2 rounded-xl border border-border p-4"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
                                                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                <span className="truncate">{primaryColumn.cell(item)}</span>
                                            </div>
                                            {canAct && rowActions(item)}
                                        </div>
                                        <dl className="flex flex-col gap-1">
                                            {columns.filter((col) => col !== primaryColumn).map((col) => (
                                                <div key={col.key} className="flex items-baseline gap-2 text-sm">
                                                    <dt className="text-muted-foreground">{col.header}</dt>
                                                    <dd className="text-foreground">{col.cell(item)}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </div>
                                ),
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-4 sm:flex-row">
                    <span className="order-2 text-sm text-muted-foreground tabular-nums sm:order-1">
                        Page {safePage} sur {totalPages}
                    </span>
                    <div className="order-1 flex w-full items-center gap-2 sm:order-2 sm:w-auto">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 flex-1 px-4 sm:flex-none"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={safePage === 1}
                        >
                            <ChevronLeft size={16} className="sm:mr-1" />
                            <span className="hidden sm:inline">Précédent</span>
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-9 flex-1 px-4 sm:flex-none"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage === totalPages}
                        >
                            <span className="hidden sm:inline">Suivant</span>
                            <ChevronRight size={16} className="sm:ml-1" />
                        </Button>
                    </div>
                </div>
            )}

            {createSheet}

            {/* Confirmation de suppression */}
            <AlertDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => { if (!open && !deleting) setPendingDelete(null) }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Supprimer « {pendingDelete ? itemLabel(pendingDelete) : ""} » ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {impact ?? "Cette action est définitive."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => { e.preventDefault(); confirmDelete() }}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? "Suppression…" : "Supprimer"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
