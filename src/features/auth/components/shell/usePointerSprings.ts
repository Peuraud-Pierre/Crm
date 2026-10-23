import { useMotionValue, useSpring, type MotionValue } from "framer-motion"
import { useEffect, useMemo } from "react"

export interface PointerSprings {
    /** -1 (bord gauche) → 1 (bord droit), amorti. */
    x: MotionValue<number>
    /** -1 (haut) → 1 (bas), amorti. */
    y: MotionValue<number>
}

const SPRING = { stiffness: 60, damping: 18, mass: 0.6 }

/**
 * Sans mouvement pendant ce délai, le pointeur est considéré comme parti :
 * les valeurs reviennent à 0, le logo se recentre et son flottement de
 * repos reprend le dessus, au lieu de rester figé de travers.
 */
const IDLE_MS = 2500

/**
 * Position du pointeur dans la fenêtre, normalisée et amortie par un
 * ressort : partagée par le logo (parallaxe par lettre) et le halo de fond.
 * Un seul écouteur pour tout l'écran. Revient au centre après 2,5 s sans
 * mouvement. Inerte si `enabled` est faux (mouvement réduit) : les valeurs
 * restent à 0, rien ne bouge.
 */
export function usePointerSprings(enabled: boolean): PointerSprings {
    const rawX = useMotionValue(0)
    const rawY = useMotionValue(0)
    const x = useSpring(rawX, SPRING)
    const y = useSpring(rawY, SPRING)

    useEffect(() => {
        if (!enabled) {
            rawX.set(0)
            rawY.set(0)
            return
        }
        let idleTimer: ReturnType<typeof setTimeout> | undefined
        const onLeave = () => {
            clearTimeout(idleTimer)
            rawX.set(0)
            rawY.set(0)
        }
        const onMove = (e: PointerEvent) => {
            // Au doigt, le « pointeur » saute d'un tap à l'autre : la
            // parallaxe n'a de sens qu'avec une souris ou un stylet.
            if (e.pointerType === "touch") return
            rawX.set((e.clientX / window.innerWidth) * 2 - 1)
            rawY.set((e.clientY / window.innerHeight) * 2 - 1)
            clearTimeout(idleTimer)
            idleTimer = setTimeout(onLeave, IDLE_MS)
        }
        window.addEventListener("pointermove", onMove, { passive: true })
        document.documentElement.addEventListener("pointerleave", onLeave)
        return () => {
            clearTimeout(idleTimer)
            window.removeEventListener("pointermove", onMove)
            document.documentElement.removeEventListener("pointerleave", onLeave)
        }
    }, [enabled, rawX, rawY])

    // Objet stable : le fond (AuthBackdrop) relance son dessin quand il
    // change, et un objet neuf à chaque rendu effaçait le canvas à chaque
    // frappe (un flash par touche).
    return useMemo(() => ({ x, y }), [x, y])
}
