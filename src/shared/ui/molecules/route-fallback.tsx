import { useEffect, useState } from "react"
import { LoadingScreen } from "@/shared/ui/atoms/loading-screen"
import {
    SkeletonCard,
    SkeletonStatTiles,
    SkeletonTable,
    SkeletonText,
} from "@/shared/ui/molecules/skeleton-presets"
import { cn } from "@/shared/lib/utils"

/**
 * Délai avant affichage, en ms. Sans lui, chaque navigation vers un chunk
 * déjà en cache produit un flash de squelette — plus perturbant que le vide
 * qu'il est censé combler. En dessous de ce seuil, l'utilisateur perçoit la
 * navigation comme instantanée et ne doit rien voir du tout.
 */
const APPEARANCE_DELAY_MS = 150

/**
 * `true` seulement après `delayMs`. Les deux fallbacks du fichier partagent la
 * même temporisation ; la dupliquer ici irait contre la raison d'être du
 * module.
 */
function useDelayedVisible(delayMs: number) {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const id = setTimeout(() => setVisible(true), delayMs)
        return () => clearTimeout(id)
    }, [delayMs])

    return visible
}

export interface RouteFallbackProps {
    /** `page` sous le shell applicatif, `panel` dans un conteneur, `inline` dans une carte. */
    scope?: "page" | "panel" | "inline"
    /** Forme approchante du contenu attendu — réduit le décalage à l'arrivée. */
    shape?: "generic" | "table" | "cards" | "form"
    label?: string
}

/**
 * Fallback de `<Suspense>` pour les routes chargées en lazy.
 * Remplace les `<div>Loading...</div>` bruts des layouts.
 */
export function RouteFallback({
    scope = "page",
    shape = "generic",
    label = "Chargement…",
}: RouteFallbackProps) {
    const visible = useDelayedVisible(APPEARANCE_DELAY_MS)

    if (!visible) return null

    return (
        // Une seule région live pour tout le fallback : les presets imbriqués
        // reçoivent `announce={false}`, sinon un chargement de route annonce
        // « Chargement » jusqu'à trois fois.
        <div
            role="status"
            aria-busy="true"
            aria-label={label}
            className={cn(
                "w-full animate-in fade-in duration-base ease-out",
                scope === "page" && "flex-1 p-4 sm:p-6",
                scope === "panel" && "p-4",
                scope === "inline" && "p-2"
            )}
        >
            {shape === "table" && <SkeletonTable label={label} announce={false} />}
            {shape === "cards" && <SkeletonStatTiles label={label} announce={false} />}
            {shape === "form" && (
                <SkeletonCard lines={5} label={label} announce={false} />
            )}
            {shape === "generic" && (
                <div className="space-y-4">
                    <SkeletonText lines={2} label={label} announce={false} />
                    <SkeletonCard lines={4} label={label} announce={false} />
                </div>
            )}
        </div>
    )
}

/**
 * Variante plein écran, pour les gardes d'authentification qui bloquent le
 * rendu du shell : à ce stade il n'y a pas encore de mise en page dans
 * laquelle poser un squelette de forme.
 */
export function FullPageFallback({ label = "Chargement…" }: { label?: string }) {
    const visible = useDelayedVisible(APPEARANCE_DELAY_MS)

    if (!visible) return null

    return <LoadingScreen message={label} className="animate-in fade-in duration-base ease-out" />
}
