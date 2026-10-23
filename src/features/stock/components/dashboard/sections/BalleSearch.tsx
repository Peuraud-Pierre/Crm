import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router"
import {
    Check, ChevronDown, ChevronLeft, ChevronRight,
    ChevronsLeft, ChevronsRight, ExternalLink, Search, SearchX, X,
} from "lucide-react"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/atoms/card"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/atoms/popover"
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/shared/ui/organisms/command"
import { cn } from "@/shared/lib/utils"
import {
    Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/shared/ui/atoms/table"

import {
    useBalleContext,
    useReferentialContext,
    useStockUIContext,
} from "@/features/stock/hooks/context/StockProvider"
import { GESTION_THEME } from "@/features/stock/theme"
import { STOCK_PAGE_SIZE } from "@/features/stock/constants"
import type { Balle } from "@/features/stock/types/balle.types"
import { STOCK_ROUTE_BASE } from "@/features/stock/types/ui.types"

// ─── MultiSelect ──────────────────────────────────────────────────────────────

function MultiSelect<T extends { id: string; name: string }>({
    options, selected, onChange, placeholder,
}: {
    options:     T[]
    selected:    string[]
    onChange:    (ids: string[]) => void
    placeholder: string
}) {
    const [open, setOpen] = useState(false)

    const label =
        selected.length === 0     ? placeholder
        : selected.length === 1   ? (options.find((o) => o.id === selected[0])?.name ?? "1 sélectionné")
        :                           `${selected.length} sélectionnés`

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-full sm:min-w-[140px] sm:w-auto justify-between gap-2 text-xs font-normal"
                >
                    <span className={cn(selected.length === 0 && "text-muted-foreground")}>{label}</span>
                    <ChevronDown size={12} className="text-slate-400 shrink-0" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
                <Command>
                    <CommandInput placeholder="Rechercher…" className="h-8 text-xs" />
                    <CommandList>
                        <CommandEmpty>Aucun résultat.</CommandEmpty>
                        <CommandGroup>
                            {options.map((opt) => {
                                const isSelected = selected.includes(opt.id)
                                return (
                                    <CommandItem
                                        key={opt.id}
                                        value={opt.name}
                                        onSelect={() => onChange(
                                            isSelected
                                                ? selected.filter((id) => id !== opt.id)
                                                : [...selected, opt.id]
                                        )}
                                        className="text-xs"
                                    >
                                        <Check
                                            size={14}
                                            className={cn("mr-2 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                                        />
                                        {opt.name}
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

// ─── StatChip ─────────────────────────────────────────────────────────────────

function StatChip({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-4 py-2 min-w-[110px]">
            <span className="text-2xs text-slate-500 dark:text-slate-400">{label}</span>
            <span className="text-base font-semibold tabular-nums">{value}</span>
        </div>
    )
}

// ─── BalleSearchSection ───────────────────────────────────────────────────────

const PAGE_SIZE = STOCK_PAGE_SIZE

export function BalleSearchSection() {
    const { balles }                   = useBalleContext()
    const { categories, fournisseurs } = useReferentialContext()
    const { setSearchInput, setViewMode } = useStockUIContext()
    const navigate = useNavigate()

    const [selectedCategories,   setSelectedCategories]   = useState<string[]>([])
    const [selectedFournisseurs, setSelectedFournisseurs] = useState<string[]>([])
    const [dateFrom, setDateFrom] = useState("")
    const [dateTo,   setDateTo]   = useState("")
    const [page, setPage] = useState(0)

    // Reset to first page whenever filters change (reset de pagination dérivé des filtres)
    useEffect(() => {
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setPage(0)
    }, [selectedCategories, selectedFournisseurs, dateFrom, dateTo])

    const catMap = useMemo(
        () => new Map(categories.map((c) => [c.id, c])),
        [categories],
    )

    const hasFilters =
        selectedCategories.length > 0 ||
        selectedFournisseurs.length > 0 ||
        !!dateFrom ||
        !!dateTo

    const filteredBalles = useMemo(() => {
        if (!hasFilters) return []
        return (balles ?? []).filter((b) => {
            if (selectedCategories.length > 0   && !selectedCategories.includes(b.category_id))    return false
            if (selectedFournisseurs.length > 0  && !selectedFournisseurs.includes(b.fournisseur_id)) return false
            if (dateFrom && b.import_date < dateFrom) return false
            if (dateTo   && b.import_date > dateTo)   return false
            return true
        })
    }, [balles, selectedCategories, selectedFournisseurs, dateFrom, dateTo, hasFilters])

    const stats = useMemo(() => {
        if (filteredBalles.length === 0) return null
        const prices: number[] = []
        let totalPacking = 0
        for (const b of filteredBalles) {
            const cat = catMap.get(b.category_id)
            if (cat?.unit_price) prices.push(cat.unit_price)
            totalPacking += b.packing
        }
        return {
            count:        filteredBalles.length,
            totalPacking,
            minPrice:     prices.length ? Math.min(...prices) : null,
            maxPrice:     prices.length ? Math.max(...prices) : null,
        }
    }, [filteredBalles, catMap])

    const totalPages  = Math.max(1, Math.ceil(filteredBalles.length / PAGE_SIZE))
    const currentPage = Math.min(page, totalPages - 1)
    const start       = currentPage * PAGE_SIZE
    const end         = Math.min(start + PAGE_SIZE, filteredBalles.length)
    const visible     = filteredBalles.slice(start, end)

    const goTo = (p: number) => setPage(Math.max(0, Math.min(totalPages - 1, p)))

    function handleOpenBalle(balle: Balle) {
        setSearchInput(balle.bin)
        setViewMode("balles")
        navigate(`${STOCK_ROUTE_BASE}/inventaire`)
    }

    function handleReset() {
        setSelectedCategories([])
        setSelectedFournisseurs([])
        setDateFrom("")
        setDateTo("")
    }

    const fmtPrice = (p: number) =>
        p.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 })

    const fmtDate = (iso: string) =>
        new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })

    return (
        <div className="space-y-4">
            <h2 className={GESTION_THEME.section.groupTitle}>
                Recherche de balles
            </h2>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Search size={16} className="text-slate-500" />
                        Filtres
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
                        <div className="flex flex-col gap-1 w-full sm:w-auto">
                            <span className="text-xs text-slate-500">Catégories</span>
                            <MultiSelect
                                options={categories}
                                selected={selectedCategories}
                                onChange={setSelectedCategories}
                                placeholder="Toutes"
                            />
                        </div>
                        <div className="flex flex-col gap-1 w-full sm:w-auto">
                            <span className="text-xs text-slate-500">Fournisseurs</span>
                            <MultiSelect
                                options={fournisseurs}
                                selected={selectedFournisseurs}
                                onChange={setSelectedFournisseurs}
                                placeholder="Tous"
                            />
                        </div>
                        <div className="flex flex-col gap-1 w-full sm:w-auto">
                            <span className="text-xs text-slate-500">Du</span>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="h-8 text-xs w-full sm:w-36"
                            />
                        </div>
                        <div className="flex flex-col gap-1 w-full sm:w-auto">
                            <span className="text-xs text-slate-500">Au</span>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="h-8 text-xs w-full sm:w-36"
                            />
                        </div>
                        {hasFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-xs self-start sm:self-end"
                                onClick={handleReset}
                            >
                                <X size={12} />
                                Réinitialiser
                            </Button>
                        )}
                    </div>

                    {/* Results */}
                    {!hasFilters ? (
                        <div className="text-sm text-slate-400 dark:text-slate-500 py-8 text-center">
                            Sélectionnez au moins un filtre pour lancer la recherche.
                        </div>
                    ) : balles === undefined ? (
                        <div className="text-sm text-muted-foreground py-6 text-center">Chargement…</div>
                    ) : (
                        <>
                            {/* Stats */}
                            {stats ? (
                                <div className="flex flex-wrap gap-3">
                                    <StatChip label="Balles trouvées" value={String(stats.count)} />
                                    <StatChip
                                        label="Poids total"
                                        value={`${stats.totalPacking.toLocaleString("fr-FR")} kg`}
                                    />
                                    {stats.minPrice !== null && (
                                        <StatChip label="Prix unitaire min" value={fmtPrice(stats.minPrice)} />
                                    )}
                                    {stats.maxPrice !== null && stats.maxPrice !== stats.minPrice && (
                                        <StatChip label="Prix unitaire max" value={fmtPrice(stats.maxPrice)} />
                                    )}
                                </div>
                            ) : (
                                <EmptyState
                                    size="sm"
                                    variant="search"
                                    icon={SearchX}
                                    title="Aucune balle ne correspond"
                                    description="Ajustez les filtres pour élargir la recherche."
                                />
                            )}

                            {/* List */}
                            {filteredBalles.length > 0 && (
                                <>
                                    {/* Pagination toolbar */}
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs text-slate-400 dark:text-slate-500">
                                            {start + 1}–{end} sur {filteredBalles.length}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === 0} onClick={() => goTo(0)} aria-label="Première page">
                                                <ChevronsLeft size={13} />
                                            </Button>
                                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage === 0} onClick={() => goTo(currentPage - 1)} aria-label="Page précédente">
                                                <ChevronLeft size={13} />
                                            </Button>
                                            <span className="text-xs text-slate-500 px-2 tabular-nums min-w-[60px] text-center">
                                                {currentPage + 1} / {totalPages}
                                            </span>
                                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage >= totalPages - 1} onClick={() => goTo(currentPage + 1)} aria-label="Page suivante">
                                                <ChevronRight size={13} />
                                            </Button>
                                            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={currentPage >= totalPages - 1} onClick={() => goTo(totalPages - 1)} aria-label="Dernière page">
                                                <ChevronsRight size={13} />
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Mobile card list */}
                                    <div className="sm:hidden rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                                        {visible.map((balle) => {
                                            const catName   = balle.category?.name ?? catMap.get(balle.category_id)?.name ?? "—"
                                            const fournName = balle.fournisseur?.name ?? balle.fournisseur_id ?? "—"
                                            return (
                                                <div key={balle.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-mono font-semibold text-sm">{balle.bin}</span>
                                                            {balle.status && (
                                                                <Badge variant="outline" className="text-3xs">{balle.status}</Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                                            {fournName} · {catName}
                                                        </p>
                                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                                            {balle.packing.toLocaleString("fr-FR")} kg · {fmtDate(balle.import_date)}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 shrink-0 text-slate-400"
                                                        onClick={() => handleOpenBalle(balle)}
                                                        title="Ouvrir dans l'onglet Stock"
                                                    >
                                                        <ExternalLink size={13} />
                                                    </Button>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    {/* Desktop table */}
                                    <div className="hidden sm:block rounded-lg border border-primary/20 overflow-x-auto">
                                        <Table className="text-xs min-w-[560px]">
                                            <TableHeader>
                                                <TableRow className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                                    {[
                                                        { label: "BIN",         w: "14%" },
                                                        { label: "Fournisseur", w: "22%" },
                                                        { label: "Catégorie",   w: "20%" },
                                                        { label: "Poids (kg)",  w: "12%" },
                                                        { label: "Import",      w: "16%" },
                                                        { label: "Statut",      w: "12%" },
                                                        { label: "",            w: "4%"  },
                                                    ].map((col) => (
                                                        <TableHead
                                                            key={col.label}
                                                            style={{ width: col.w }}
                                                            className="h-auto px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400"
                                                        >
                                                            {col.label}
                                                        </TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {visible.map((balle) => (
                                                    <TableRow
                                                        key={balle.id}
                                                        className="group border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900/30"
                                                    >
                                                        <TableCell className="px-3 py-2.5 font-mono font-medium">
                                                            {balle.bin}
                                                        </TableCell>
                                                        <TableCell className="px-3 py-2.5 truncate text-slate-600 dark:text-slate-300">
                                                            {balle.fournisseur?.name ?? balle.fournisseur_id ?? "—"}
                                                        </TableCell>
                                                        <TableCell className="px-3 py-2.5 truncate text-slate-600 dark:text-slate-300">
                                                            {balle.category?.name ?? catMap.get(balle.category_id)?.name ?? "—"}
                                                        </TableCell>
                                                        <TableCell className="px-3 py-2.5 tabular-nums text-slate-500 dark:text-slate-400">
                                                            {balle.packing.toLocaleString("fr-FR")}
                                                        </TableCell>
                                                        <TableCell className="px-3 py-2.5 text-slate-500 dark:text-slate-400">
                                                            {fmtDate(balle.import_date)}
                                                        </TableCell>
                                                        <TableCell className="px-3 py-2.5">
                                                            {balle.status ? (
                                                                <Badge variant="outline" className="text-3xs">
                                                                    {balle.status}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-slate-300 dark:text-slate-600">—</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="px-2 py-2.5 text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={() => handleOpenBalle(balle)}
                                                                title="Ouvrir dans l'onglet Stock"
                                                            >
                                                                <ExternalLink size={12} />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
