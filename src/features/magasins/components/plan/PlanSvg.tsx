import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { cn } from "@/shared/lib/utils"
import type { Mur, PlanItem, Point } from "@/features/magasins/types/magasin.types"
import type { FondLayer } from "@/features/magasins/hooks/data/useFond"
import { usePlanViewport } from "@/features/magasins/hooks/ui/usePlanViewport"
import { polygonPoints } from "@/features/magasins/utils/contour"
import {
    clampRect,
    moveRect,
    rectOf,
    resizeByHandle,
    snap,
    type Bounds,
    type Rect,
    type ResizeHandle,
} from "@/features/magasins/utils/planGeometry"
import { viewBoxAttr } from "@/features/magasins/utils/viewport"
import { FondEditor } from "./FondEditor"
import { PlanItemShape } from "./PlanItemShape"
import { WallShape } from "./WallShape"
import { murKey } from "@/features/magasins/utils/wall"
import { groupMembers, selectionKeys } from "@/features/magasins/utils/group"
import { PlanZoomControls } from "./PlanZoomControls"

export interface PlanPoint {
    x: number
    y: number
}

/**
 * Passé aux calques d'outils (`overlay`, calage du fond) : conversion pointeur
 * → mètres du plan, et niveau de zoom (1 = tout le magasin) pour garder des
 * poignées de taille constante à l'écran.
 */
export interface PlanSvgContext {
    toPlan: (event: { clientX: number; clientY: number }) => PlanPoint
    zoom: number
}

interface PlanSvgProps {
    bounds: Bounds
    items: readonly PlanItem[]
    selectedKey: string | null
    onSelect: (key: string | null) => void
    /** Mode édition : les éléments se déplacent et se redimensionnent. */
    editing?: boolean
    onRectChange?: (item: PlanItem, rect: Rect) => void
    /** Rotation libre (poignée ronde) : angle absolu en degrés. */
    onRotationChange?: (item: PlanItem, degrees: number) => void
    /** Contour de l'étage ; `null` ou absent = le rectangle du magasin. */
    contour?: readonly Point[] | null
    /** Calque d'outils dessiné par-dessus tout, dans le même repère (contour…). */
    overlay?: (context: PlanSvgContext) => ReactNode
    /** Un outil externe a la main (contour, tracé) : les éléments ne réagissent pas. */
    itemsInert?: boolean
    /** Plan importé, affiché sous les éléments pour les décalquer. */
    background?: FondLayer | null
    /** Calage du plan importé à la souris (voir `FondEditor`). */
    adjustingBackground?: boolean
    onBackgroundChange?: (rect: Rect) => void
    /** Outil « dessiner » : un glisser sur le fond trace un rectangle. */
    drawing?: boolean
    onDraw?: (rect: Rect) => void
    /** Actions affichées sous le plan, à droite, à côté du zoom (Supprimer…). */
    actions?: ReactNode
    /** Murs de l'étage ; sélectionnables par la clé `m:<id>` de `selectedKey`. */
    walls?: readonly Mur[]
    /** Objet dont les angles sont en cours d'édition : ses poignées s'effacent. */
    handlesHiddenKey?: string | null
}

/** Plus petit rectangle accepté au tracé, en mètres. */
const MIN_DRAW = 0.3

interface Drag {
    key: string
    mode: "move" | "resize" | "rotate"
    handle: ResizeHandle
    start: PlanPoint
    rect: Rect
    rotation: number
}

/**
 * Plan 2D du magasin, en SVG, en mètres (1 unité = 1 m). La grille marque le
 * mètre. En édition, un glisser déplace l'élément, la poignée du coin
 * bas-droit le redimensionne ; le pas est de 10 cm. La molette zoome, glisser
 * le fond déplace la vue.
 */
