import { useEffect, useState, type RefObject } from "react"

/**
 * Largeur réelle d'un élément, suivie au fil des redimensionnements.
 *
 * Le canevas en a besoin pour convertir des pixels en colonnes, et la
 * barre d'outils pour savoir si l'édition est possible. Une seule mesure
 * sert aux deux : deux `ResizeObserver` sur le même élément finiraient
 * par diverger d'une frame, et la poignée de redimensionnement calculerait
 * alors avec une largeur qui n'est plus celle affichée.
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
    const [width, setWidth] = useState(0)

    useEffect(() => {
        const element = ref.current
        if (!element) return

        const observer = new ResizeObserver(([entry]) => {
            // Arrondi : `contentRect.width` est fractionnaire, et un
            // dixième de pixel suffisait à déclencher un rendu de tout le
            // canevas — donc de chaque carte — sans qu'aucune position
            // n'en soit changée, `columnEdge` arrondissant de toute façon.
            // React abandonne le rendu quand la valeur est identique : la
            // stabiliser, c'est supprimer la rafale.
            setWidth(Math.round(entry.contentRect.width))
        })
        observer.observe(element)
        return () => observer.disconnect()
    }, [ref])

    return width
}
