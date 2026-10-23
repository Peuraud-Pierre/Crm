import { useRef, useState } from "react"
import { useNavigate } from "react-router"
import { Boxes, CheckSquare, Grid, Plus, TablePropertiesIcon, Warehouse } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { TabButton, TabButtonGroup } from "@/shared/ui/molecules/tab-button-group"
import { LoadMore } from "@/shared/ui/molecules/load-more"
import { useDetailDeepLink } from "@/shared/hooks/useDetailDeepLink"
import { useResolvedDetail } from "@/shared/hooks/useResolvedDetail"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import { STOCK_HANDPICK_PERMISSIONS } from "@/features/stock_handpick/constants"
import { HANDPICK_ROUTE_BASE } from "@/features/stock_handpick/types/ui.types"
import { useBalleHandpickContext } from "@/features/stock_handpick/hooks/context/StockHandpickProvider"
import type { BalleHandpickFormInput } from "@/features/stock_handpick/types/balle.types"
import { BalleCard } from "./balle/BalleCard"
import { BalleFilterBar } from "./balle/BalleFilterBar"
import { BalleTable } from "./balle/BalleTable"
import { BalleSheet } from "./balle/BalleSheet"
import { BalleDetailSheet } from "./balle/BalleDetailSheet"
import { BalleByPlace } from "./balle/BalleByPlace"
import { BalleMoveDialog } from "./balle/BalleMoveDialog"
import { BalleSelectionBar } from "./balle/BalleSelectionBar"
import { selectionStateOf, useBalleSelection } from "@/features/stock_handpick/hooks/ui/useBalleSelection"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"
import { PlanStructureBanner } from "../plan/PlanStructureBanner"
import { usePlanLayout } from "@/features/stock_handpick/hooks/data/usePlanLayout"
import { usePlanStructureSync } from "@/features/stock_handpick/hooks/data/usePlanStructureSync"

const INVENTAIRE_URL = `${HANDPICK_ROUTE_BASE}/inventaire`
const SKELETON_KEYS = ["sk1", "sk2", "sk3", "sk4", "sk5", "sk6", "sk7", "sk8"]

interface InventaireTabProps {
    /** Segment `detail` de l'URL : `new` ou l'id d'une balle. */
    detail?: string
}

