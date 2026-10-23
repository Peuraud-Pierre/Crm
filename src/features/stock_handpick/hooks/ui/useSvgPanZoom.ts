import { useCallback, useEffect, useRef, useState } from "react"
import {
    bindSafariPinch,
    wheelIntent,
    wheelPixels,
    wheelZoomFactor,
} from "@/features/stock_handpick/utils/trackpad"

export interface ViewBox {
    x: number
    y: number
    w: number
    h: number
}

/** Zoom maximal par rapport à la vue d'ensemble. */
const MAX_SCALE = 6
/** Déplacement (px) au-delà duquel un appui devient un glisser. */
const DRAG_THRESHOLD = 4

function clampBox(box: ViewBox, full: ViewBox): ViewBox {
    const w = Math.min(full.w, Math.max(full.w / MAX_SCALE, box.w))
    const h = (w * full.h) / full.w
    return {
        w,
        h,
        x: Math.min(full.x + full.w - w, Math.max(full.x, box.x)),
        y: Math.min(full.y + full.h - h, Math.max(full.y, box.y)),
    }
}

/**
 * Zoom et déplacement d'un SVG par son `viewBox`, au pavé tactile et à la
 * souris (voir `utils/trackpad.ts`) :
 *  • pincer, ou Ctrl + molette → zoom centré sur le pointeur ;
 *  • deux doigts, vue active et zoomée → déplacement ;
 *  • glisser dans le vide, vue zoomée → déplacement ;
 *  • boutons : `zoomIn`, `zoomOut`, `reset`.
 *
 * La vue s'active au clic et se désactive quand le pointeur sort : le
 * défilement de la page n'est confisqué qu'à la demande.
 *
 * Changer le `viewBox` ne gêne pas l'éditeur : il convertit les coordonnées
 * par `getScreenCTM`, qui en tient compte.
 */
export function useSvgPanZoom(full: ViewBox) {
    const svgRef = useRef<SVGSVGElement>(null)
    const [view, setView] = useState<ViewBox>(full)
    const [active, setActive] = useState(false)
    const viewRef = useRef(view)
    const activeRef = useRef(false)
    const fullRef = useRef(full)

    const { x: fx, y: fy, w: fw, h: fh } = full
    // Nouvelle emprise (plan redimensionné) : on repart de la vue d'ensemble.
    useEffect(() => {
        const next = { x: fx, y: fy, w: fw, h: fh }
        fullRef.current = next
        viewRef.current = next
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        setView(next)
    }, [fx, fy, fw, fh])

    const apply = useCallback((next: ViewBox) => {
        const clamped = clampBox(next, fullRef.current)
        viewRef.current = clamped
        setView(clamped)
    }, [])

    /** Zoom de `factor` (< 1 rapproche) autour du point (cx, cy) du SVG. */
    const zoomAt = useCallback(
        (factor: number, cx?: number, cy?: number) => {
            const v = viewRef.current
            const w = v.w * factor
            const px = cx ?? v.x + v.w / 2
            const py = cy ?? v.y + v.h / 2
            apply({
                w,
                h: v.h * factor,
                x: px - ((px - v.x) * w) / v.w,
                y: py - ((py - v.y) * (v.h * factor)) / v.h,
            })
        },
        [apply],
    )

    /** Déplacement en pixels d'écran. */
    const panBy = useCallback(
        (dx: number, dy: number) => {
            const svg = svgRef.current
            const v = viewRef.current
            if (!svg || svg.clientWidth === 0) return
            const scale = v.w / svg.clientWidth
            apply({ ...v, x: v.x + dx * scale, y: v.y + dy * scale })
        },
        [apply],
    )

    useEffect(() => {
        const svg = svgRef.current
        if (!svg) return

        const toSvg = (clientX: number, clientY: number) => {
            const matrix = svg.getScreenCTM?.()
            if (!matrix) return null
            const point = svg.createSVGPoint()
            point.x = clientX
            point.y = clientY
            return point.matrixTransform(matrix.inverse())
        }
        const isZoomed = () => viewRef.current.w < fullRef.current.w - 1e-6

        const onWheel = (event: WheelEvent) => {
            const intent = wheelIntent(event, activeRef.current)
            if (intent === "ignore") return
            const { dx, dy } = wheelPixels(event)
            if (intent === "zoom") {
                event.preventDefault()
                const p = toSvg(event.clientX, event.clientY)
                zoomAt(wheelZoomFactor(dy), p?.x, p?.y)
                return
            }
            // Vue d'ensemble : rien à déplacer, la page garde son défilement.
            if (!isZoomed()) return
            event.preventDefault()
            panBy(dx, dy)
        }

        // Glisser dans le vide pour se déplacer, une fois zoomé. La capture
        // n'est prise qu'au-delà du seuil : un simple clic garde sa cible
        // (travée, élément de l'éditeur).
        let drag: { x: number; y: number; id: number; started: boolean } | null = null
        const onDown = (event: PointerEvent) => {
            activeRef.current = true
            setActive(true)
            // Un élément saisi dans l'éditeur (`data-no-pan`) se déplace,
            // lui : la vue ne doit pas bouger avec.
            const grabbed = (event.target as Element | null)?.closest?.("[data-no-pan]")
            if (isZoomed() && event.button === 0 && !grabbed) {
                drag = { x: event.clientX, y: event.clientY, id: event.pointerId, started: false }
            }
        }
        const onMove = (event: PointerEvent) => {
            if (!drag || event.pointerId !== drag.id) return
            const dx = event.clientX - drag.x
            const dy = event.clientY - drag.y
            if (!drag.started) {
                if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
                drag.started = true
                svg.setPointerCapture?.(event.pointerId)
            }
            drag.x = event.clientX
            drag.y = event.clientY
            panBy(-dx, -dy)
        }
        const onUp = (event: PointerEvent) => {
            if (drag?.started) svg.releasePointerCapture?.(event.pointerId)
            drag = null
        }
        const onLeave = () => {
            if (drag?.started) return
            activeRef.current = false
            setActive(false)
        }

        svg.addEventListener("wheel", onWheel, { passive: false })
        svg.addEventListener("pointerdown", onDown)
        svg.addEventListener("pointermove", onMove)
        svg.addEventListener("pointerup", onUp)
        svg.addEventListener("pointercancel", onUp)
        svg.addEventListener("pointerleave", onLeave)
        const unbindPinch = bindSafariPinch(svg, (ratio) => zoomAt(1 / ratio))

        return () => {
            svg.removeEventListener("wheel", onWheel)
            svg.removeEventListener("pointerdown", onDown)
            svg.removeEventListener("pointermove", onMove)
            svg.removeEventListener("pointerup", onUp)
            svg.removeEventListener("pointercancel", onUp)
            svg.removeEventListener("pointerleave", onLeave)
            unbindPinch()
        }
    }, [zoomAt, panBy])

    return {
        svgRef,
        viewBox: `${view.x} ${view.y} ${view.w} ${view.h}`,
        active,
        isZoomed: view.w < full.w - 1e-6,
        zoomIn: () => zoomAt(1 / 1.4),
        zoomOut: () => zoomAt(1.4),
        reset: () => apply(fullRef.current),
    }
}
