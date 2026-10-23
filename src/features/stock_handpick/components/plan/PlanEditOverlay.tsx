import { useRef, type PointerEvent as ReactPointerEvent } from "react"
import { cn } from "@/shared/lib/utils"
import type { FloorLayout, Rect } from "@/features/stock_handpick/utils/floorPlan"
import {
    ANGLED_KINDS,
    RECT_KINDS,
    elementBounds,
    elementRect,
    elementRotation,
    moveElement,
    resizeElement,
    type ElementRef,
} from "@/features/stock_handpick/utils/floorPlanEdit"
import type { PlanZoneCode } from "@/features/stock_handpick/utils/planLayout"
import { rotateAround } from "./PlanFixture"

interface PlanEditOverlayProps {
    floor: FloorLayout
    selected: ElementRef | null
    onSelect: (ref: ElementRef | null) => void
    /** Aperçu pendant un glisser : n'entre pas dans l'historique. */
    onPreview: (floor: FloorLayout) => void
    /** Premier mouvement d'un glisser : l'éditeur mémorise l'état pour « Annuler ». */
    onGestureStart: () => void
}

type Gesture = {
    mode: "move" | "resize"
    ref: ElementRef
    origin: FloorLayout
    start: { x: number; z: number }
    rect: Rect | null
    /** Angle de l'élément : le redimensionnement se lit dans son repère. */
    rotation: number
    /** L'historique n'est alimenté qu'au premier mouvement, pas au simple clic. */
    moved: boolean
}

/** Taille de la poignée de redimensionnement, en mètres. */
const HANDLE = 0.45

const HIT = "cursor-move fill-transparent stroke-transparent hover:stroke-primary"

const same = (a: ElementRef | null, b: ElementRef) => a?.kind === b.kind && a.id === b.id

/** Point du plan (mètres) sous le pointeur. */
function toPlan(event: ReactPointerEvent<Element>): { x: number; z: number } | null {
    const target = event.currentTarget as SVGGraphicsElement
    const svg = target.ownerSVGElement ?? (target as unknown as SVGSVGElement)
    const matrix = svg.getScreenCTM?.()
    if (!matrix) return null
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const p = point.matrixTransform(matrix.inverse())
    return { x: p.x, z: p.y }
}

/**
 * Couche d'édition posée sur le plan 2D : une zone de saisie transparente par
 * élément. Cliquer sélectionne, glisser déplace, la poignée du coin
 * redimensionne. Chaque pas du glisser repart de la disposition d'ORIGINE du
 * geste : les arrondis de la grille ne s'accumulent pas.
 *
 * Les zones ne se saisissent que par leur étiquette : leur surface couvre tout
 * le plan et volerait les clics destinés aux meubles.
 */