export default function InventaireTab({ detail }: InventaireTabProps) {
    const navigate = useNavigate()
    const { hasPermission } = useAuth()
    const {
        balles,
        filteredBalles,
        total,
        loading,
        hasMore,
        loadMore,
        hasActiveFilters,
        resetFilters,
        emplacementPath,
        emplacementSegments,
        filters,
        setFilters,
        planZones,
        planEmplacements,
        planLoading,
        refetchPlan,
        fetchById,
        createBalles,
        updateBalle,
        removeBalle,
        moveBalles,
    } = useBalleHandpickContext()

    // L'ouverture du panneau de filtres vit ici et non dans la barre : elle
    // doit survivre à un re-rendu de celle-ci.
    const [filtersOpen, setFiltersOpen] = useState(false)
    // Par emplacement, grille ou tableau — préférence d'affichage, pas une
    // adresse : elle ne va pas dans l'URL, contrairement à l'onglet et au
    // détail. Par défaut, l'inventaire se lit comme l'entrepôt.
    const [displayStyle, setDisplayStyle] = useState<"place" | "grid" | "table">("place")
    const displayStyleRef = useRef<HTMLDivElement>(null)

    // Liaison plan ↔ base : les rangées du plan doivent exister pour que
    // l'inventaire puisse y ranger des balles (voir usePlanStructureSync).
    const { layout, loading: layoutLoading } = usePlanLayout()
    const structure = usePlanStructureSync({
        zones: planZones,
        emplacements: planEmplacements,
        loading: planLoading || layoutLoading,
        layout,
        onSynced: refetchPlan,
    })

    const canView = hasPermission(STOCK_HANDPICK_PERMISSIONS.inventaireView)
    const canCreate = hasPermission(STOCK_HANDPICK_PERMISSIONS.inventaireCreate)
    const canUpdate = hasPermission(STOCK_HANDPICK_PERMISSIONS.inventaireUpdate)
    const canDelete = hasPermission(STOCK_HANDPICK_PERMISSIONS.inventaireDelete)

    // L'inventaire n'a qu'un palier en mémoire : une balle plus ancienne, visée
    // par un lien (ligne de colisage, notification), est lue à l'unité avant
    // que la garde ne la prenne pour un lien mort.
    const resolved = useResolvedDetail({
        detail,
        items: balles,
        loaded: !loading,
        fetchOne: fetchById,
    })

    // Garde des liens profonds : partagée avec le stock principal. La sheet est
    // DÉRIVÉE de l'URL, jamais d'un useState (docs/ROUTING.md) — l'écran reste
    // partageable et le bouton retour la referme.
    const { creationOpen, editing: editBalle, viewing } = useDetailDeepLink({
        detail,
        baseUrl: INVENTAIRE_URL,
        canCreate,
        canUpdate,
        canView,
        loaded: resolved.loaded,
        find: resolved.find,
    })

    // L'URL adresse la FICHE ; passer en édition est une action, pas une
    // adresse — la route n'a que deux segments et un onglet ne doit jamais
    // canonicaliser lui-même (docs/ROUTING.md).
    const [editingOpen, setEditingOpen] = useState(false)

    // Mode sélection : un clic coche la balle au lieu d'ouvrir sa fiche.
    const selection = useBalleSelection()
    const selectedIds = selection.active ? selection.selected : undefined
    const [moveOpen, setMoveOpen] = useState(false)
    const openBalle = (balle: BalleHandpick) =>
        selection.active ? selection.toggle(balle) : navigate(`${INVENTAIRE_URL}/${balle.id}`)

    const closeSheet = () => {
        setEditingOpen(false)
        navigate(INVENTAIRE_URL)
    }

    // Refermer le FORMULAIRE d'une balle existante ramène à sa fiche, pas à la
    // liste : l'URL n'a pas bougé pendant l'édition. Une création, elle, n'a pas
    // de fiche où revenir.
    const closeForm = () => {
        if (creationOpen) closeSheet()
        else setEditingOpen(false)
    }

    /** Vrai si l'écriture a abouti : le formulaire ne se referme qu'alors. */
    // L'édition n'écrit jamais l'emplacement : il ne bouge que par les
    // actions dédiées (emprunt, retour, déplacement), sinon le brouillon
    // réécrirait un emplacement périmé sur une balle empruntée ou éclatée.
    const handleSubmit = async (draft: BalleHandpickFormInput): Promise<boolean> => {
        if (!editBalle) return false
        const payload: Partial<BalleHandpickFormInput> = { ...draft }
        delete payload.emplacement_id
        delete payload.location
        return updateBalle(editBalle.id, payload)
    }

    if (loading) {
        return (
            <div className={HANDPICK_THEME.board.container}>
                <Skeleton aria-hidden className="h-28 w-full rounded-lg" />
                <div className={HANDPICK_THEME.board.grid}>
                    {SKELETON_KEYS.map((key) => (
                        <Skeleton key={key} aria-hidden className="aspect-square w-full rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className={HANDPICK_THEME.board.container}>
            <PlanStructureBanner
                missing={structure.missing}
                syncing={structure.syncing}
                failed={structure.failed}
                allowed={structure.allowed}
                onRetry={() => void structure.retry()}
            />

            <BalleFilterBar
                open={filtersOpen}
                onOpenChange={setFiltersOpen}
                action={
                    canCreate || canUpdate ? (
                        <div className="flex gap-2">
                            {canUpdate && (
                                <Button
                                    variant={selection.active ? "default" : "outline"}
                                    aria-pressed={selection.active}
                                    className="gap-2"
                                    onClick={selection.active ? selection.stop : selection.start}
                                >
                                    <CheckSquare size={16} />
                                    Sélectionner
                                </Button>
                            )}
                            {canCreate && (
                                <Button
                                    className="gap-2 shadow-sm"
                                    onClick={() => navigate(`${INVENTAIRE_URL}/new`)}
                                >
                                    <Plus size={16} />
                                    Nouvelle balle
                                </Button>
                            )}
                        </div>
                    ) : undefined
                }
                displayToggle={
                    <TabButtonGroup
                        containerRef={displayStyleRef}
                        className={`${HANDPICK_THEME.filterBar.tabToggle} shrink-0`}
                    >
                        <TabButton
                            id="place" title="Par emplacement" icon={Warehouse}
                            active={displayStyle} set={() => setDisplayStyle("place")}
                        />
                        <TabButton
                            id="grid" title="Vue Grille" icon={Grid}
                            active={displayStyle} set={() => setDisplayStyle("grid")}
                        />
                        <TabButton
                            id="table" title="Vue Tableau" icon={TablePropertiesIcon}
                            active={displayStyle} set={() => setDisplayStyle("table")}
                        />
                    </TabButtonGroup>
                }
            />

            {filteredBalles.length === 0 ? (
                <EmptyState
                    icon={Boxes}
                    variant={hasActiveFilters ? "search" : "default"}
                    title={hasActiveFilters ? "Aucun résultat" : "Inventaire vide"}
                    description={
                        hasActiveFilters
                            ? hasMore
                                ? "Aucune balle chargée ne correspond aux filtres actifs. Les balles plus anciennes n'ont pas encore été chargées."
                                : "Aucune balle ne correspond aux filtres actifs."
                            : "Créez une première balle, après avoir renseigné vos usines et catégories dans les Paramètres."
                    }
                    action={
                        hasActiveFilters
                            ? { label: "Réinitialiser les filtres", onClick: resetFilters }
                            : canCreate
                              ? {
                                    label: "Nouvelle balle",
                                    onClick: () => navigate(`${INVENTAIRE_URL}/new`),
                                    icon: Plus,
                                }
                              : undefined
                    }
                    className={HANDPICK_THEME.board.emptyState}
                />
            ) : displayStyle === "place" ? (
                <BalleByPlace
                    balles={filteredBalles}
                    allBalles={balles}
                    emplacementPath={emplacementPath}
                    segmentsFor={emplacementSegments}
                    place={filters.place}
                    onPlaceChange={(place) => setFilters({ ...filters, place })}
                    onOpen={openBalle}
                    selectedIds={selectedIds}
                />
            ) : (
                <>
                    {displayStyle === "table" && (
                        <BalleTable
                            balles={filteredBalles}
                            emplacementPath={emplacementPath}
                            onRowClick={openBalle}
                            selectedIds={selectedIds}
                        />
                    )}

                    {/* La grille reste rendue sous `md` même en vue tableau :
                        une table à huit colonnes n'y est pas lisible. */}
                    <div
                        className={
                            displayStyle === "table"
                                ? HANDPICK_THEME.board.cardList
                                : HANDPICK_THEME.board.grid
                        }
                    >
                        {filteredBalles.map((balle) => (
                            <BalleCard
                                key={balle.id}
                                balle={balle}
                                emplacementPath={emplacementPath(balle.emplacement_id)}
                                onClick={() => openBalle(balle)}
                                selection={selectionStateOf(selectedIds, balle)}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Le palier suivant reste proposé même quand le filtre ne trouve
                rien : filtres et recherche ne portent que sur les balles
                chargées, et la balle cherchée peut être plus ancienne. Le
                masquer rendait « Aucun résultat » définitif. */}
            {hasMore && (
                <LoadMore
                    onClick={loadMore}
                    className={HANDPICK_THEME.board.loadMore}
                    remaining={total - balles.length}
                />
            )}

            {selection.active && (
                <>
                    {/* Réserve la hauteur de la barre fixe : la dernière
                        rangée de balles ne passe pas dessous. */}
                    <div aria-hidden className="h-20" />
                    <BalleSelectionBar
                        count={selection.selected.size}
                        onMove={() => setMoveOpen(true)}
                        onClear={selection.clear}
                        onDone={selection.stop}
                    />
                </>
            )}

            <BalleMoveDialog
                open={moveOpen}
                count={selection.selected.size}
                onClose={() => setMoveOpen(false)}
                onConfirm={async (emplacementId) => {
                    const ok = await moveBalles([...selection.selected], emplacementId)
                    if (ok) selection.clear()
                    return ok
                }}
            />

            <BalleDetailSheet
                open={viewing !== null && !editingOpen}
                balle={viewing}
                emplacementPath={emplacementPath}
                onClose={closeSheet}
                onEdit={editBalle ? () => setEditingOpen(true) : undefined}
                canBorrow={canUpdate}
                onLocate={(id) => navigate(`${HANDPICK_ROUTE_BASE}/plan/${id}`)}
            />

            <BalleSheet
                open={creationOpen || (editingOpen && editBalle !== null)}
                balle={editingOpen ? editBalle : null}
                canDelete={canDelete}
                onClose={closeForm}
                onSubmit={handleSubmit}
                onCreateMany={createBalles}
                onDelete={editBalle ? () => removeBalle(editBalle.id) : undefined}
            />
        </div>
    )
}
