import { useMemo, type ReactNode } from "react"
import { X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { SearchSelect } from "@/shared/ui/molecules/search-select"
import type { SearchSelectOption } from "@/shared/ui/molecules/search-select"
import { FilterBar, countActiveFilters } from "@/shared/ui/organisms/filter-bar"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import {
    BALLE_LOCATION_LABELS,
    BALLE_STATUS_CONFIG,
} from "@/features/stock_handpick/constants"
import {
    useBalleHandpickContext,
    useReferentialHandpickContext,
} from "@/features/stock_handpick/hooks/context/StockHandpickProvider"
import {
    DEFAULT_BALLE_HANDPICK_FILTERS,
    type BalleHandpickLocation,
    type BalleHandpickStatus,
} from "@/features/stock_handpick/types/balle.types"
import {
    PLACE_ALL,
    PLACE_BORROWED,
    PLACE_ECLATEE,
    PLACE_UNPLACED,
    placeFilterKeys,
    placeLabel,
} from "@/features/stock_handpick/utils/placeGroups"

const ALL = "all"

interface BalleFilterBarProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Bascule Grille/Tableau, montée par l'onglet qui détient l'état. */
    displayToggle?: ReactNode
    /**
     * Action principale de l'écran (créer une balle), rendue après le bouton
     * Filtres. Elle vit ici et non dans un en-tête de section : l'onglet porte
     * déjà le nom « Inventaire », le répéter au-dessus de la barre n'ajoutait
     * qu'une ligne de titre.
     */
    action?: ReactNode
}

/**
 * Barre de filtres de l'inventaire, montée sur la coquille partagée : même
 * disposition, même bouton Filtres et même badge de comptage que le stock
 * principal. Les filtres vivaient auparavant à plat, toujours visibles — la
 * barre débordait sur trois lignes dès quatre filtres.
 *
 * L'état d'ouverture est détenu par l'onglet, pas ici : il doit survivre à un
 * re-rendu de la barre et pouvoir être ouvert depuis l'extérieur.
 */
