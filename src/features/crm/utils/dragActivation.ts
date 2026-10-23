/**
 * Activation d'un geste de drag/resize dans les grilles horaires de l'agenda
 * (vues Jour et Semaine, et grille du dialogue de création).
 *
 * Pourquoi ce module : les vues implémentent leur propre drag à la main sur
 * des positions absolues en px, ce que dnd-kit ne modélise pas — on ne peut
 * donc pas y déléguer. En revanche la *sémantique d'activation* de dnd-kit est
 * la bonne, et c'est elle qu'on reprend ici, en un seul endroit plutôt que
 * dupliquée dans chaque handler :
 *
 * - souris : le geste démarre dès 5 px de mouvement (immédiat, comme avant) ;
 * - tactile : le geste ne démarre qu'après un appui long de 250 ms resté
 *   quasi-immobile. Avant ça le doigt appartient au scroll natif de la grille.
 *
 * Sans cette distinction, un simple scroll posé sur un RDV dépassait le seuil
 * de 5 px et déplaçait le rendez-vous — jusqu'à l'écrire en base au relâchement.
 */

/** Souris : distance avant que le geste ne soit considéré comme un drag. */
export const MOUSE_ACTIVATION_DISTANCE_PX = 5

/** Tactile : durée d'appui avant activation du drag. */
export const TOUCH_ACTIVATION_DELAY_MS = 250

/**
 * Tactile : tolérance de mouvement pendant l'appui long. Au-delà, le geste est
 * un scroll et l'activation est abandonnée définitivement (pas de reprise :
 * sinon un scroll qui ralentit finirait par déclencher le drag).
 */
export const TOUCH_ACTIVATION_TOLERANCE_PX = 10

/** Distance de mouvement avant de figer l'axe dominant d'un drag tactile. */
export const AXIS_LOCK_THRESHOLD_PX = 15

export interface PointerPosition {
    x: number
    y: number
}

/** `true` si l'évènement provient d'un doigt plutôt que d'une souris. */
export const isTouchEvent = (
    e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent
): e is React.TouchEvent | TouchEvent => "touches" in e

/**
 * Coordonnées du pointeur, souris ou premier doigt. Remplace les répétitions
 * de `"touches" in e ? e.touches[0].clientY : e.clientY` dans chaque handler.
 */
export const getPointerPosition = (
    e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent
): PointerPosition => {
    if (isTouchEvent(e)) {
        // touchend/touchcancel n'ont plus de `touches` : on retombe sur le
        // dernier point connu via changedTouches.
        const touch = e.touches[0] ?? e.changedTouches?.[0]
        return { x: touch?.clientX ?? 0, y: touch?.clientY ?? 0 }
    }
    return { x: e.clientX, y: e.clientY }
}

export interface DragActivation {
    /** Le geste est-il devenu un drag effectif ? */
    readonly isActive: boolean
    /** Le geste a-t-il été abandonné (scroll tactile détecté) ? */
    readonly isCancelled: boolean
    /**
     * À appeler à chaque mouvement, avec le delta depuis le point de départ.
     * Renvoie `true` si le drag est actif (donc si le mouvement doit être
     * appliqué à l'élément).
     */
    update: (deltaX: number, deltaY: number) => boolean
    /** Abandonne le geste et libère le timer. Idempotent. */
    cancel: () => void
}

interface DragActivationOptions {
    isTouch: boolean
    /** Appelé une seule fois, au moment exact où le drag devient effectif. */
    onActivate?: () => void
}

/**
 * Crée le suivi d'activation d'un geste. À instancier au `mousedown` /
 * `touchstart`, puis à nourrir dans le `mousemove` / `touchmove`, et à
 * `cancel()` dans le teardown.
 */
export function createDragActivation({
    isTouch,
    onActivate,
}: DragActivationOptions): DragActivation {
    let isActive = false
    let isCancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const clearTimer = () => {
        if (timer !== null) {
            clearTimeout(timer)
            timer = null
        }
    }

    const activate = () => {
        if (isActive || isCancelled) return
        clearTimer()
        isActive = true
        onActivate?.()
    }

    if (isTouch) {
        timer = setTimeout(activate, TOUCH_ACTIVATION_DELAY_MS)
    }

    return {
        get isActive() {
            return isActive
        },
        get isCancelled() {
            return isCancelled
        },
        update(deltaX, deltaY) {
            if (isActive || isCancelled) return isActive

            const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY))

            if (isTouch) {
                // Le doigt a bougé avant la fin de l'appui long : c'est un
                // scroll, on rend la main au navigateur pour de bon.
                if (distance > TOUCH_ACTIVATION_TOLERANCE_PX) {
                    isCancelled = true
                    clearTimer()
                }
                return false
            }

            if (distance > MOUSE_ACTIVATION_DISTANCE_PX) activate()
            return isActive
        },
        cancel() {
            isCancelled = true
            clearTimer()
        },
    }
}

export type DragAxis = "x" | "y"

export interface AxisLock {
    /** Axe figé, ou `null` tant que le mouvement est trop faible pour trancher. */
    readonly axis: DragAxis | null
    update: (deltaX: number, deltaY: number) => DragAxis | null
}

/**
 * Fige l'axe dominant d'un geste dès qu'il dépasse `threshold`. Sert en vue
 * Semaine, où le delta horizontal change le RDV de jour : sans verrouillage,
 * un déplacement vertical qui dérive de quelques pixels décale le rendez-vous
 * d'une colonne.
 */
export function createAxisLock(
    threshold: number = AXIS_LOCK_THRESHOLD_PX
): AxisLock {
    let axis: DragAxis | null = null
    return {
        get axis() {
            return axis
        },
        update(deltaX, deltaY) {
            if (axis !== null) return axis
            if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) >= threshold) {
                axis = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y"
            }
            return axis
        },
    }
}

/**
 * Retour haptique court au moment où l'appui long aboutit : sur mobile c'est
 * le seul signal fiable que le RDV est « décroché » et va suivre le doigt.
 * Absent sur iOS Safari et sur desktop — d'où le garde.
 */
export function signalDragActivation(): void {
    if (
        typeof navigator !== "undefined" &&
        typeof navigator.vibrate === "function"
    ) {
        navigator.vibrate(10)
    }
}
