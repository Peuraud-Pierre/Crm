import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react"
import type { Bounds } from "@/features/magasins/utils/planGeometry"
import { fullView, panView, zoomAt, zoomCenter, zoomOf, type ViewBox } from "@/features/magasins/utils/viewport"

type ToPlan = (event: { clientX: number; clientY: number }) => { x: number; y: number }

/** Déplacement minimal (px) pour qu'un appui sur le fond devienne un glisser. */
const PAN_THRESHOLD = 4

/**
 * Zoom d'affichage du plan 2D : molette vers le pointeur, glisser du fond
 * pour se déplacer, zoom avant / arrière / vue entière. La vue repart de la
 * vue entière quand l'emprise du magasin change.
 */
export function usePlanViewport(svgRef: RefObject<SVGSVGElement | null>, bounds: Bounds, toPlan: ToPlan) {
    const boundsKey = `${bounds.width}x${bounds.depth}`
    const [state, setState] = useState<{ key: string; view: ViewBox }>(() => ({ key: boundsKey, view: fullView(bounds) }))
    const view = state.key === boundsKey ? state.view : fullView(bounds)
    const zoom = zoomOf(view, bounds)
    const [pan, setPan] = useState<{ x: number; y: number; view: ViewBox; unitsPerPx: number; moved: boolean } | null>(
        null,
    )

    const update = (next: (current: ViewBox) => ViewBox) =>
        setState((prev) => ({ key: boundsKey, view: next(prev.key === boundsKey ? prev.view : fullView(bounds)) }))

    // Lus par l'écouteur de molette, posé une fois au montage.
    const latestRef = useRef({ toPlan, bounds, boundsKey })
    useEffect(() => {
        latestRef.current = { toPlan, bounds, boundsKey }
    })

    // Écouteur natif non passif : React pose `wheel` en passif, et la page
    // défilerait en même temps que le plan zoome.
    useEffect(() => {
        const svg = svgRef.current
        if (!svg) return
        const onWheel = (event: WheelEvent) => {
            event.preventDefault()
            const { toPlan: convert, bounds: b, boundsKey: key } = latestRef.current
            const point = convert(event)
            setState((prev) => ({
                key,
                view: zoomAt(prev.key === key ? prev.view : fullView(b), b, point, Math.exp(-event.deltaY * 0.0015)),
            }))
        }
        svg.addEventListener("wheel", onWheel, { passive: false })
        return () => svg.removeEventListener("wheel", onWheel)
    }, [svgRef])

    /** Appui sur le fond : début possible d'un déplacement de la vue. */
    const startPan = (event: ReactPointerEvent) => {
        const box = svgRef.current?.getBoundingClientRect()
        svgRef.current?.setPointerCapture(event.pointerId)
        // La vue est logée dans le cadre sans déformation : c'est le côté qui
        // la limite qui donne l'échelle (des bandes vides bordent l'autre).
        const unitsPerPx = Math.max(view.w / (box?.width || 1), view.h / (box?.height || 1))
        setPan({ x: event.clientX, y: event.clientY, view, unitsPerPx, moved: false })
    }

    /** `true` si l'événement appartenait au déplacement de la vue. */
    const movePan = (event: ReactPointerEvent): boolean => {
        if (!pan) return false
        const dx = event.clientX - pan.x
        const dy = event.clientY - pan.y
        if (!pan.moved && Math.hypot(dx, dy) < PAN_THRESHOLD) return true
        if (!pan.moved) setPan({ ...pan, moved: true })
        update(() => panView(pan.view, bounds, -dx * pan.unitsPerPx, -dy * pan.unitsPerPx))
        return true
    }

    /** Fin d'appui : `"click"` s'il n'y a pas eu de glisser, `null` si rien n'était en cours. */
    const endPan = (event: ReactPointerEvent): "click" | "pan" | null => {
        if (!pan) return null
        svgRef.current?.releasePointerCapture(event.pointerId)
        setPan(null)
        return pan.moved ? "pan" : "click"
    }

    return {
        view,
        zoom,
        panning: Boolean(pan?.moved),
        startPan,
        movePan,
        endPan,
        zoomIn: () => update((v) => zoomCenter(v, bounds, 1.5)),
        zoomOut: () => update((v) => zoomCenter(v, bounds, 1 / 1.5)),
        reset: () => update(() => fullView(bounds)),
    }
}
