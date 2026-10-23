import { lazy, Suspense, useMemo, useRef, useState } from "react"
import { Box, Map as MapIcon, PencilRuler, Plus, Trash2 } from "lucide-react"
import { Button } from "@/shared/ui/atoms/button"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { TabButton, TabButtonGroup } from "@/shared/ui/molecules/tab-button-group"
import { MAGASIN_THEME } from "@/features/magasins/theme"
import type { PlanMagasinApi } from "@/features/magasins/hooks/data/usePlanMagasin"
import type { FondApi } from "@/features/magasins/hooks/data/useFond"
import { usePlanEditor } from "@/features/magasins/hooks/ui/usePlanEditor"
import type { Etage, EquipementKind, Magasin, Point } from "@/features/magasins/types/magasin.types"
import { effectiveContour, isRectContour } from "@/features/magasins/utils/contour"
import {
    containingZone,
    drawnKind,
    geometryOf,
    initialRect,
    rectOf,
    type Rect,
} from "@/features/magasins/utils/planGeometry"
import { equipementKey } from "@/features/magasins/utils/planTree"
import { PlanSvg, type PlanSvgContext } from "./PlanSvg"
import { PlanItemPanel } from "./PlanItemPanel"
import { FondPanel } from "./FondPanel"
import { EquipementLegend } from "./EquipementLegend"
import { PlanEditToolbar, type PlanEditTool } from "./PlanEditToolbar"
import { PlanToolHints } from "./PlanToolHints"
import { PlanItemDelete } from "./PlanItemDelete"
import { usePlanDeletion } from "@/features/magasins/hooks/ui/usePlanDeletion"
import { isMurKey, murIdOf, murKey } from "@/features/magasins/utils/wall"
import { PlanToolLayer } from "./PlanToolLayer"
import { WallPanel } from "./WallPanel"
import { UnplacedPalette } from "./UnplacedPalette"
import { shapeFromPoints } from "@/features/magasins/utils/shape"
import { usePointEditing } from "@/features/magasins/hooks/ui/usePointEditing"
import { useStairsMerge } from "@/features/magasins/hooks/ui/useStairsMerge"
import { groupRects } from "@/features/magasins/utils/group"
import { ZoneFormSheet, type ZoneFormTarget } from "../emplacements/ZoneFormSheet"

// Chunk three.js chargé seulement si la vue 3D est ouverte.
const Plan3D = lazy(() => import("./Plan3D"))

interface PlanTabProps {
    magasin: Magasin
    /** Étage affiché ; `null` le temps du chargement. */
    etage: Etage | null
    /** Nouveau contour de l'étage ; `null` = le rectangle du magasin. */
    onContourChange: (contour: Point[] | null) => void
    plan: PlanMagasinApi
    canEdit: boolean
    /** Ajouter / supprimer des caisses et des portes. */
    canCreate: boolean
    canDelete: boolean
    /** Mène à l'onglet Emplacements, où se créent zones et emplacements. */
    onManageEmplacements: () => void
    /** Plan importé à décalquer (vignette sur le côté, fond à la demande). */
    fond: FondApi
    showFond: boolean
    onToggleFond: () => void
}


/**
 * Onglet Plan : le magasin vu de dessus (2D) ou en volume (3D). La sélection
 * est partagée entre les deux vues. L'éditeur, réservé à `magasin.update`,
 * place les zones et emplacements créés dans l'onglet Emplacements.
 */