export function PlanSvg({
    bounds,
    items,
    selectedKey,
    onSelect,
    editing = false,
    onRectChange,
    onRotationChange,
    contour,
    overlay,
    itemsInert = false,
    background,
    adjustingBackground = false,
    onBackgroundChange,
    drawing = false,
    onDraw,
    actions,
    walls = [],
    handlesHiddenKey = null,
}: PlanSvgProps) {
    const svgRef = useRef<SVGSVGElement>(null)
    const [drag, setDrag] = useState<Drag | null>(null)
    const [draw, setDraw] = useState<{ start: PlanPoint; current: PlanPoint } | null>(null)

    const toPlan = (event: { clientX: number; clientY: number }): PlanPoint => {
        const svg = svgRef.current
        const ctm = svg?.getScreenCTM()
        if (!svg || !ctm) return { x: 0, y: 0 }
        const point = svg.createSVGPoint()
        point.x = event.clientX
        point.y = event.clientY
        const p = point.matrixTransform(ctm.inverse())
        return { x: p.x, y: p.y }
    }

    const viewport = usePlanViewport(svgRef, bounds, toPlan)
    // Les autres volées d'un escalier fusionné s'éclairent avec la sélection.
    const highlighted = selectionKeys(selectedKey, items)
    // Escaliers fusionnés : leurs volées, pour un dessin d'un seul tenant.
    const mergedOf = (item: PlanItem) => {
        const members = item.groupe ? groupMembers(item, items) : []
        return members.length > 1 ? members : null
    }
    const context: PlanSvgContext = { toPlan, zoom: viewport.zoom }

    const startDrag = (event: ReactPointerEvent, item: PlanItem, mode: Drag["mode"], handle: ResizeHandle = "se") => {
        // Sans quoi le fond, qui déplace la vue, recevrait aussi l'appui.
        event.stopPropagation()
        onSelect(item.key)
        const rect = rectOf(item.geometry)
        if (!editing || !rect) return
        svgRef.current?.setPointerCapture(event.pointerId)
        setDrag({ key: item.key, mode, handle, start: toPlan(event), rect, rotation: item.geometry.rotation })
    }

    const onCanvasPointerDown = (event: ReactPointerEvent) => {
        if (!drawing) {
            viewport.startPan(event)
            return
        }
        const point = toPlan(event)
        svgRef.current?.setPointerCapture(event.pointerId)
        setDraw({ start: point, current: point })
    }

    const onPointerMove = (event: ReactPointerEvent) => {
        if (viewport.movePan(event)) return
        if (drag?.mode === "rotate") {
            const item = items.find((i) => i.key === drag.key)
            if (!item || !onRotationChange) return
            const p = toPlan(event)
            const cx = drag.rect.x + drag.rect.w / 2
            const cy = drag.rect.y + drag.rect.h / 2
            // La poignée est au-dessus du centre à 0° : angle du pointeur + 90°.
            const raw = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI + 90
            // Au degré près ; par pas de 15° avec Maj.
            const step = event.shiftKey ? 15 : 1
            onRotationChange(item, Math.round(raw / step) * step)
            return
        }
        if (draw) {
            setDraw({ ...draw, current: toPlan(event) })
            return
        }
        if (!drag || !onRectChange) return
        const item = items.find((i) => i.key === drag.key)
        if (!item) return
        const p = toPlan(event)
        const dx = p.x - drag.start.x
        const dy = p.y - drag.start.y
        // La rotation est prise en compte par resizeByHandle (côté opposé fixe).
        onRectChange(
            item,
            drag.mode === "move" ? moveRect(drag.rect, dx, dy, bounds, drag.rotation) : resizeByHandle(drag.rect, drag.rotation, drag.handle, dx, dy, bounds),
        )
    }

    const drawnRect = draw
        ? clampRect(
              {
                  x: snap(Math.min(draw.start.x, draw.current.x)),
                  y: snap(Math.min(draw.start.y, draw.current.y)),
                  w: snap(Math.abs(draw.current.x - draw.start.x)),
                  h: snap(Math.abs(draw.current.y - draw.start.y)),
              },
              bounds,
          )
        : null

    const endDrag = (event: ReactPointerEvent) => {
        const panned = viewport.endPan(event)
        if (panned) {
            // Un clic sur le fond, sans glisser, désélectionne.
            if (panned === "click") onSelect(null)
            return
        }
        if (draw) {
            svgRef.current?.releasePointerCapture(event.pointerId)
            setDraw(null)
            // Un clic sans glisser ne crée rien.
            const big = Math.abs(draw.current.x - draw.start.x) >= MIN_DRAW && Math.abs(draw.current.y - draw.start.y) >= MIN_DRAW
            if (drawnRect && big) onDraw?.(drawnRect)
            return
        }
        if (!drag) return
        svgRef.current?.releasePointerCapture(event.pointerId)
        setDrag(null)
    }

    const inert = drawing || adjustingBackground || itemsInert
    // Épaisseur d'un trait, en mètres au zoom 1, divisée par le zoom : le trait
    // garde sa largeur à l'écran, comme dans un logiciel de CAO.
    const line = (meters: number) => meters / viewport.zoom
    const grid: number[][] = []
    for (let x = 1; x < bounds.width; x++) grid.push([x, 0, x, bounds.depth])
    for (let y = 1; y < bounds.depth; y++) grid.push([0, y, bounds.width, y])

    return (
        <div className="flex flex-col gap-2">
            {/* Même cadre que la vue 3D : 16:9, hauteur bornée à 30rem. Le magasin s'y loge
                centré, quelle que soit sa forme ; borné en rem, il suit le zoom du navigateur
                (une largeur seule grandirait avec la page). */}
            <svg
                ref={svgRef}
                role="img"
                aria-label="Plan 2D du magasin"
                viewBox={viewBoxAttr(viewport.view)}
                className={cn(
                    "aspect-video max-h-120 w-full touch-none select-none rounded-2xl border border-border bg-card",
                    drawing ? "cursor-crosshair" : viewport.panning ? "cursor-grabbing" : viewport.zoom > 1 && "cursor-grab",
                )}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onPointerDown={onCanvasPointerDown}
            >
                {contour ? (
                    // Contour libre : le cadre du magasin reste esquissé autour.
                    <>
                        <rect
                            x={0}
                            y={0}
                            width={bounds.width}
                            height={bounds.depth}
                            className="fill-none stroke-border"
                            strokeWidth={line(0.04)}
                            strokeDasharray={`${line(0.2)} ${line(0.15)}`}
                        />
                        <polygon points={polygonPoints(contour)} className="fill-muted/40 stroke-foreground" strokeWidth={line(0.08)} strokeLinejoin="round" />
                    </>
                ) : (
                    <rect x={0} y={0} width={bounds.width} height={bounds.depth} className="fill-muted/40 stroke-foreground" strokeWidth={line(0.08)} />
                )}
                {background && !adjustingBackground && (
                    <image
                        href={background.url}
                        x={background.rect.x}
                        y={background.rect.y}
                        width={background.rect.w}
                        height={background.rect.h}
                        opacity={background.opacity}
                        preserveAspectRatio="none"
                        className="pointer-events-none"
                    />
                )}
                <g className="stroke-border" strokeWidth={line(0.02)}>
                    {grid.map(([x1, y1, x2, y2]) => (
                        <line key={`${x1}-${y1}-${x2}-${y2}`} x1={x1} y1={y1} x2={x2} y2={y2} />
                    ))}
                </g>

                {/* Murs sous les éléments : un meuble contre un mur reste attrapable. */}
                {walls.map((mur) => (
                    <WallShape
                        key={mur.id}
                        mur={mur}
                        selected={murKey(mur.id) === selectedKey}
                        inert={inert}
                        zoom={viewport.zoom}
                        onSelect={(e) => {
                            e.stopPropagation()
                            onSelect(murKey(mur.id))
                        }}
                    />
                ))}

                {items.map((item) => (
                    <PlanItemShape
                        key={item.key}
                        item={item}
                        bounds={bounds}
                        selected={item.key === selectedKey}
                        grouped={highlighted.has(item.key)}
                        merged={mergedOf(item)}
                        editing={editing}
                        inert={inert}
                        zoom={viewport.zoom}
                        onMoveStart={(e) => startDrag(e, item, "move")}
                        onResizeStart={(e, handle) => startDrag(e, item, "resize", handle)}
                        onRotateStart={onRotationChange ? (e) => startDrag(e, item, "rotate") : undefined}
                        hideHandles={item.key === handlesHiddenKey}
                    />
                ))}

                {background && adjustingBackground && onBackgroundChange && (
                    <FondEditor context={context} bounds={bounds} background={background} onChange={onBackgroundChange} />
                )}

                {overlay?.(context)}

                {drawnRect && (
                    <rect
                        x={drawnRect.x}
                        y={drawnRect.y}
                        width={drawnRect.w}
                        height={drawnRect.h}
                        className="pointer-events-none fill-primary/15 stroke-primary"
                        strokeWidth={line(0.06)}
                        strokeDasharray={`${line(0.2)} ${line(0.12)}`}
                    />
                )}
            </svg>
            <div className="flex flex-wrap items-center justify-end gap-2">
                {actions}
                <PlanZoomControls zoom={viewport.zoom} onZoomIn={viewport.zoomIn} onZoomOut={viewport.zoomOut} onReset={viewport.reset} />
            </div>
        </div>
    )
}
