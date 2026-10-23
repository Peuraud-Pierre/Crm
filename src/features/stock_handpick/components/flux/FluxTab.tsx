import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { ArrowDownToLine, ArrowUpFromLine, Plus, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/ui/atoms/select"
import { LoadMore } from "@/shared/ui/molecules/load-more"
import { TabButton, TabButtonGroup } from "@/shared/ui/molecules/tab-button-group"
import { FilterBar, countActiveFilters } from "@/shared/ui/organisms/filter-bar"
import { ExportButton } from "@/shared/ui/organisms/export-button"
import { useDetailDeepLink } from "@/shared/hooks/useDetailDeepLink"
import { useResolvedDetail } from "@/shared/hooks/useResolvedDetail"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { cn } from "@/shared/lib/utils"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import {
    FLUX_STATUS_CONFIG,
    STOCK_HANDPICK_PERMISSIONS,
} from "@/features/stock_handpick/constants"
import { HANDPICK_ROUTE_BASE } from "@/features/stock_handpick/types/ui.types"
import { useFluxHandpickContext } from "@/features/stock_handpick/hooks/context/StockHandpickProvider"
import {
    DEFAULT_FLUX_FILTERS,
    type FluxFormInput,
    type FluxHandpickRow,
    type FluxStatus,
    type MouvementDirection,
} from "@/features/stock_handpick/types/flux.types"
import { exportFlux, filterFluxByRange } from "@/features/stock_handpick/utils/fluxExport"
import { FluxTable } from "./FluxTable"
import { FluxSheet } from "./FluxSheet"
import { FluxDetailSheet } from "./FluxDetailSheet"

const FLUX_URL = `${HANDPICK_ROUTE_BASE}/flux`
const ALL = "all"

interface FluxTabProps {
    /** Segment `detail` de l'URL : `new` ou l'id d'une expédition. */
    detail?: string
}

/**
 * Onglet Flux : les expéditions, arrivages ou départs selon la bascule.
 *
 * Le module listait ici les LIGNES de colisage, si bien qu'un conteneur de 40
 * balles s'affichait comme 40 arrivages. Le tableau montre désormais une ligne
 * par expédition — colonnes, groupement par mois et alertes repris du tableau
 * des arrivages du stock principal — et le détail se consulte en ouvrant
 * l'expédition.
 *
 * Un seul tableau à la fois plutôt que les deux empilés : les deux sens
 * partagent les mêmes colonnes et la même pagination par mois, les afficher
 * ensemble obligeait à faire défiler l'un pour atteindre l'autre.
 */
export default function FluxTab({ detail }: FluxTabProps) {
    const navigate = useNavigate()
    const { hasPermission } = useAuth()
    const {
        flux,
        filteredFor,
        loading,
        hasMore,
        loadMore,
        total,
        filters,
        setFilters,
        resetFilters,
        hasActiveFilters,
        fetchById,
        createFlux,
        updateFlux,
        removeFlux,
    } = useFluxHandpickContext()

    const canView   = hasPermission(STOCK_HANDPICK_PERMISSIONS.fluxView)
    const canCreate = hasPermission(STOCK_HANDPICK_PERMISSIONS.fluxCreate)
    const canUpdate = hasPermission(STOCK_HANDPICK_PERMISSIONS.fluxUpdate)
    const canDelete = hasPermission(STOCK_HANDPICK_PERMISSIONS.fluxDelete)

    // Sens affiché. Préférence d'affichage, pas une adresse : le segment
    // `detail` de l'URL est réservé à la ressource ouverte (docs/ROUTING.md),
    // et il ne peut pas porter aussi une sous-vue.
    const [direction, setDirection] = useState<MouvementDirection>("in")
    const [filtersOpen, setFiltersOpen] = useState(false)
    const toggleRef = useRef<HTMLDivElement>(null)

    // Le tableau n'a qu'un palier en mémoire : une expédition plus ancienne,
    // visée par un lien (fiche d'une balle, notification), est lue à l'unité
    // avant que la garde ne la prenne pour un lien mort.
    const resolved = useResolvedDetail({
        detail,
        items: flux,
        loaded: !loading,
        fetchOne: fetchById,
    })

    const { creationOpen, editing, viewing } = useDetailDeepLink({
        detail,
        baseUrl: FLUX_URL,
        canCreate,
        canUpdate,
        canView,
        loaded: resolved.loaded,
        find: resolved.find,
    })

    // Lecture ou édition n'est pas une adresse mais une action : l'URL désigne
    // l'expédition ouverte, ce drapeau dit laquelle des deux fiches la montre.
    const [editingOpen, setEditingOpen] = useState(false)

    // Un lien profond (notification, favori, fiche d'une balle) peut viser une
    // expédition de l'autre sens. Sans cette resynchronisation, la fiche
    // s'ouvrirait au-dessus du tableau qui ne la contient pas, et la refermer ne
    // montrerait rien. On suit `viewing` et non `editing` : un lecteur seul
    // n'obtient jamais `editing`, et resterait devant le mauvais tableau.
    useEffect(() => {
        if (viewing && viewing.direction !== direction) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setDirection(viewing.direction)
        }
    }, [viewing, direction])

    const isArrivages = direction === "in"
    const rows = loading ? undefined : filteredFor(direction)

    const closeSheet = () => {
        setEditingOpen(false)
        navigate(FLUX_URL)
    }

    // Expédition tout juste créée, en attente de la fermeture du formulaire.
    // `FluxSheet` enchaîne `onSubmit` puis `onClose` : naviguer depuis
    // `handleSubmit` puis refermer ferait deux navigations, la seconde annulant
    // la première. Une seule a lieu, depuis `closeForm`.
    const createdRef = useRef<string | null>(null)

    /** Vrai si l'écriture a abouti : le formulaire ne se referme qu'alors. */
    const handleSubmit = async (payload: FluxFormInput): Promise<boolean> => {
        if (editingOpen && editing) {
            return updateFlux(editing.id, payload)
        }
        const created = await createFlux(payload)
        createdRef.current = created?.id ?? null
        return created !== null
    }

    /**
     * Raccourci du tableau : ouvrir une expédition DIRECTEMENT en édition, sans
     * passer par sa fiche. L'URL désigne toujours l'expédition — seul le
     * drapeau d'édition est posé d'avance, si bien que refermer le formulaire
     * ramène à la fiche comme partout ailleurs.
     */
    const openEdit = (row: FluxHandpickRow) => {
        if (!canUpdate) return
        setEditingOpen(true)
        navigate(`${FLUX_URL}/${row.id}`)
    }

    // Refermer le formulaire ramène à la FICHE, pas à la liste — sauf après une
    // création, où l'on atterrit sur la fiche de l'expédition créée : sa liste
    // de colisage est vide, et la remplir est l'étape suivante immédiate.
    const closeForm = () => {
        if (editingOpen) {
            setEditingOpen(false)
            return
        }
        const created = createdRef.current
        createdRef.current = null
        navigate(created ? `${FLUX_URL}/${created}` : FLUX_URL)
    }

    /** Compteur de la bascule : ce que le tableau montrerait, filtres compris. */
    const countBadge = (value: MouvementDirection) => {
        if (loading) return undefined
        return (
            <span className="tabular-nums text-muted-foreground">
                {filteredFor(value).length}
            </span>
        )
    }

    return (
        <div className={cn(HANDPICK_THEME.board.container, "gap-6")}>
            <FilterBar
                theme={HANDPICK_THEME.filterBar}
                activeCount={countActiveFilters(filters, DEFAULT_FLUX_FILTERS, ["search"])}
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
                leading={
                    <TabButtonGroup
                        containerRef={toggleRef}
                        className={cn(
                            HANDPICK_THEME.filterBar.tabToggle,
                            "w-full shrink-0 sm:w-fit",
                        )}
                    >
                        <TabButton
                            id="in"
                            label="Arrivages"
                            icon={ArrowDownToLine}
                            badge={countBadge("in")}
                            active={direction}
                            set={(id) => setDirection(id as MouvementDirection)}
                        />
                        <TabButton
                            id="out"
                            label="Départs"
                            icon={ArrowUpFromLine}
                            badge={countBadge("out")}
                            active={direction}
                            set={(id) => setDirection(id as MouvementDirection)}
                        />
                    </TabButtonGroup>
                }
                search={{
                    value: filters.search,
                    onChange: (value) => setFilters({ ...filters, search: value }),
                    placeholder: "N° conteneur, référence, usine…",
                    ariaLabel: "Rechercher une expédition",
                }}
                trailing={
                    <ExportButton
                        rows={rows}
                        onExport={(exported, suffix) =>
                            exportFlux(
                                exported,
                                `_${isArrivages ? "arrivages" : "departs"}${suffix}`,
                            )
                        }
                        filterByRange={filterFluxByRange}
                        rangeHint="Filtré par date de référence (déchargement → départ)"
                    />
                }
                action={
                    canCreate ? (
                        <Button
                            className="gap-2 shadow-sm"
                            onClick={() => navigate(`${FLUX_URL}/new`)}
                        >
                            <Plus size={16} />
                            {isArrivages ? "Nouvel arrivage" : "Nouveau départ"}
                        </Button>
                    ) : undefined
                }
            >
                <div className="flex min-w-max items-end gap-2">
                    <div className="flex flex-col gap-1.5">
                        <span className={HANDPICK_THEME.filterBar.panelLabel}>Statut</span>
                        <Select
                            value={filters.status}
                            onValueChange={(value) =>
                                setFilters({ ...filters, status: value as FluxStatus | "all" })
                            }
                        >
                            <SelectTrigger
                                className="h-8 w-40 text-xs"
                                aria-label="Filtrer par statut"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>Tous les statuts</SelectItem>
                                {Object.entries(FLUX_STATUS_CONFIG).map(([key, cfg]) => (
                                    <SelectItem key={key} value={key}>
                                        {cfg.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <span className={HANDPICK_THEME.filterBar.panelLabel}>Période</span>
                        <div className="flex items-center gap-2">
                            <Input
                                value={filters.dateFrom ?? ""}
                                onChange={(event) =>
                                    setFilters({ ...filters, dateFrom: event.target.value || null })
                                }
                                type="date"
                                aria-label="Début de période"
                                className="h-8 w-36 text-xs"
                            />
                            <span className="text-xs text-muted-foreground">→</span>
                            <Input
                                value={filters.dateTo ?? ""}
                                min={filters.dateFrom ?? undefined}
                                onChange={(event) =>
                                    setFilters({ ...filters, dateTo: event.target.value || null })
                                }
                                type="date"
                                aria-label="Fin de période"
                                className="h-8 w-36 text-xs"
                            />
                        </div>
                    </div>

                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                            onClick={resetFilters}
                        >
                            <X size={12} />
                            Réinitialiser
                        </Button>
                    )}
                </div>
            </FilterBar>

            <FluxTable
                // Remonte le tableau au changement de sens : sans quoi la page
                // de mois choisie sur les arrivages resterait appliquée aux
                // départs, qui n'ont pas les mêmes mois.
                key={direction}
                rows={rows}
                canUpdate={canUpdate}
                onOpen={(row) => navigate(`${FLUX_URL}/${row.id}`)}
                onEdit={openEdit}
                emptyLabel={
                    hasActiveFilters
                        ? "Aucun résultat"
                        : isArrivages
                          ? "Aucun arrivage"
                          : "Aucun départ"
                }
                emptyDescription={
                    hasActiveFilters
                        ? "Aucune expédition ne correspond aux filtres actifs."
                        : isArrivages
                          ? "Les conteneurs reçus apparaîtront dans ce tableau."
                          : "Les expéditions sortantes apparaîtront dans ce tableau."
                }
            />

            {/* Le palier suivant porte sur les DEUX sens : ils sont servis par la
                même requête, donc par la même limite. Filtres, compteurs et
                export ne voient que ce palier : on le dit, plutôt que de laisser
                croire à un résultat complet. */}
            {hasMore && (
                <div className="flex flex-col items-center gap-2">
                    {hasActiveFilters && (
                        <p className="text-xs text-muted-foreground">
                            Filtres appliqués aux {flux?.length ?? 0} expéditions chargées sur{" "}
                            {total}.
                        </p>
                    )}
                    <LoadMore
                        onClick={loadMore}
                        className={HANDPICK_THEME.board.loadMore}
                        remaining={total - (flux?.length ?? 0)}
                    />
                </div>
            )}

            <FluxDetailSheet
                open={viewing !== null && !editingOpen}
                flux={viewing}
                canCreate={canCreate}
                canDelete={canDelete}
                onClose={closeSheet}
                onEdit={editing ? () => setEditingOpen(true) : undefined}
                onOpenBalle={(id) => navigate(`${HANDPICK_ROUTE_BASE}/inventaire/${id}`)}
            />

            <FluxSheet
                open={creationOpen || (editingOpen && editing !== null)}
                flux={editingOpen ? editing : null}
                defaultDirection={editing?.direction ?? direction}
                canCreate={canCreate}
                canUpdate={canUpdate}
                canDelete={canDelete}
                onClose={closeForm}
                onSubmit={handleSubmit}
                onDelete={editingOpen && editing ? () => removeFlux(editing.id) : undefined}
            />
        </div>
    )
}