export function BalleFilterBar({
    open,
    onOpenChange,
    displayToggle,
    action,
}: BalleFilterBarProps) {
    const {
        filters,
        setFilters,
        search,
        setSearch,
        hasActiveFilters,
        resetFilters,
        filteredBalles,
        total,
        emplacementOptions,
    } = useBalleHandpickContext()
    const { fournisseurs, categories } = useReferentialHandpickContext()

    // Le décompte se déduit des valeurs par défaut : un filtre ajouté à
    // `BalleHandpickFiltersState` est compté sans rien toucher ici.
    const activeCount = countActiveFilters(filters, DEFAULT_BALLE_HANDPICK_FILTERS)

    // `ALL` est une option comme une autre : sans elle, le select n'aurait
    // aucune valeur sélectionnée à l'état initial et afficherait un vide.
    const placeKeys = useMemo(
        () => placeFilterKeys(emplacementOptions.map((option) => option.segments)),
        [emplacementOptions],
    )

    const fournisseurOptions = useMemo<SearchSelectOption[]>(
        () => [
            { value: ALL, label: "Toutes les usines" },
            ...fournisseurs.map((fournisseur) => ({
                value: fournisseur.id,
                label: fournisseur.name,
            })),
        ],
        [fournisseurs],
    )

    const categoryOptions = useMemo<SearchSelectOption[]>(
        () => [
            { value: ALL, label: "Toutes les catégories" },
            ...categories.map((category) => ({
                value: category.id,
                label: category.name,
                subLabel: category.tag ?? undefined,
            })),
        ],
        [categories],
    )

    return (
        <FilterBar
            theme={HANDPICK_THEME.filterBar}
            activeCount={activeCount}
            open={open}
            onOpenChange={onOpenChange}
            search={{
                value: search,
                onChange: setSearch,
                placeholder: "Libellé, usine, catégorie, emplacement…",
                ariaLabel: "Rechercher une balle",
            }}
            action={action}
            trailing={
                <>
                    <span className="text-sm tabular-nums text-muted-foreground">
                        {filteredBalles.length} sur {total} balle{total > 1 ? "s" : ""}
                    </span>
                    {displayToggle}
                </>
            }
        >
            <div className="flex min-w-max items-end gap-2">
                <div className="flex flex-col gap-1.5">
                    <span className={HANDPICK_THEME.filterBar.panelLabel}>Statut</span>
                    <Select
                        value={filters.status}
                        onValueChange={(value) =>
                            setFilters({ ...filters, status: value as BalleHandpickStatus | "all" })
                        }
                    >
                        <SelectTrigger className="h-8 w-40 text-xs" aria-label="Filtrer par statut">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>Tous les statuts</SelectItem>
                            {Object.entries(BALLE_STATUS_CONFIG).map(([key, config]) => (
                                <SelectItem key={key} value={key}>
                                    {config.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <span className={HANDPICK_THEME.filterBar.panelLabel}>Emplacement</span>
                    <Select
                        value={filters.place}
                        onValueChange={(value) => setFilters({ ...filters, place: value })}
                    >
                        <SelectTrigger className="h-8 w-56 text-xs" aria-label="Filtrer par emplacement">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={PLACE_ALL}>{placeLabel(PLACE_ALL)}</SelectItem>
                            {placeKeys.map((key) => (
                                <SelectItem key={key} value={key}>
                                    {/* Les racks sont en retrait sous leur zone. */}
                                    {key.includes("/") ? (
                                        <span className="pl-3">{placeLabel(key).split(" — ")[1]}</span>
                                    ) : (
                                        <span className="font-medium">{placeLabel(key)}</span>
                                    )}
                                </SelectItem>
                            ))}
                            <SelectItem value={PLACE_BORROWED}>{placeLabel(PLACE_BORROWED)}</SelectItem>
                            <SelectItem value={PLACE_UNPLACED}>{placeLabel(PLACE_UNPLACED)}</SelectItem>
                            <SelectItem value={PLACE_ECLATEE}>{placeLabel(PLACE_ECLATEE)}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* État physique de la balle, indépendant du plan. */}
                <div className="flex flex-col gap-1.5">
                    <span className={HANDPICK_THEME.filterBar.panelLabel}>Situation</span>
                    <Select
                        value={filters.location}
                        onValueChange={(value) =>
                            setFilters({
                                ...filters,
                                location: value as BalleHandpickLocation | "all",
                            })
                        }
                    >
                        <SelectTrigger className="h-8 w-40 text-xs" aria-label="Filtrer par situation">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>Toutes les situations</SelectItem>
                            {Object.entries(BALLE_LOCATION_LABELS).map(([key, label]) => (
                                <SelectItem key={key} value={key}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Référentiels : SearchSelect et non Select — le nombre
                    d'entrées croît avec les données, la recherche s'impose. */}
                <SearchSelect
                    label="Usine"
                    searchable
                    size="sm"
                    options={fournisseurOptions}
                    value={filters.fournisseur_id}
                    onChange={(value) => setFilters({ ...filters, fournisseur_id: value })}
                    className="w-48"
                    emptyMessage="Aucune usine"
                />

                <SearchSelect
                    label="Catégorie"
                    searchable
                    size="sm"
                    options={categoryOptions}
                    value={filters.category_id}
                    onChange={(value) => setFilters({ ...filters, category_id: value })}
                    className="w-48"
                    emptyMessage="Aucune catégorie"
                />

                <div className="flex flex-col gap-1.5">
                    <span className={HANDPICK_THEME.filterBar.panelLabel}>Période d'entrée</span>
                    <div className="flex items-center gap-2">
                        <Input
                            type="date"
                            aria-label="Début de période"
                            value={filters.dateFrom ?? ""}
                            onChange={(event) =>
                                setFilters({ ...filters, dateFrom: event.target.value || null })
                            }
                            className="h-8 w-36 text-xs"
                        />
                        <span className="text-xs text-muted-foreground">→</span>
                        <Input
                            type="date"
                            aria-label="Fin de période"
                            value={filters.dateTo ?? ""}
                            min={filters.dateFrom ?? undefined}
                            onChange={(event) =>
                                setFilters({ ...filters, dateTo: event.target.value || null })
                            }
                            className="h-8 w-36 text-xs"
                        />
                    </div>
                </div>

                {hasActiveFilters && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={resetFilters}
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
