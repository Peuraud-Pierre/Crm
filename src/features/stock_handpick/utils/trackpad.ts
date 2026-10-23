/**
 * Gestes du pavé tactile (et de la souris) sur les vues du plan.
 *
 * Sur Mac, le pavé tactile n'émet que des événements `wheel` :
 *  • pincer → `wheel` avec `ctrlKey` (Chrome, Firefox, Edge) ; Safari émet à
 *    la place des `gesturestart` / `gesturechange` porteurs d'un `scale` ;
 *  • glisser à deux doigts → `wheel` en pixels (`deltaMode` 0), avec des
 *    deltas fins et souvent un `deltaX`.
 * Une molette de souris émet des crans : deltas entiers et larges, ou en
 * lignes (`deltaMode` 1, Firefox).
 *
 * Pour ne pas confisquer le défilement de la page, le glisser n'est capté que
 * si la vue est ACTIVE (l'utilisateur a cliqué dedans). Le pincer est
 * toujours capté : sans quoi il zoomerait la page entière.
 */

export type WheelIntent = "zoom" | "pan" | "rotate" | "ignore"

export interface WheelLike {
    ctrlKey: boolean
    metaKey: boolean
    altKey: boolean
    deltaMode: number
    deltaX: number
    deltaY: number
}

/** Seuil sous lequel un delta vertical ressemble à un doigt, pas à un cran. */
const TRACKPAD_MAX_STEP = 40

export function looksLikeTrackpad(event: WheelLike): boolean {
    if (event.deltaMode !== 0) return false
    return (
        event.deltaX !== 0 ||
        !Number.isInteger(event.deltaY) ||
        Math.abs(event.deltaY) < TRACKPAD_MAX_STEP
    )
}

export function wheelIntent(event: WheelLike, active: boolean): WheelIntent {
    if (event.ctrlKey || event.metaKey) return "zoom"
    if (!active) return "ignore"
    if (!looksLikeTrackpad(event)) return "zoom"
    return event.altKey ? "rotate" : "pan"
}

/** Deltas ramenés en pixels, quel que soit `deltaMode`. */
export function wheelPixels(event: WheelLike): { dx: number; dy: number } {
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1
    return { dx: event.deltaX * unit, dy: event.deltaY * unit }
}

/**
 * Facteur multiplicatif d'un zoom : < 1 rapproche, > 1 éloigne. Le pincer
 * produit de petits deltas, un cran de molette de grands : les deux sont
 * bornés pour rester fluides.
 */
export function wheelZoomFactor(dy: number): number {
    const clamped = Math.max(-100, Math.min(100, dy))
    return Math.exp(clamped * 0.01)
}

interface SafariGestureEvent extends Event {
    scale: number
}

/**
 * Pincer sur Safari : `onScale` reçoit le facteur de zoom entre deux
 * événements (> 1 = les doigts s'écartent). Rend la fonction de nettoyage.
 */
export function bindSafariPinch(element: HTMLElement | SVGElement, onScale: (ratio: number) => void): () => void {
    let last = 1
    const start = (event: Event) => {
        event.preventDefault()
        last = 1
    }
    const change = (event: Event) => {
        event.preventDefault()
        const scale = (event as SafariGestureEvent).scale
        if (!scale) return
        onScale(scale / last)
        last = scale
    }
    element.addEventListener("gesturestart", start)
    element.addEventListener("gesturechange", change)
    element.addEventListener("gestureend", start)
    return () => {
        element.removeEventListener("gesturestart", start)
        element.removeEventListener("gesturechange", change)
        element.removeEventListener("gestureend", start)
    }
}
