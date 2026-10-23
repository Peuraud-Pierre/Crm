import { useLayoutEffect, useRef } from "react"
import { EASE } from "@/shared/lib/motion"

/** Durée du trajet centre → place définitive (s). */
export const CENTER_MOVE_S = 0.9

/** Largeur du logo au centre : une part de l'écran, plafonnée. */
const CENTER_WIDTH = { phone: 0.78, wide: 0.5 }
const CENTER_MAX_PX = 760
const MAX_SCALE = 1.8

/** Token `emphasized` (DESIGN_SYSTEM.md §13.1), au format de la Web Animations API. */
const EASING = `cubic-bezier(${EASE.emphasized.join(", ")})`

/**
 * Intro « au centre, puis à sa place » du logo des écrans d'auth.
 *
 * Le logo est rendu à sa place définitive (la mise en page ne bouge pas),
 * puis, avant la première peinture, on mesure cette place et on le décale
 * au centre de l'écran, agrandi : il s'y dessine. Après `delayMs`, il
 * rejoint sa place, vers la gauche sur grand écran et vers le haut sur
 * téléphone, pendant que la page s'ouvre autour de lui (AuthShell).
 *
 * Web Animations API sur `transform` (technique FLIP), et non une animation
 * pilotée en JavaScript : le navigateur la confie au compositeur, elle reste
 * fluide même quand le fil principal est occupé (montage de la page,
 * chargement du captcha sur une connexion lente).
 */
export function useCenteredIntro(active: boolean, delayMs: number) {
    const ref = useRef<HTMLDivElement>(null)

    useLayoutEffect(() => {
        const el = ref.current
        if (!active || !el || typeof el.animate !== "function") return
        const rect = el.getBoundingClientRect()
        // Pas de mise en page (jsdom, élément masqué) : rien à centrer.
        if (rect.width === 0) return

        const vw = window.innerWidth
        const vh = window.innerHeight
        const share = vw < 640 ? CENTER_WIDTH.phone : CENTER_WIDTH.wide
        const target = Math.max(rect.width, Math.min(vw * share, CENTER_MAX_PX))
        const dx = vw / 2 - (rect.left + rect.width / 2)
        const dy = vh / 2 - (rect.top + rect.height / 2)
        const scale = Math.min(target / rect.width, MAX_SCALE)

        // `backwards` : la position centrée s'applique dès maintenant, avant
        // la première peinture, et tient pendant tout le délai du tracé.
        const move = el.animate(
            [{ transform: `translate(${dx}px, ${dy}px) scale(${scale})` }, { transform: "none" }],
            { delay: delayMs, duration: CENTER_MOVE_S * 1000, easing: EASING, fill: "backwards" }
        )
        return () => move.cancel()
    }, [active, delayMs])

    return ref
}