export function PlanEditOverlay({
    floor,
    selected,
    onSelect,
    onPreview,
    onGestureStart,
}: PlanEditOverlayProps) {
    const gestureRef = useRef<Gesture | null>(null)

    const begin = (mode: Gesture["mode"], ref: ElementRef) => (event: ReactPointerEvent<Element>) => {
        event.stopPropagation()
        // La sélection ne dépend pas de la géométrie de l'écran : elle passe
        // même si le point ne peut pas être converti.
        onSelect(ref)
        const start = toPlan(event)
        if (!start) return
        ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
        gestureRef.current = {
            mode,
            ref,
            origin: floor,
            start,
            rect: elementRect(floor, ref),
            rotation: elementRotation(floor, ref),
            moved: false,
        }
    }

    const move = (event: ReactPointerEvent<Element>) => {
        const g = gestureRef.current
        if (!g) return
        const p = toPlan(event)
        if (!p) return
        const dx = p.x - g.start.x
        const dz = p.z - g.start.z
        if (!g.moved) {
            g.moved = true
            onGestureStart()
        }
        if (g.mode === "move" || !g.rect) {
            onPreview(moveElement(g.origin, g.ref, dx, dz))
            return
        }
        // Élément tourné : le glisser est projeté sur ses propres axes.
        const a = (g.rotation * Math.PI) / 180
        const along = dx * Math.cos(a) + dz * Math.sin(a)
        const across = -dx * Math.sin(a) + dz * Math.cos(a)
        onPreview(resizeElement(g.origin, g.ref, g.rect.w + along, g.rect.d + across))
    }

    const end = (event: ReactPointerEvent<Element>) => {
        ;(event.currentTarget as Element).releasePointerCapture?.(event.pointerId)
        gestureRef.current = null
    }

    const handlers = (ref: ElementRef) => ({
        onPointerDown: begin("move", ref),
        onPointerMove: move,
        onPointerUp: end,
        onPointerCancel: end,
    })

    const rectHit = (ref: ElementRef, rect: Rect, title: string, rotation?: number) => (
        <rect
            key={`${ref.kind}:${ref.id}`}
            transform={rotateAround(rect, rotation)}
            x={rect.x}
            y={rect.z}
            width={rect.w}
            height={rect.d}
            strokeWidth={0.08}
            className={HIT}
            {...handlers(ref)}
        >
            <title>{title}</title>
        </rect>
    )

    const bounds = selected ? elementBounds(floor, selected) : null
    const resizable = selected && RECT_KINDS.has(selected.kind) && bounds
    // Élément tourné : contour et poignée tournent avec lui.
    const selectedTransform =
        selected && bounds && ANGLED_KINDS.has(selected.kind)
            ? rotateAround(bounds, elementRotation(floor, selected))
            : undefined

    return (
        <g>
            {/* Fond : un clic dans le vide désélectionne (et, zoomé, déplace la vue). */}
            <rect
                x={-1}
                y={-1}
                width={floor.width + 2}
                height={floor.depth + 2}
                className="fill-transparent"
                onPointerDown={() => onSelect(null)}
            />

            <g data-no-pan="">

                {floor.innerWalls.map((wall) => (
                    <line
                        key={`wall:${wall.id}`}
                        x1={wall.from[0]} y1={wall.from[1]} x2={wall.to[0]} y2={wall.to[1]}
                        strokeWidth={0.6}
                        className="cursor-move stroke-transparent hover:stroke-primary/40"
                        {...handlers({ kind: "wall", id: wall.id })}
                    >
                        <title>Cloison</title>
                    </line>
                ))}
                {floor.offices.map((o) => rectHit({ kind: "office", id: o.id }, o.rect, o.label, o.rotation))}
                {floor.fixtures.map((f) => rectHit({ kind: "fixture", id: f.id }, f.rect, f.label ?? f.kind, f.rotation))}
                {floor.racks.map((r) => rectHit({ kind: "rack", id: r.id }, r.rect, r.row ?? "Rack", r.rotation))}
                {floor.doors.map((door) => (
                    <line
                        key={`door:${door.id}`}
                        x1={door.from[0]} y1={door.from[1]} x2={door.to[0]} y2={door.to[1]}
                        strokeWidth={0.8}
                        strokeLinecap="round"
                        className="cursor-move stroke-transparent hover:stroke-primary/40"
                        {...handlers({ kind: "door", id: door.id })}
                    >
                        <title>{door.label}</title>
                    </line>
                ))}
                {floor.pillars.map((p) => (
                    <circle
                        key={`pillar:${p.id}`}
                        cx={p.x}
                        cy={p.z}
                        r={0.35}
                        strokeWidth={0.06}
                        className="cursor-move fill-foreground/70 stroke-transparent hover:stroke-primary"
                        {...handlers({ kind: "pillar", id: p.id })}
                    >
                        <title>Colonne</title>
                    </circle>
                ))}
                {(["A", "D"] as const).map((zone) => {
                    const spot = floor.baleSpots[zone]
                    return (
                        <rect
                            key={`spot:${zone}`}
                            x={spot.x - 1.2}
                            y={spot.z - 0.8}
                            width={2.4}
                            height={1.6}
                            rx={0.15}
                            strokeWidth={0.06}
                            strokeDasharray="0.2 0.15"
                            className="cursor-move fill-chart-1/15 stroke-chart-1"
                            {...handlers({ kind: "baleSpot", id: zone })}
                        >
                            <title>{`Dépose des balles de ${zone}`}</title>
                        </rect>
                    )
                })}

                {/* Étiquettes de zone : seule prise pour déplacer une zone. */}
                {(Object.keys(floor.zones) as PlanZoneCode[]).map((zone) => {
                    const rect = floor.zones[zone]
                    const ref: ElementRef = { kind: "zone", id: zone }
                    // Zone collée au mur du haut : étiquette au-dessus du mur, pour
                    // ne pas masquer ses racks (B à gauche, les autres à droite,
                    // loin du libellé de l'accès annexe).
                    const onTopWall = rect.z <= 0
                    const tagX = onTopWall && zone !== "B" ? rect.x + rect.w - 2.1 : rect.x + 0.2
                    const tagZ = onTopWall ? -0.95 : rect.z + 0.2
                    return (
                        <g key={`zone:${zone}`} className="cursor-move" {...handlers(ref)}>
                            <rect
                                x={tagX}
                                y={tagZ}
                                width={1.9}
                                height={0.8}
                                rx={0.15}
                                className={cn(same(selected, ref) ? "fill-primary" : "fill-foreground/70")}
                            />
                            <text
                                x={tagX + 0.95}
                                y={tagZ + 0.42}
                                fontSize={0.5}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="pointer-events-none fill-background font-bold"
                            >
                                {`Zone ${zone}`}
                            </text>
                        </g>
                    )
                })}

                {/* Sélection : contour et poignée. */}
                {bounds && (
                    <rect
                        x={bounds.x - 0.1}
                        y={bounds.z - 0.1}
                        width={bounds.w + 0.2}
                        height={bounds.d + 0.2}
                        strokeWidth={0.1}
                        strokeDasharray="0.3 0.2"
                        transform={selectedTransform}
                        className="pointer-events-none fill-primary/10 stroke-primary"
                    />
                )}
                {resizable && selected && (
                    <rect
                        x={bounds.x + bounds.w - HANDLE / 2}
                        y={bounds.z + bounds.d - HANDLE / 2}
                        width={HANDLE}
                        height={HANDLE}
                        strokeWidth={0.06}
                        transform={selectedTransform}
                        className="cursor-nwse-resize fill-background stroke-primary"
                        onPointerDown={begin("resize", selected)}
                        onPointerMove={move}
                        onPointerUp={end}
                        onPointerCancel={end}
                    >
                        <title>Redimensionner</title>
                    </rect>
                )}
            </g>
        </g>
    )
}
