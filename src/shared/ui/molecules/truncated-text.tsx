import { useEffect, useRef, useState } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/atoms/tooltip"
import { cn } from "@/shared/lib/utils"

interface TruncatedTextProps {
    /** Le texte complet. C'est lui qui est rendu, et lui que l'infobulle répète. */
    text: string
    /** Classes du texte visible. La troncature est déjà posée. */
    className?: string
    side?: "top" | "right" | "bottom" | "left"
}

/**
 * Un texte qui se tronque sur une ligne, et qui se lit EN ENTIER à la demande.
 *
 * Pourquoi ce composant plutôt qu'un `title`
 * ------------------------------------------
 * `title` n'existe pas sur un écran tactile : rien ne le déclenche, et c'est
 * précisément là que la place manque le plus. Un nom de catégorie tronqué à
 * « Blouson matelassé sans capuc… » ne peut alors plus être vérifié — or
 * vérifier qu'une proposition à 100 % porte bien sur la bonne catégorie est
 * exactement ce qu'on demande à l'utilisateur.
 *
 * L'infobulle s'ouvre donc au SURVOL (pointeur) et au TAP (tactile), selon le
 * même montage que `InfoTooltip` : Radix ouvrirait au focus sans jamais
 * refermer sur un écran sans survol, on pilote donc l'ouverture nous-mêmes dès
 * que le pointeur est tactile, avec fermeture au tap extérieur.
 *
 * Elle ne s'ouvre que si le texte DÉBORDE réellement (`scrollWidth >
 * clientWidth`), mesuré au moment du geste : une infobulle qui répète un texte
 * déjà entièrement lisible est du bruit. La mesure est ponctuelle et ne coûte
 * rien au rendu — pas de `ResizeObserver`, qui serait un abonnement par ligne
 * de liste (DESIGN_SYSTEM.md §13.5).
 *
 * L'accessibilité au lecteur d'écran ne dépend pas de l'infobulle : le texte
 * complet est dans le DOM, `text-overflow: ellipsis` ne le tronque qu'à
 * l'écran. Le composant n'ajoute donc aucun arrêt de tabulation — sur une liste
 * de 140 cartes, ils rendraient le parcours clavier inutilisable.
 *
 * Exige un `TooltipProvider` au-dessus (l'app en pose un global dans
 * `AppProviders`).
 */
export function TruncatedText({ text, className, side = "top" }: TruncatedTextProps) {
    const [open, setOpen] = useState(false)
    const spanRef = useRef<HTMLSpanElement>(null)
    const isTouchRef = useRef(false)

    const overflows = () => {
        const node = spanRef.current
        // +1 : les largeurs fractionnaires d'un rendu zoomé donnent un écart
        // d'un sous-pixel sur un texte qui tient pourtant en entier.
        return node !== null && node.scrollWidth > node.clientWidth + 1
    }

    useEffect(() => {
        if (!open || !isTouchRef.current) return

        const closeOnOutsideTouch = (event: TouchEvent) => {
            if (!spanRef.current?.contains(event.target as Node)) setOpen(false)
        }
        document.addEventListener("touchstart", closeOnOutsideTouch)
        return () => document.removeEventListener("touchstart", closeOnOutsideTouch)
    }, [open])

    return (
        <Tooltip
            open={open}
            onOpenChange={(next) => {
                // Au tactile, c'est le tap qui décide : laisser Radix ouvrir au
                // focus laisserait une infobulle collée à l'écran.
                if (isTouchRef.current) return
                setOpen(next && overflows())
            }}
        >
            <TooltipTrigger asChild>
                <span
                    ref={spanRef}
                    // `min-w-0` : sans lui, la troncature ne se déclenche pas
                    // quand le texte est un enfant de flex — `min-width: auto`
                    // empêche l'élément de passer sous la largeur de son contenu.
                    className={cn("block min-w-0 truncate", className)}
                    onPointerDown={(event) => {
                        isTouchRef.current = event.pointerType === "touch"
                    }}
                    onClick={() => {
                        if (isTouchRef.current) setOpen((current) => !current && overflows())
                    }}
                >
                    {text}
                </span>
            </TooltipTrigger>
            <TooltipContent side={side} className="max-w-xs text-xs break-words">
                {text}
            </TooltipContent>
        </Tooltip>
    )
}
