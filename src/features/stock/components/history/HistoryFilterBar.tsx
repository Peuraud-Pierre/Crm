import { BarChart3, Clock, RefreshCw, TrendingUp, X } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Separator } from "@/shared/ui/atoms/separator"
import { FilterBar } from "@/shared/ui/organisms/filter-bar"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import type { SearchSelectOption } from "@/shared/ui/molecules/search-select"
import { GESTION_THEME } from "@/features/stock/theme"
import type {
    ActivityAction, ActivityEntityType, ViewMode,
} from "@/features/stock/types/history.types"
import { ACTION_LABEL, ENTITY_LABEL } from "../../utils/activityHelpers"

const ACTION_OPTIONS: SearchSelectOption[] = [
    { value: "all",    label: "Toutes" },
    { value: "create", label: ACTION_LABEL.create },
    { value: "update", label: ACTION_LABEL.update },
    { value: "delete", label: ACTION_LABEL.delete },
]

const ENTITY_OPTIONS: SearchSelectOption[] = [
    { value: "all",         label: "Tous" },
    { value: "balle",       label: ENTITY_LABEL.balle },
    { value: "delivery",    label: ENTITY_LABEL.delivery },
    { value: "category",    label: ENTITY_LABEL.category },
    { value: "fournisseur", label: ENTITY_LABEL.fournisseur },
    { value: "arrivage",    label: ENTITY_LABEL.arrivage },
    { value: "fiche_tri",          label: ENTITY_LABEL.fiche_tri },
    { value: "trieur",             label: ENTITY_LABEL.trieur },
    { value: "commande",           label: ENTITY_LABEL.commande },
    { value: "livraison_boutique", label: ENTITY_LABEL.livraison_boutique },
    { value: "carton",             label: ENTITY_LABEL.carton },
]

const VIEWS: { id: ViewMode; label: string; shortLabel: string; icon: LucideIcon }[] = [
    { id: "journal", label: "Journal d'activité",  shortLabel: "Journal", icon: Clock },
    { id: "analyse", label: "Analyse fournisseurs", shortLabel: "Analyse", icon: BarChart3 },
    { id: "prix",    label: "Prix des catégories",  shortLabel: "Prix",    icon: TrendingUp },
]

interface HistoryFilterBarProps {
    view: ViewMode
    onViewChange: (view: ViewMode) => void

    filtersOpen: boolean
    onFiltersOpenChange: (open: boolean) => void
    /** Nombre de filtres actifs, déjà adapté à la vue courante. */
    activeCount: number

    actionFilter: ActivityAction | "all"
    onActionFilterChange: (value: ActivityAction | "all") => void
    entityFilter: ActivityEntityType | "all"
    onEntityFilterChange: (value: ActivityEntityType | "all") => void
    dateFrom: string
    onDateFromChange: (value: string) => void
    dateTo: string
    onDateToChange: (value: string) => void
    onReset: () => void

    onRefresh: () => void
    refreshing: boolean
}

export function HistoryFilterBar({
    view, onViewChange,
    filtersOpen, onFiltersOpenChange, activeCount,
    actionFilter, onActionFilterChange,
    entityFilter, onEntityFilterChange,
    dateFrom, onDateFromChange, dateTo, onDateToChange, onReset,
    onRefresh, refreshing,
}: HistoryFilterBarProps) {
    // La vue Prix a son propre sélecteur de catégorie et ignore la période.
    const filterable = view !== "prix"
    // Action et type ne s'appliquent qu'au journal ; la période pilote les deux
    // autres vues, d'où un seul et même état de filtre.
    const showLogFilters = view === "journal"

    return (
        <FilterBar
            theme={GESTION_THEME.filterBar}
            activeCount={activeCount}
            open={filtersOpen}
            onOpenChange={onFiltersOpenChange}
            // La vue Prix a son propre selecteur de categorie et ignore la
            // periode : le bouton Filtres et le panneau disparaissent.
            filterable={filterable}
            leading={
                <div className={cn(GESTION_THEME.filterBar.tabToggle, "w-full shrink-0 sm:w-fit")}>
                    {VIEWS.map(({ id, label, shortLabel, icon: Icon }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => onViewChange(id)}
                            aria-current={view === id ? "true" : undefined}
                            className={cn(
                                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:flex-none",
                                view === id
                                    ? GESTION_THEME.filterBar.tabActive
                                    : GESTION_THEME.filterBar.tabInactive,
                            )}
                        >
                            <Icon size={12} />
                            <span className="hidden md:inline">{label}</span>
                            <span className="md:hidden">{shortLabel}</span>
                        </button>
                    ))}
                </div>
            }
            trailing={
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={onRefresh}
                    disabled={refreshing}
                >
                    <RefreshCw size={13} className={cn(refreshing && "animate-spin")} />
                    <span className="hidden sm:inline">Actualiser</span>
                </Button>
            }
        >
            <div className="flex min-w-max items-end gap-2">
                            {showLogFilters && (
                                <>
                                    <SearchSelect
                                        label="Action"
                                        options={ACTION_OPTIONS}
                                        value={actionFilter}
                                        onChange={(v) => onActionFilterChange(v as ActivityAction | "all")}
                                        placeholder="Toutes"
                                        size="sm"
                                        className="w-32"
                                    />
                                    <SearchSelect
                                        label="Type"
                                        options={ENTITY_OPTIONS}
                                        value={entityFilter}
                                        onChange={(v) => onEntityFilterChange(v as ActivityEntityType | "all")}
                                        placeholder="Tous"
                                        size="sm"
                                        className="w-36"
                                    />
                                    <Separator orientation="vertical" className="mx-1 h-8" />
                                </>
                            )}

                            <div className="flex flex-col gap-1.5">
                                <span className={GESTION_THEME.filterBar.panelLabel}>Période</span>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="date"
                                        aria-label="Début de période"
                                        value={dateFrom}
                                        onChange={(e) => onDateFromChange(e.target.value)}
                                        className="h-8 w-36 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">→</span>
                                    <Input
                                        type="date"
                                        aria-label="Fin de période"
                                        value={dateTo}
                                        min={dateFrom}
                                        onChange={(e) => onDateToChange(e.target.value)}
                                        className="h-8 w-36 text-xs"
                                    />
                                </div>
                            </div>

                            {activeCount > 0 && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={onReset}
                                    className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                                >
                                    <X size={12} />
                                    Réinitialiser
                                </Button>
                )}
            </div>
        </FilterBar>
    )
}
