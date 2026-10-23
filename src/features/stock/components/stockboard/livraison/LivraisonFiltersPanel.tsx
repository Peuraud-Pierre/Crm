import { useMemo } from "react"
import { X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Separator } from "@/shared/ui/atoms/separator"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import type { DeliveryFiltersState, Fournisseur } from "@/features/stock/types/stock.types"
import { GESTION_THEME } from "@/features/stock/theme"

const TYPE_OPTIONS = [
    { value: "all",     label: "Tous" },
    { value: "push",    label: "Push" },
    { value: "bags",    label: "Bags" },
    { value: "balle",   label: "Balle" },
    { value: "palette", label: "Palette" },
    { value: "other",   label: "Autre" },
]

interface DeliveryFiltersPanelProps {
    filters: DeliveryFiltersState
    setFilters: (filters: Partial<DeliveryFiltersState>) => void
    resetFilters: () => void
    fournisseurs: Fournisseur[]
    activeCount: number
}

export function DeliveryFiltersPanel({
    filters, setFilters, resetFilters,
    fournisseurs, activeCount
}: DeliveryFiltersPanelProps) {
    const fournisseurOptions = useMemo(() => [
        { value: "all", label: "Tous" },
        ...fournisseurs.map(f => ({ value: f.id, label: f.name })),
    ], [fournisseurs])

    // Le chrome du panneau (fond, padding, defilement horizontal) appartient a
    // la FilterBar qui le monte : ce composant ne rend que son contenu.
    return (
        <div className="flex items-end gap-2 min-w-max">

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
                <SearchSelect
                    label="Type"
                    options={TYPE_OPTIONS}
                    value={filters.type}
                    onChange={(v) => setFilters({ type: v })}
                    placeholder="Tous"
                    size="sm"
                    className="w-[130px]"
                />

                <Separator orientation="vertical" className="h-8 mx-1" />

                <div className="flex flex-col gap-1.5">
                    <span className={GESTION_THEME.filterBar.panelLabel}>Nb. balles</span>
                    <div className="flex items-center gap-2">
                        <Input type="number" min="0" placeholder="Min"
                            value={filters.ballsCountMin}
                            onChange={e => setFilters({ ballsCountMin: e.target.value })}
                            className="h-8 text-xs w-[70px]" />
                        <span className="text-xs text-slate-400">→</span>
                        <Input type="number" min={filters.ballsCountMin || "0"} placeholder="Max"
                            value={filters.ballsCountMax}
                            onChange={e => setFilters({ ballsCountMax: e.target.value })}
                            className="h-8 text-xs w-[70px]" />
                    </div>
                </div>

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
