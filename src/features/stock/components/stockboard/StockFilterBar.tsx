import { useRef, useState } from "react"
import { Search, Package, Truck, Plus, Grid, TablePropertiesIcon } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Separator } from "@/shared/ui/atoms/separator"
import { Input } from "@/shared/ui/atoms/input"
import { TabButton, TabButtonGroup } from "@/shared/ui/molecules/tab-button-group"
import { FilterBar, countActiveFilters } from "@/shared/ui/organisms/filter-bar"
import { BalleFiltersPanel } from "./balle/BalleFiltersPanel"
import { DeliveryFiltersPanel } from "./livraison/LivraisonFiltersPanel"
import {
    useBalleContext,
    useDeliveryContext,
    useReferentialContext,
    useStockUIContext,
} from "../../hooks/context/StockProvider"
import { GESTION_THEME } from "@/features/stock/theme"
import { DEFAULT_BALLE_FILTERS } from "@/features/stock/types/balle.types"
import { DEFAULT_DELIVERY_FILTERS } from "@/features/stock/types/livraison.types"

export default function FilterBarStock() {
    const {
        viewMode, setViewMode,
        searchInput, setSearchInput,
        displayStyle, setDisplayStyle,
    } = useStockUIContext()

    const { balleFilters, setBalleFilters, resetBalleFilters, setBalleCreationSheetOpen } =
        useBalleContext()

    const { deliveryFilters, setDeliveryFilters, resetDeliveryFilters, setDeliveryCreationSheetOpen } =
        useDeliveryContext()

    const { categories, fournisseurs } = useReferentialContext()

    const [filtersOpen, setFiltersOpen] = useState(false)

    // Conteneurs des deux bascules de vue — offsetParent de leur pastille.
    const viewModeRef = useRef<HTMLDivElement>(null)
    const displayStyleRef = useRef<HTMLDivElement>(null)

    // Le décompte se déduit des valeurs par défaut du module, plus d'une liste
    // de clés tenue à la main : un filtre ajouté est compté sans rien toucher.
    const activeCount =
        viewMode === "balles"
            ? countActiveFilters(balleFilters, DEFAULT_BALLE_FILTERS)
            : countActiveFilters(deliveryFilters, DEFAULT_DELIVERY_FILTERS)

    return (
        <FilterBar
            theme={GESTION_THEME.filterBar}
            activeCount={activeCount}
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            leading={
                <div className="flex w-full items-stretch gap-4 sm:flex-row sm:items-center lg:w-auto">
                    <TabButtonGroup
                        containerRef={viewModeRef}
                        className={`${GESTION_THEME.filterBar.tabToggle} shrink-0`}
                    >
                        <TabButton
                            id="balles" label="Balles" title="Vue Balles" icon={Package}
                            active={viewMode} set={() => setViewMode("balles")}
                        />
                        <TabButton
                            id="livraisons" label="Livraisons" title="Vue Livraisons" icon={Truck}
                            active={viewMode} set={() => setViewMode("livraisons")}
                        />
                    </TabButtonGroup>

                    {/* Recherche posée ici et non via la prop `search` de la
                        FilterBar : elle est appariée à la bascule Balles /
                        Livraisons sur la même ligne responsive. */}
                    <div className="relative w-full lg:w-56">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Rechercher..."
                            aria-label="Rechercher une balle ou une livraison"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className={`h-9 pl-9 text-xs ${GESTION_THEME.filterBar.search}`}
                        />
                    </div>
                </div>
            }
            trailing={
                <>
                    <Separator orientation="vertical" className="hidden h-6 lg:block" />
                    <TabButtonGroup
                        containerRef={displayStyleRef}
                        className={`${GESTION_THEME.filterBar.tabToggle} shrink-0`}
                    >
                        <TabButton
                            id="grid" label="" title="Vue Grille" icon={Grid}
                            active={displayStyle} set={() => setDisplayStyle("grid")}
                        />
                        <TabButton
                            id="table" label="" title="Vue Tableau" icon={TablePropertiesIcon}
                            active={displayStyle} set={() => setDisplayStyle("table")}
                        />
                    </TabButtonGroup>
                    <Separator orientation="vertical" className="hidden h-6 lg:block" />
                </>
            }
            action={
                <Button
                    size="sm"
                    onClick={() =>
                        viewMode === "balles"
                            ? setBalleCreationSheetOpen(true)
                            : setDeliveryCreationSheetOpen(true)
                    }
                >
                    <Plus size={16} />
                    <span className="ml-2">
                        {viewMode === "balles" ? "Créer une balle" : "Créer une livraison"}
                    </span>
                </Button>
            }
        >
            {viewMode === "balles" ? (
                <BalleFiltersPanel
                    filters={balleFilters}
                    setFilters={setBalleFilters}
                    resetFilters={resetBalleFilters}
                    categories={categories}
                    fournisseurs={fournisseurs}
                    activeCount={activeCount}
                />
            ) : (
                <DeliveryFiltersPanel
                    filters={deliveryFilters}
                    setFilters={setDeliveryFilters}
                    resetFilters={resetDeliveryFilters}
                    fournisseurs={fournisseurs}
                    activeCount={activeCount}
                />
            )}
        </FilterBar>
    )
}
