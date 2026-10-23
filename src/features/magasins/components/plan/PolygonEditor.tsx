import { useState, type PointerEvent as ReactPointerEvent } from "react"
import type { Point } from "@/features/magasins/types/magasin.types"
import {
    edgeMidpoints,
    insertVertex,
    MIN_VERTICES,
    moveVertex,
    polygonPoints,
    removeVertex,
    snapPoint,
} from "@/features/magasins/utils/contour"
import type { Bounds } from "@/features/magasins/utils/planGeometry"
import { angleSnapPoint, formatMeasure } from "@/features/magasins/utils/wall"
import { cn } from "@/shared/lib/utils"
import type { PlanSvgContext } from "./PlanSvg"

interface PolygonEditorProps {
    context: PlanSvgContext
    bounds: Bounds
    points: readonly Point[]
    /** Contour modifié, envoyé au relâcher (pas à chaque pixel). */
    onChange: (points: Point[]) => void
    /** `false` : ligne ouverte (mur) — pas de côté entre le dernier point et le premier, deux points au minimum. */
    closed?: boolean
}

/**
 * Éditeur de polygone en calque de `PlanSvg` — contour d'un étage, ou forme
 * libre d'un meuble :
 *  · glisser un sommet (rond plein) le déplace, au pas de 10 cm ;
 *  · tirer un milieu de côté (petit rond) ajoute un sommet à cet endroit ;
 *  · double-cliquer un sommet le retire (trois au minimum) ;
 *  · Maj enfoncée contraint le côté depuis le sommet précédent par pas de 15°
 *    (diagonales à 45° comprises) ; sa cote s'affiche pendant le glisser.
 */
export function PolygonEditor({
    context,
    bounds,
    points,
    onChange,
    closed = true,
}: PolygonEditorProps) {
    const minVertices = closed ? MIN_VERTICES : 2
    const [drag, setDrag] = useState<{ index: number; points: Point[] } | null>(
        null
    )
    const shown = drag?.points ?? points
    // Taille constante à l'écran : divisée par le zoom.
    const r =
        Math.max(0.18, Math.max(bounds.width, bounds.depth) / 70) / context.zoom

    const start = (
        event: ReactPointerEvent<SVGElement>,
        index: number,
        base: Point[]
    ) => {
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        setDrag({ index, points: base })
    }

    /** Sommet dont part le côté du sommet `index` (le précédent, en boucle si fermé). */
    const anchorOf = (pts: readonly Point[], index: number): Point | undefined =>
        index > 0 ? pts[index - 1] : closed ? pts[pts.length - 1] : pts[1]

    const move = (event: ReactPointerEvent<SVGElement>) => {
        if (!drag) return
        const p = context.toPlan(event)
        const snapped = snapPoint(p.x, p.y, bounds)
        const to = event.shiftKey ? angleSnapPoint(anchorOf(drag.points, drag.index), snapped) : snapped
        setDrag({ ...drag, points: moveVertex(drag.points, drag.index, to) })
    }

    const end = (event: ReactPointerEvent<SVGElement>) => {
        if (!drag) return
        event.currentTarget.releasePointerCapture(event.pointerId)
        onChange(drag.points)
        setDrag(null)
    }

    const handlers = {
        onPointerMove: move,
        onPointerUp: end,
        onPointerCancel: end,
    }

    return (
        <g>
            {closed ? (
                <polygon
                    points={polygonPoints(shown)}
                    className="pointer-events-none fill-primary/5 stroke-primary"
                    strokeWidth={r * 0.35}
                    strokeLinejoin="round"
                />
            ) : (
                <polyline
                    points={polygonPoints(shown)}
                    className="pointer-events-none fill-none stroke-primary"
                    strokeWidth={r * 0.35}
                    strokeLinejoin="round"
                />
            )}

            {/* Toujours montés : le milieu tiré garde la capture du pointeur
                pendant tout le glisser. Démonté au premier mouvement, il la
                perdrait et le nouveau sommet ne suivrait plus la souris. */}
            {edgeMidpoints(drag ? points : shown)
                .filter(
                    ({ index }) =>
                        closed || index < (drag ? points : shown).length - 1
                )
                .map(({ index, point }) => (
                    <circle
                        key={`mid-${index}`}
                        cx={point[0]}
                        cy={point[1]}
                        r={r * 0.6}
                        className={cn(
                            "cursor-copy fill-background stroke-primary",
                            drag && "opacity-0"
                        )}
                        strokeWidth={r * 0.25}
                        aria-label={`Ajouter un sommet sur le côté ${index + 1}`}
                        onPointerDown={(e) =>
                            start(
                                e,
                                index + 1,
                                insertVertex(shown, index, point)
                            )
                        }
                        {...handlers}
                    >
                        <title>Tirer pour ajouter un angle</title>
                    </circle>
                ))}

            {drag && anchorOf(drag.points, drag.index) && (
                // Cote du côté en cours de déplacement.
                <text
                    x={drag.points[drag.index][0] + r * 1.4}
                    y={drag.points[drag.index][1] - r * 1.4}
                    fontSize={r * 2.2}
                    className="pointer-events-none fill-primary font-semibold"
                    paintOrder="stroke"
                    stroke="hsl(var(--background))"
                    strokeWidth={r * 0.7}
                >
                    {formatMeasure(anchorOf(drag.points, drag.index) as Point, drag.points[drag.index])}
                </text>
            )}

            {shown.map(([x, y], index) => (
                <circle
                    // Les sommets n'ont pas d'identité propre : leur rang en tient lieu.
                    // eslint-disable-next-line react-x/no-array-index-key
                    key={`v-${index}`}
                    cx={x}
                    cy={y}
                    r={r}
                    className="cursor-grab fill-primary stroke-background"
                    strokeWidth={r * 0.3}
                    aria-label={`Sommet ${index + 1}`}
                    onPointerDown={(e) => start(e, index, [...shown])}
                    onDoubleClick={(e) => {
                        e.stopPropagation()
                        if (shown.length > minVertices)
                            onChange(
                                closed
                                    ? removeVertex(shown, index)
                                    : shown.filter((_, i) => i !== index)
                            )
                    }}
                    {...handlers}
                >
                    <title>
                        Glisser pour déplacer · double-clic pour retirer
                    </title>
                </circle>
            ))}
        </g>
    )
}
