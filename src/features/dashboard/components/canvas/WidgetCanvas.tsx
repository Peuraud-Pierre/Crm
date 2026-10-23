import { useMemo, useRef } from "react"
import { DndContext } from "@dnd-kit/core"
import type { WidgetSettingValue } from "@/shared/types/widget.types"
import { cn } from "@/shared/lib/utils"
import { EDIT_MIN_WIDTH } from "../../constants"
import { canvasHeight, columnWidth, rectStyle } from "../../layout/geometry"
import { contentRows, type Rect } from "../../layout/gridEngine"
import type { LayoutItem } from "../../types/layout.types"
import { useCanvasGestures } from "../../hooks/useCanvasGestures"
import { getWidget } from "../../widgets/registry"
import { rectOf } from "../../widgets/resolveLayout"
import { GridGuides } from "./GridGuides"
import { StackedCanvas } from "./StackedCanvas"
import { WidgetCard } from "./WidgetCard"

interface Props {
    items: LayoutItem[]
    width: number
    editing: boolean
    compact: boolean
    onPlace: (instanceId: string, rect: Rect) => void
    onRemove: (instanceId: string) => void
    onDuplicate: (instanceId: string) => void
    onOpenSettings: (instanceId: string) => void
    onSettingsChange: (
        instanceId: string,
        patch: Record<string, WidgetSettingValue>
    ) => void
}

/**
 * Le canevas : douze colonnes, placement libre, poussée vers le bas.
 *
 * Les modules sont positionnés en absolu plutôt que par une grille CSS.
 * Une grille CSS ne sait pas placer deux éléments à des coordonnées
 * arbitraires sans passer par `grid-area`, et surtout ne sait pas animer
 * un replacement : c'est le positionnement absolu qui permet aux voisins
 * de glisser à leur nouvelle place pendant qu'on déplace le premier.
 *
 * Ce composant ne fait plus que **rendre**. Le pilotage des gestes vit
 * dans `hooks/useCanvasGestures`, et l'empilement sous le point de
 * rupture dans `StackedCanvas` : trois choses qui changent pour des
 * raisons différentes, et qui tenaient auparavant dans un seul fichier
 * bien au-delà du seuil de 400 lignes du projet.
 *
 * Pendant un geste, la disposition affichée est un aperçu calculé par le
 * moteur. Elle n'est enregistrée qu'au relâchement.
 */
