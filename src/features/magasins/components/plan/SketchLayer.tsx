import { useEffect, useState } from "react"
import type { Point } from "@/features/magasins/types/magasin.types"
import { polygonPoints, snapPoint } from "@/features/magasins/utils/contour"
import type { Bounds } from "@/features/magasins/utils/planGeometry"
import { addPoint, closesShape } from "@/features/magasins/utils/shape"
import { angleSnapPoint, formatMeasure } from "@/features/magasins/utils/wall"
import type { PlanSvgContext } from "./PlanSvg"

interface SketchLayerProps {
    context: PlanSvgContext
    bounds: Bounds
    /** Tracé fini, en mètres. */
    onFinish: (points: Point[]) => void
    /**
     * `true` (défaut) : une forme fermée, d'au moins trois points.
     * `false` : une ligne ouverte (un mur), finie dès deux points ; cliquer le
     * premier point la referme (le premier point est alors répété à la fin).
     */
    closed?: boolean
    /** Tracé fini dès ce nombre de points (mur droit : 2). */
    maxPoints?: number
}

/**
 * Tracé d'une forme libre point par point, façon esquisse : chaque clic pose
 * un angle (pas de 10 cm), un trait suit la souris jusqu'au prochain. On ferme
 * en cliquant le premier point ou par double-clic ; Retour arrière retire le
 * dernier point, Échap efface le tracé. Maj enfoncée contraint l'angle du
 * segment par pas de 15° (horizontale, verticale, 45°…). La longueur et
 * l'angle du segment en cours s'affichent près du curseur.
 *
 * Une surface transparente couvre le plan pendant le tracé : elle reçoit les
 * clics à la place des éléments, qu'on peut ainsi décalquer sans les attraper.
 */
export function SketchLayer({ context, bounds, onFinish, closed = true, maxPoints }: SketchLayerProps) {
    const [points, setPoints] = useState<Point[]>([])
    const [cursor, setCursor] = useState<Point | null>(null)
    // Taille constante à l'écran : divisée par le zoom.
    const r = Math.max(0.12, Math.max(bounds.width, bounds.depth) / 90) / context.zoom

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // Une saisie en cours (cote, nom…) garde ses touches.
            // La cible n'est pas toujours un élément (événement émis sur la fenêtre).
            const target = e.target
            if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return
            if (e.key === "Escape") setPoints([])
            if (e.key === "Backspace") setPoints((p) => p.slice(0, -1))
            if (e.key === "Enter") finish()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    })

    const minPoints = closed ? 3 : 2
    const finish = (path: Point[] = points) => {
        if (path.length >= minPoints) onFinish(path)
        setPoints([])
    }

    const at = (e: { clientX: number; clientY: number; shiftKey?: boolean }) => {
        const p = context.toPlan(e)
        const snapped = snapPoint(p.x, p.y, bounds)
        return e.shiftKey ? angleSnapPoint(points[points.length - 1], snapped) : snapped
    }

    return (
        <g>
            <rect
                x={-1}
                y={-1}
                width={bounds.width + 2}
                height={bounds.depth + 2}
                fill="transparent"
                className="cursor-crosshair"
                data-testid="sketch-surface"
                onPointerDown={(e) => {
                    e.stopPropagation()
                    const p = at(e)
                    const next = addPoint(points, p)
                    if (maxPoints && next.length >= maxPoints) finish(next)
                    else if (closesShape(points, p, r * 2.5)) finish(closed ? points : [...points, points[0]])
                    else setPoints(next)
                }}
                onPointerMove={(e) => setCursor(at(e))}
                onDoubleClick={(e) => {
                    e.stopPropagation()
                    finish()
                }}
            />
            {points.length > 0 && (
                <g className="pointer-events-none">
                    {closed && points.length >= 3 && (
                        <polygon points={polygonPoints(points)} className="fill-primary/10 stroke-none" />
                    )}
                    <polyline
                        points={polygonPoints(cursor ? [...points, cursor] : points)}
                        className="fill-none stroke-primary"
                        strokeWidth={r * 0.4}
                        strokeLinejoin="round"
                        strokeDasharray={`${r} ${r * 0.6}`}
                    />
                    {cursor && (
                        // Cote du segment en cours : longueur et angle.
                        <text
                            x={cursor[0] + r * 1.5}
                            y={cursor[1] - r * 1.5}
                            fontSize={r * 2.4}
                            className="fill-primary font-semibold"
                            paintOrder="stroke"
                            stroke="hsl(var(--background))"
                            strokeWidth={r * 0.8}
                        >
                            {formatMeasure(points[points.length - 1], cursor)}
                        </text>
                    )}
                    {points.map(([x, y], i) => (
                        <circle
                            // Les points du tracé n'ont pas d'identité : leur rang en tient lieu.
                            // eslint-disable-next-line react-x/no-array-index-key
                            key={i}
                            cx={x}
                            cy={y}
                            r={i === 0 && points.length >= minPoints ? r * 1.6 : r}
                            className={i === 0 ? "fill-background stroke-primary" : "fill-primary"}
                            strokeWidth={r * 0.4}
                        />
                    ))}
                </g>
            )}
        </g>
    )
}
