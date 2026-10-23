import { useMemo } from "react"
import { X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Separator } from "@/shared/ui/atoms/separator"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import type { BalleFiltersState, BalleCategory, Fournisseur } from "@/features/stock/types/stock.types"
import { GESTION_THEME } from "@/features/stock/theme"

const STATUS_OPTIONS = [
    { value: "all",        label: "Tous" },
    { value: "stocked",    label: "En stock" },
    { value: "used",       label: "Utilisée" },
    { value: "exported",   label: "Exportée" },
    { value: "transfered", label: "Transférée" },
    { value: "imported",   label: "Importée" },
]

const TYPE_OPTIONS = [
    { value: "all",     label: "Tous" },
    { value: "push",    label: "Push" },
    { value: "bags",    label: "Bags" },
    { value: "balle",   label: "Balle" },
    { value: "palette", label: "Palette" },
    { value: "other",   label: "Autre" },
]

const LOCATION_OPTIONS = [
    { value: "all",        label: "Toutes" },
    { value: "warehouse",  label: "Entrepôt" },
    { value: "out",        label: "Extérieur" },
    { value: "import_bay", label: "Baie d'import" },
    { value: "export_bay", label: "Baie d'export" },
    { value: "tri_gros",   label: "Tri Gros" },
    { value: "tri_retail", label: "Tri Retail" },
    { value: "handpick",   label: "Handpick" },
]

interface BalleFiltersPanelProps {
    filters: BalleFiltersState
    setFilters: (filters: Partial<BalleFiltersState>) => void
    resetFilters: () => void
    categories: BalleCategory[]
    fournisseurs: Fournisseur[]
    activeCount: number
}

export function BalleFiltersPanel({
    filters, setFilters, resetFilters,
    categories, fournisseurs, activeCount
}: BalleFiltersPanelProps) {
    const categoryOptions = useMemo(() => [
        { value: "all", label: "Toutes" },
        ...categories.map(c => ({ value: c.id, label: c.name })),
    ], [categories])

    const fournisseurOptions = useMemo(() => [
        { value: "all", label: "Tous" },
        ...fournisseurs.map(f => ({ value: f.id, label: f.name })),
    ], [fournisseurs])

    // Le chrome du panneau (fond, padding, defilement horizontal) appartient a
    // la FilterBar qui le monte : ce composant ne rend que son contenu.
    return (
        <div className="flex items-end gap-2 min-w-max">

                <SearchSelect
                    label="Statut"
                    options={STATUS_OPTIONS}
                    value={filters.status}
                    onChange={(v) => setFilters({ status: v })}
                    placeholder="Tous"
                    size="sm"
                    className="w-[130px]"
                />
                <SearchSelect
                    label="Type"
                    options={TYPE_OPTIONS}
                    value={filters.type}
                    onChange={(v) => setFilters({ type: v })}
                    placeholder="Tous"
                    size="sm"
                    className="w-[130px]"
                />
                <SearchSelect
                    label="Localisation"
                    options={LOCATION_OPTIONS}
                    value={filters.location}
                    onChange={(v) => setFilters({ location: v })}
                    placeholder="Toutes"
                    size="sm"
                    className="w-[140px]"
                />

                <Separator orientation="vertical" className="h-8 mx-1" />

                <SearchSelect
                    label="Catégorie"
                    options={categoryOptions}
                    value={filters.category_id}
                    onChange={(v) => setFilters({ category_id: v })}
                    placeholder="Toutes"
                    size="sm"
                    searchable
                    className="w-[140px]"
                />
                <SearchSelect
                    label="Fournisseur"
                    options={fournisseurOptions}
                    value={filters.fournisseur_id}
                    onChange={(v) => setFilters({ fournisseur_id: v })}
                    placeholder="Tous"
                    size="sm"
                    searchable
                    className="w-[150px]"
                />

                <Separator orientation="vertical" className="h-8 mx-1" />

                <div className="flex flex-col gap-1.5">
                    <span className={GESTION_THEME.filterBar.panelLabel}>Période</span>
                    <div className="flex items-center gap-2">
                        <Input type="date" value={filters.dateFrom}
                            onChange={e => setFilters({ dateFrom: e.target.value })}
                            className="h-8 text-xs w-[135px]" />
                        <span className="text-xs text-slate-400">→</span>
                        <Input type="date" value={filters.dateTo}
                            min={filters.dateFrom}
                            onChange={e => setFilters({ dateTo: e.target.value })}
                            className="h-8 text-xs w-[135px]" />
                    </div>
                </div>

                {activeCount > 0 && (
                    <Button size="sm" variant="ghost" onClick={resetFilters}
                        className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive">
                        <X size={12} /> Réinitialiser
                    </Button>
                )}
        </div>
    )
}