export function WidgetCanvas({
    items,
    width,
    editing,
    compact,
    onPlace,
    onRemove,
    onDuplicate,
    onOpenSettings,
    onSettingsChange,
}: Props) {
    const canvasRef = useRef<HTMLDivElement | null>(null)
    const colWidth = columnWidth(width)

    const {
        gesture,
        settled,
        rendered,
        sensors,
        restrictToCanvas,
        accessibility,
        handleDragStart,
        handleDragMove,
        endGesture,
        cancelGesture,
        moveResize,
        startResize,
        stepResize,
    } = useCanvasGestures({ items, colWidth, canvasRef, onPlace })

    /**
     * Hauteur **enregistrée** de chaque module, par identifiant.
     *
     * Pendant un geste, `rendered` est l'aperçu : la hauteur qu'il porte
     * change à chaque case franchie. Les modules qui dimensionnent leur
     * requête dessus rechargeraient donc autant de fois. On leur transmet
     * celle de `items`, qui ne bouge qu'au relâchement.
     */
    const committedHeights = useMemo(
        () => new Map(items.map((i) => [i.instanceId, i.h])),
        [items]
    )

    /**
     * Le geste **tel qu'il est rendu** — dérivé, jamais synchronisé.
     *
     * `editing` peut tomber sans que l'utilisateur relâche quoi que ce
     * soit : il suffit que la fenêtre passe sous le point de rupture
     * d'édition pendant le déplacement. Les poignées et le draggable
     * disparaissent alors, mais l'état du geste, lui, resterait posé —
     * donc le repère d'atterrissage resterait affiché et, surtout,
     * `frozen` garderait `pointer-events-none` sur toutes les autres
     * cartes : le tableau de bord deviendrait inerte jusqu'au
     * rechargement.
     *
     * Le corriger par un `useEffect` de remise à zéro marcherait, mais
     * ajouterait une synchronisation là où une dérivation suffit — et
     * c'est exactement ce que `docs/ROUTING.md` proscrit ailleurs dans ce
     * dépôt. Un geste sans mode édition n'a rien à afficher : on le lit
     * comme absent, et le geste suivant écrasera l'état de toute façon.
     */
    const shown = editing ? gesture : null

    const rows = contentRows(rendered)

    /**
     * Rien à rendre tant que la largeur n'est pas mesurée.
     *
     * `columnWidth(0)` vaut −14,67 px : les onze gouttières sont
     * soustraites d'une largeur nulle. Les cartes recevaient donc, le
     * temps d'une frame, des largeurs négatives — que le navigateur
     * ignore, si bien que le défaut ne se voyait pas, mais tout le
     * canevas était calculé et rendu pour rien. `GridGuides` se protégeait
     * déjà de la même façon.
     *
     * Le conteneur mesuré vit dans `routes/Dashboard.tsx` et reste monté :
     * ne rien rendre ici n'empêche donc pas la mesure d'arriver.
     */
    if (width <= 0) return null

    if (width < EDIT_MIN_WIDTH) {
        return (
            <StackedCanvas
                items={items}
                compact={compact}
                colWidth={colWidth}
                onRemove={onRemove}
                onDuplicate={onDuplicate}
                onOpenSettings={onOpenSettings}
                onSettingsChange={onSettingsChange}
            />
        )
    }

    return (
        <DndContext
            sensors={sensors}
            accessibility={accessibility}
            modifiers={[restrictToCanvas]}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={endGesture}
            onDragCancel={cancelGesture}
        >
            <div
                ref={canvasRef}
                // La hauteur suit l'aperçu. Au repos elle s'anime — un
                // module retiré ne doit pas faire sauter la page. Pendant
                // un geste, elle ne s'anime PAS : l'aperçu se recalcule à
                // chaque case franchie, et une hauteur qui poursuit sa
                // transition pendant ce temps fait flotter le bas de page
                // en permanence. Elle suit donc l'aperçu au pixel près,
                // ce qui est aussi ce qui coûte le moins cher.
                className={cn(
                    "relative",
                    shown === null &&
                        "transition-[height] duration-base ease-emphasized motion-reduce:transition-none"
                )}
                style={{ height: canvasHeight(Math.max(rows, editing ? 4 : 0)) }}
            >
                {editing && (
                    <GridGuides rows={Math.max(rows, 4)} colWidth={colWidth} />
                )}

                {/* Où le module atterrira. Le repère vaut pour les deux
                    gestes : en redimensionnement la carte s'anime d'une
                    case à l'autre, et c'est lui qui dit sans ambiguïté
                    celle sur laquelle elle se calera. */}
                {shown && (
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute rounded-lg bg-primary/10 ring-2 ring-primary/50 transition-[left,top,width,height] duration-fast ease-decel motion-reduce:transition-none"
                        style={rectStyle(shown.landing, colWidth)}
                    />
                )}

                {rendered.map((item) => {
                    const widget = getWidget(item.widgetId)
                    // Un module inconnu a déjà été écarté par
                    // `sanitizeLayout` ; cette garde couvre le cas où le
                    // registre change pendant la session.
                    if (!widget) return null

                    const active = shown?.instanceId === item.instanceId

                    // Pendant un déplacement, la carte reste à son point de
                    // départ et suit le pointeur par `transform` ; c'est le
                    // repère d'atterrissage qui montre la case visée.
                    const rect =
                        active && shown.kind === "drag"
                            ? shown.origin
                            : rectOf(item)

                    return (
                        <WidgetCard
                            key={item.instanceId}
                            item={item}
                            widget={widget}
                            x={rect.x}
                            y={rect.y}
                            w={rect.w}
                            h={rect.h}
                            // La hauteur enregistrée, pas celle de
                            // l'aperçu : voir la prop côté `WidgetCard`.
                            dataHeight={
                                committedHeights.get(item.instanceId) ?? item.h
                            }
                            editing={editing}
                            compact={compact}
                            colWidth={colWidth}
                            active={active}
                            resizing={active && shown.kind === "resize"}
                            settling={settled === item.instanceId}
                            frozen={shown !== null && !active}
                            onResizeStart={startResize}
                            onResizeMove={moveResize}
                            onResizeEnd={endGesture}
                            onResizeStep={stepResize}
                            onRemove={onRemove}
                            onDuplicate={onDuplicate}
                            onOpenSettings={onOpenSettings}
                            onSettingsChange={onSettingsChange}
                        />
                    )
                })}
            </div>
        </DndContext>
    )
}
