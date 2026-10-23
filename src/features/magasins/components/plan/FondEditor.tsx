import { useState, type PointerEvent as ReactPointerEvent } from "react"
import type { FondLayer } from "@/features/magasins/hooks/data/useFond"
import { moveFond, resizeFond, type Bounds, type Rect } from "@/features/magasins/utils/planGeometry"
import type { PlanSvgContext } from "./PlanSvg"

interface FondEditorProps {
    context: PlanSvgContext
    bounds: Bounds
    background: FondLayer
    /** Rectangle final, envoyé au relâcher (pas à chaque pixel). */
    onChange: (rect: Rect) => void
}

const sameRect = (a: Rect, b: Rect) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h

/**
 * Calage du plan importé à la souris, en calque de `PlanSvg` : glisser le
 * plan le déplace, la poignée du coin bas-droit le redimensionne (proportions
 * gardées). Dessiné au-dessus des éléments, rendus inertes pendant le calage,
 * pour que plan et poignée restent attrapables.
 */
export function FondEditor({ context, bounds, background, onChange }: FondEditorProps) {
    const [drag, setDrag] = useState<{ mode: "move" | "resize"; start: { x: number; y: number }; rect: Rect; current: Rect } | null>(
        null,
    )
    const rect = drag?.current ?? background.rect
    // Taille constante à l'écran, quel que soit le zoom.
    const handle = Math.max(0.49, Math.max(bounds.width, bounds.depth) / 35) / context.zoom

    const start = (event: ReactPointerEvent<SVGElement>, mode: "move" | "resize") => {
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        setDrag({ mode, start: context.toPlan(event), rect, current: rect })
    }

    const move = (event: ReactPointerEvent<SVGElement>) => {
        if (!drag) return
        const p = context.toPlan(event)
        const dx = p.x - drag.start.x
        const dy = p.y - drag.start.y
        setDrag({ ...drag, current: drag.mode === "move" ? moveFond(drag.rect, dx, dy) : resizeFond(drag.rect, dx) })
    }

    const end = (event: ReactPointerEvent<SVGElement>) => {
        if (!drag) return
        event.currentTarget.releasePointerCapture(event.pointerId)
        setDrag(null)
        if (!sameRect(drag.current, drag.rect)) onChange(drag.current)
    }

    const handlers = { onPointerMove: move, onPointerUp: end, onPointerCancel: end }

    return (
        <g>
            <image
                href={background.url}
                x={rect.x}
                y={rect.y}
                width={rect.w}
                height={rect.h}
                opacity={background.opacity}
                preserveAspectRatio="none"
                className="cursor-move"
                onPointerDown={(e) => start(e, "move")}
                {...handlers}
            />
            <rect
                x={rect.x}
                y={rect.y}
                width={rect.w}
                height={rect.h}
                className="pointer-events-none fill-none stroke-primary"
                strokeWidth={0.06 / context.zoom}
                strokeDasharray={`${0.25 / context.zoom} ${0.15 / context.zoom}`}
            />
            <rect
                x={rect.x + rect.w - handle / 2}
                y={rect.y + rect.h - handle / 2}
                width={handle}
                height={handle}
                rx={handle * 0.15}
                className="cursor-nwse-resize fill-primary stroke-background"
                strokeWidth={handle * 0.1}
                aria-label="Redimensionner le plan importé"
                onPointerDown={(e) => start(e, "resize")}
                {...handlers}
            />
        </g>
    )
}
