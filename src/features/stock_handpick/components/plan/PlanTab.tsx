import { lazy, Suspense, useCallback, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { Box, Map as MapIcon, PencilRuler, Sparkles, X } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { TabButton, TabButtonGroup } from "@/shared/ui/molecules/tab-button-group"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import { HANDPICK_ROUTE_BASE } from "@/features/stock_handpick/types/ui.types"
import { STOCK_HANDPICK_PERMISSIONS } from "@/features/stock_handpick/constants"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { usePlanLayout } from "@/features/stock_handpick/hooks/data/usePlanLayout"
import { useBalleHandpickContext } from "@/features/stock_handpick/hooks/context/StockHandpickProvider"
import { usePlanHandpick } from "@/features/stock_handpick/hooks/data/usePlanHandpick"
import type { PlanSelection } from "@/features/stock_handpick/utils/planLayout"
import { selectionOfFocus } from "@/features/stock_handpick/utils/planFocus"
import { usePlanBalleFocus } from "@/features/stock_handpick/hooks/ui/usePlanBalleFocus"
import { PlanFloor } from "./PlanFloor"
import { PlanDetailPanel } from "./PlanDetailPanel"
import { PlanEditor } from "./PlanEditor"
import { PlanStructureBanner } from "./PlanStructureBanner"
import { usePlanStructureSync } from "@/features/stock_handpick/hooks/data/usePlanStructureSync"

// Chunk three.js chargé seulement si la vue 3D est ouverte.
const Plan3D = lazy(() => import("./Plan3D"))

/**
 * Onglet Plan : l'entrepôt vu de dessus, d'après le plan au tableau.
 * Cliquer une étagère ou une zone liste les balles qui y sont rangées ;
 * cliquer une balle ouvre sa fiche dans l'Inventaire.
 *
 * Deux vues des mêmes données : le plan 2D, et une vue 3D modelée d'après les
 * photos du site. La sélection est partagée entre les deux.
 *
 * La disposition (racks, meubles, bureaux, portes…) vient de la base et se
 * modifie depuis l'éditeur, réservé à `stock_handpick.plan.update`.
 *
 * Sélection, vue et mode édition sont des états d'affichage, pas des
 * adresses : ils ne vont pas dans l'URL (docs/ROUTING.md réserve l'URL aux
 * fiches). Seules exceptions, adressables et partageables : `plan/<id>` fait
 * briller une balle dans la vue 3D (« Voir dans le plan 3D » de sa fiche),
 * `plan/emp-<id>` un emplacement (« Voir dans le plan » de l'onglet Codes).
 */
export default function PlanTab({ detail }: { detail?: string }) {
    const navigate = useNavigate()
    // Le palier de l'inventaire change à chaque événement realtime : il sert de
    // signal pour recharger le plan.
    const { balles, refetchPlan } = useBalleHandpickContext()
    const {
        index, ballesIn, pathFor, loading, isEmpty,
        zones, emplacements, planLoading, fetchPlan,
    } = usePlanHandpick(balles)
    const [selection, setSelection] = useState<PlanSelection | null>(null)
    const [view, setView] = useState<"2d" | "3d">("2d")
    const viewToggleRef = useRef<HTMLDivElement>(null)
    const { hasPermission } = useAuth()
    const canEdit = hasPermission(STOCK_HANDPICK_PERMISSIONS.planUpdate)
    const { layout, loading: layoutLoading, saving, save } = usePlanLayout()
    const [editing, setEditing] = useState(false)

    // Balle ciblée par l'URL : impose la vue 3D et sélectionne sa travée tant
    // que l'utilisateur n'a rien choisi d'autre.
    const target = usePlanBalleFocus(detail)
    const focus = target.focus
    const shownView = focus ? "3d" : view
    const shownSelection = selection ?? (focus ? selectionOfFocus(focus) : null)
    const clearFocus = () => navigate(`${HANDPICK_ROUTE_BASE}/plan`)

    // Liaison plan ↔ base : crée les rangées, travées et hauteurs que le plan
    // attend et que la base n'a pas encore. Les deux copies de l'arbre (plan
    // et inventaire) sont rechargées ensuite.
    const reloadPlan = useCallback(async () => {
        await Promise.all([fetchPlan(), refetchPlan()])
    }, [fetchPlan, refetchPlan])
    const structure = usePlanStructureSync({
        zones,
        emplacements,
        loading: planLoading || layoutLoading,
        layout,
        onSynced: reloadPlan,
    })
    const banner = (
        <PlanStructureBanner
            missing={structure.missing}
            syncing={structure.syncing}
            failed={structure.failed}
            allowed={structure.allowed}
            onRetry={() => void structure.retry()}
        />
    )

    if (loading || layoutLoading) {
        return (
            <div className={HANDPICK_THEME.board.container}>
                <Skeleton aria-hidden className="h-96 w-full rounded-2xl" />
            </div>
        )
    }

    if (isEmpty) {
        return (
            <div className={HANDPICK_THEME.board.container}>
                {banner}
                <EmptyState
                    icon={MapIcon}
                    title="Plan non configuré"
                    description="Les zones A, B et D et leurs emplacements n'existent pas encore en base. Ils sont créés automatiquement pour un compte ayant le droit « plan.create » ; sinon, exécutez les migrations du plan."
                    className={HANDPICK_THEME.board.emptyState}
                />
            </div>
        )
    }

    if (editing) {
        return (
            <div className={HANDPICK_THEME.board.container}>
                <div>
                    <h2 className={HANDPICK_THEME.section.groupTitle}>Modifier le plan</h2>
                    <p className="text-xs text-muted-foreground">
                        Ajoutez, déplacez, redimensionnez ou retirez les éléments, puis enregistrez.
                    </p>
                </div>
                <PlanEditor
                    initial={layout}
                    saving={saving}
                    onSave={async (next) => {
                        if (await save(next)) setEditing(false)
                    }}
                    onCancel={() => setEditing(false)}
                    index={index}
                    ballesIn={ballesIn}
                />
            </div>
        )
    }

    return (
        <div className={HANDPICK_THEME.board.container}>
            {banner}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className={HANDPICK_THEME.section.groupTitle}>Plan de l'entrepôt</h2>
                    <p className="text-xs text-muted-foreground">
                        Cliquez une travée ou une zone pour voir ses balles
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {canEdit && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => {
                                setSelection(null)
                                setEditing(true)
                            }}
                        >
                            <PencilRuler size={14} aria-hidden />
                            Modifier le plan
                        </Button>
                    )}
                    <TabButtonGroup
                        containerRef={viewToggleRef}
                        className={`${HANDPICK_THEME.filterBar.tabToggle} shrink-0`}
                    >
                        <TabButton
                            id="2d" title="Vue 2D" icon={MapIcon}
                            active={shownView}
                            set={() => {
                                if (focus) clearFocus()
                                setView("2d")
                            }}
                        />
                        <TabButton
                            id="3d" title="Vue 3D" icon={Box}
                            active={shownView} set={() => setView("3d")}
                        />
                    </TabButtonGroup>
                </div>
            </div>

            {focus && (
                <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
                    <Sparkles size={14} className="shrink-0 text-warning" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">
                        <span className="font-semibold">{target.label}</span> est surlignée dans le plan 3D
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={clearFocus}
                        aria-label="Ne plus surligner la balle"
                    >
                        <X size={14} aria-hidden />
                    </Button>
                </div>
            )}
            {detail && target.resolved && !focus && (
                <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    Cette balle n'est rangée dans aucun emplacement du plan : rien à surligner.
                </p>
            )}

            {shownView === "3d" ? (
                <Suspense fallback={<Skeleton aria-hidden className="aspect-video w-full rounded-2xl" />}>
                    <Plan3D
                        floor={layout}
                        index={index}
                        ballesIn={ballesIn}
                        selection={shownSelection}
                        onSelect={setSelection}
                        focus={focus}
                        focusLabel={target.label}
                    />
                </Suspense>
            ) : (
                <PlanFloor
                    floor={layout}
                    index={index}
                    ballesIn={ballesIn}
                    selection={selection}
                    onSelect={setSelection}
                />
            )}

            {shownSelection && (
                <PlanDetailPanel
                    selection={shownSelection}
                    index={index}
                    ballesIn={ballesIn}
                    pathFor={pathFor}
                    onClose={() => {
                        setSelection(null)
                        if (focus) clearFocus()
                    }}
                    onOpenBalle={(id) => navigate(`${HANDPICK_ROUTE_BASE}/inventaire/${id}`)}
                />
            )}
        </div>
    )
}
