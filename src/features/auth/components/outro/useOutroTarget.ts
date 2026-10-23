import { useEffect, useRef } from "react"
import { EASE } from "@/shared/lib/motion"
import { authOutro } from "./outroStore"

const EMPHASIZED = `cubic-bezier(${EASE.emphasized.join(", ")})`

/**
 * Fait d'un bouton la cible de l'outro de connexion : le logo y vole et s'y
 * fond, puis le bouton rebondit et un halo signale l'endroit. Posé sur le
 * bouton menu de l'en-tête : la sidebar (et le logo) vit derrière lui.
 *
 * L'icône du bouton est son premier `<svg>`. Hors outro, le hook ne fait
 * rien d'autre que s'enregistrer.
 */
export function useOutroTarget<T extends HTMLElement>() {
    const ref = useRef<T>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        authOutro.registerTarget(el)

        const stopListening = authOutro.onLanded(() => {
            el.querySelector("svg")?.animate(
                [
                    { transform: "scale(0.3)", opacity: 0 },
                    { transform: "scale(1.25)", opacity: 1, offset: 0.55 },
                    { transform: "scale(1)", opacity: 1 },
                ],
                { duration: 520, easing: EMPHASIZED }
            )
            const ring = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim()
            el.animate(
                [
                    { boxShadow: `0 0 0 0 hsl(${ring} / 0.55)` },
                    { boxShadow: `0 0 0 10px hsl(${ring} / 0)` },
                ],
                { duration: 750, easing: "ease-out" }
            )
        })

        return () => {
            stopListening()
            if (authOutro.getTarget() === el) authOutro.registerTarget(null)
        }
    }, [])

    return ref
}