export function PlanTab({
    magasin,
    etage,
    onContourChange,
    plan,
    canEdit,
    canCreate,
    canDelete,
    onManageEmplacements,
    fond,
    showFond,
    onToggleFond,
}: PlanTabProps) {
    // Stable : la vue 3D reconstruit ses volumes quand l'emprise change.
    const bounds = useMemo(
        () => ({ width: magasin.largeur, depth: magasin.profondeur }),
        [magasin.largeur, magasin.profondeur],
    )
    const [view, setView] = useState<"2d" | "3d">("2d")
    const [selectedKey, setSelectedKey] = useState<string | null>(null)
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const viewToggleRef = useRef<HTMLDivElement>(null)
    const editor = usePlanEditor(plan.items, bounds)
    // Outil actif du mode édition — un seul à la fois.
    const [tool, setTool] = useState<PlanEditTool>(null)
    // Rectangle dessiné ou forme tracée, en attente du formulaire de zone.
    const [drawn, setDrawn] = useState<{ target: ZoneFormTarget; rect: Rect; forme: Point[] | null; key: number } | null>(
        null,
    )
    // Calage du plan importé à la souris ; exclusif avec les outils.
    const [adjustingFond, setAdjustingFond] = useState(false)
    const contour = etage?.contour ?? null
    const adjusting = adjustingFond && showFond && canEdit && fond.hasFond

    const shown = editing ? editor.drafted : plan.items
    const selected = shown.find((i) => i.key === selectedKey) ?? null
    const selectedWall = isMurKey(selectedKey) ? (plan.murs.find((m) => m.id === murIdOf(selectedKey)) ?? null) : null
    // Angles d'un objet, points d'un mur : retouchés sur le plan.
    const points = usePointEditing({ editing, tool, selected, selectedWall, plan, discard: editor.discard })
    // Suppression de la sélection (élément ou mur) : bouton sous le plan, ou
    // touche Suppr — sauf pendant un tracé, qui se sert de Retour arrière.
    const deletion = usePlanDeletion(selectedKey, shown, plan, {
        enabled: canDelete,
        shortcut: tool !== "sketch" && tool !== "wall" && tool !== "wallLine",
    })
    // Fusion d'escaliers : la fiche lance le choix, le clic suivant le termine.
    const merge = useStairsMerge(plan, shown, setSelectedKey)

    if (plan.loading) return <Skeleton aria-hidden className="aspect-video w-full rounded-2xl" />

    // Sans droit d'édition, rien à faire d'un plan vide. Avec, on garde
    // l'écran : fond à décalquer et outil de dessin y sont accessibles.
    if (plan.items.length === 0 && !editing && !canEdit) {
        return (
            <EmptyState
                icon={MapIcon}
                title="Plan vide"
                description="Ce magasin n'a pas encore de plan. Les zones, rayons et emplacements se créent dans l'onglet Emplacements."
                action={{ label: "Voir les emplacements", onClick: onManageEmplacements, icon: Plus }}
                className={MAGASIN_THEME.board.emptyState}
            />
        )
    }

    const unplaced = shown.filter((i) => !rectOf(i.geometry))

    // Suppression de la sélection : sous le plan, à droite.
    const deleteAction = deletion.target ? (
        <Button variant="outline" size="sm" className="text-destructive" onClick={deletion.request}>
            <Trash2 size={14} /> Supprimer {deletion.target.name}
        </Button>
    ) : null

    const stopEditing = () => {
        editor.reset()
        merge.cancel()
        setTool(null)
        setEditing(false)
    }

    // Rectangle dessiné ou forme tracée : le formulaire propose le niveau
    // selon l'endroit (zone dans le vide, rayon dans une zone, portant dans un rayon).
    const askZone = (rect: Rect, forme: Point[] | null) => {
        const parent = containingZone(rect, shown)
        setDrawn({
            rect,
            forme,
            key: Date.now(),
            target: { zone: null, defaults: { kind: drawnKind(parent), parent_id: parent?.id ?? null } },
        })
    }

    // Forme libre sélectionnée hors outil : ses points se retouchent sur le plan.
    const contourPoints = effectiveContour(contour, bounds)
    const overlay = (context: PlanSvgContext) => (
        <PlanToolLayer
            context={context}
            tool={tool}
            bounds={bounds}
            contourPoints={contourPoints}
            onContourChange={(points) => onContourChange(isRectContour(points, bounds) ? null : points)}
            onSketch={(points) => {
                const { rect, forme } = shapeFromPoints(points)
                askZone(rect, forme)
            }}
            onWall={async (points) => {
                const created = await plan.createMur(points)
                if (created) setSelectedKey(murKey(created.id))
            }}
            shapeEdit={points.shapeEdit}
            wallEdit={points.wallEdit}
        />
    )

    // Un équipement est enregistré dès son ajout, posé au centre du magasin :
    // il se déplace ensuite comme le reste, et part avec « Enregistrer ».
    const addEquipement = async (kind: EquipementKind) => {
        const created = await plan.createEquipement(kind, geometryOf(initialRect(kind, bounds), 0))
        if (created) setSelectedKey(equipementKey(created.id))
    }

    const save = async () => {
        setSaving(true)
        const ok = await plan.saveGeometries(editor.changes)
        setSaving(false)
        if (ok) stopEditing()
    }

    return (
        <div className={MAGASIN_THEME.board.container}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className={MAGASIN_THEME.section.groupTitle}>
                        {editing ? "Modifier le plan" : "Plan du magasin"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        {editing
                            ? "Glissez pour déplacer, tirez la poignée pour redimensionner, puis enregistrez."
                            : `${magasin.largeur.toLocaleString("fr-FR")} × ${magasin.profondeur.toLocaleString("fr-FR")} m — cliquez un élément pour le détail`}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {editing ? (
                        <PlanEditToolbar
                            canCreate={canCreate}
                            saving={saving}
                            changes={editor.changes.length}
                            tool={tool}
                            onToolChange={(next) => {
                                setAdjustingFond(false)
                                setTool(next)
                            }}
                            onAddEquipement={(kind) => void addEquipement(kind)}
                            onCancel={stopEditing}
                            onSave={() => void save()}
                            wallsUnavailable={plan.mursUnavailable}
                        />
                    ) : (
                        <>
                            {canEdit && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setView("2d")
                                        setEditing(true)
                                    }}
                                >
                                    <PencilRuler size={14} /> Modifier le plan
                                </Button>
                            )}
                            <TabButtonGroup containerRef={viewToggleRef} className={`${MAGASIN_THEME.viewToggle} shrink-0`}>
                                <TabButton id="2d" title="Vue 2D" icon={MapIcon} active={view} set={() => setView("2d")} />
                                <TabButton id="3d" title="Vue 3D" icon={Box} active={view} set={() => setView("3d")} />
                            </TabButtonGroup>
                        </>
                    )}
                </div>
            </div>

            {plan.items.length === 0 && !editing && (
                <p className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                    Plan vide. Importez le plan du magasin (à droite) et mettez-le en fond, puis « Modifier le plan » et
                    « Dessiner une zone » pour le décalquer — ou créez les zones dans l'onglet{" "}
                    <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={onManageEmplacements}>
                        Emplacements
                    </button>
                    .
                </p>
            )}

            {editing && (
                <PlanToolHints
                    tool={tool}
                    contourPoints={contourPoints}
                    hasContour={Boolean(contour)}
                    onResetContour={() => onContourChange(null)}
                    shapeItem={points.shapeItem}
                    mergingFrom={merge.from}
                />
            )}

            {editing && (
                <UnplacedPalette
                    items={unplaced}
                    onPlace={(item) => {
                        editor.place(item)
                        setSelectedKey(item.key)
                    }}
                />
            )}

            {/* Le plan, et sur le côté la vignette du plan importé (en dessous sur mobile). */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                    {view === "3d" && !editing ? (
                        <Suspense fallback={<Skeleton aria-hidden className="aspect-video w-full rounded-2xl" />}>
                            <Plan3D bounds={bounds} contour={contour} items={shown} walls={plan.murs} selectedKey={selectedKey} onSelect={setSelectedKey} />
                            {deleteAction && <div className="mt-2 flex justify-end">{deleteAction}</div>}
                        </Suspense>
                    ) : (
                        <PlanSvg
                            bounds={bounds}
                            items={shown}
                            selectedKey={selectedKey}
                            onSelect={(key) => merge.pick(key) || setSelectedKey(key)}
                            editing={editing}
                            // Une volée d'escalier fusionnée emporte les autres quand on la déplace.
                            onRectChange={(item, rect) =>
                                groupRects(item, rect, shown, bounds).forEach((c) => editor.setRect(c.item, c.rect))
                            }
                            onRotationChange={editor.setRotation}
                            contour={contour}
                            itemsInert={editing && (tool === "contour" || tool === "sketch" || tool === "wall" || tool === "wallLine")}
                            overlay={editing ? overlay : undefined}
                            background={showFond ? fond.layer : null}
                            adjustingBackground={adjusting}
                            onBackgroundChange={(r) =>
                                void fond.setCalage({ fond_x: r.x, fond_y: r.y, fond_largeur: r.w, fond_profondeur: r.h })
                            }
                            drawing={editing && tool === "draw" && !adjusting}
                            onDraw={(rect) => askZone(rect, null)}
                            actions={deleteAction}
                            walls={plan.murs}
                            handlesHiddenKey={points.shapeItem?.key ?? null}
                        />
                    )}
                </div>
                {etage && (fond.hasFond || canEdit) && (
                    <aside className="w-full shrink-0 lg:w-64">
                        <FondPanel
                            etage={etage}
                            bounds={bounds}
                            fond={fond}
                            canEdit={canEdit}
                            visible={showFond}
                            onToggleVisible={onToggleFond}
                            adjusting={adjusting}
                            onToggleAdjust={() => {
                                // Le calage se fait sur la vue 2D, sans outil de dessin actif.
                                setView("2d")
                                setTool(null)
                                setAdjustingFond((on) => !on)
                            }}
                        />
                    </aside>
                )}
            </div>

            <EquipementLegend />

            {selected && (
                <PlanItemPanel
                    item={selected}
                    bounds={bounds}
                    onClose={() => setSelectedKey(null)}
                    onRectChange={editing ? (rect) => editor.setRect(selected, rect) : undefined}
                    onRotate={editing ? (delta) => editor.rotate(selected, delta) : undefined}
                    corners={editing ? points.corners : null}
                    stairs={editing ? merge.controlsFor(selected) : null}
                    // Un mannequin se rattache à une zone, comme un portant.
                    zoneLink={
                        canEdit && selected.kind === "mannequin"
                            ? {
                                  value: plan.items.find((i) => i.key === selected.parentKey)?.id ?? null,
                                  options: plan.items.filter((i) => i.type === "zone").map((z) => ({ id: z.id, path: z.path })),
                                  onChange: (zoneId) => void plan.linkEquipementZone(selected.id, zoneId),
                              }
                            : null
                    }
                />
            )}

            {selectedWall && (
                <WallPanel
                    mur={selectedWall}
                    canEdit={canEdit}
                    onChange={(patch) => void plan.updateMur(selectedWall.id, patch)}
                    onClose={() => setSelectedKey(null)}
                />
            )}

            <PlanItemDelete
                target={deletion.pending}
                onClose={deletion.clear}
                onDeleted={(target) => {
                    deletion.clear()
                    setSelectedKey(null)
                    editor.discard(target.key)
                }}
            />

            {drawn && (
                <ZoneFormSheet
                    key={drawn.key}
                    target={drawn.target}
                    zones={plan.zones}
                    onClose={() => setDrawn(null)}
                    onSubmit={async (input) =>
                        (await plan.createZone({ ...input, ...geometryOf(drawn.rect, 0), forme: drawn.forme })) !== null
                    }
                    emplacementCount={0}
                />
            )}
        </div>
    )
}
