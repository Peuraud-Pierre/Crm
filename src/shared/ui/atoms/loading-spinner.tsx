import { cn } from "@/shared/lib/utils"

interface LoadingSpinnerProps {
    className?: string
    size?: "sm" | "md" | "lg" | "xl"
}

/**
 * Spinner indéterminé. `animate-spin` est volontairement exclu de la media
 * query `prefers-reduced-motion` de `src/index.css` : figer un indicateur de
 * chargement supprimerait l'information qu'il porte (§13.4).
 *
 * L'épaisseur du trait suit la taille — un trait de 2px sur un disque de
 * 64px se lit comme un artefact plutôt que comme un spinner.
 */
const SIZES: Record<NonNullable<LoadingSpinnerProps["size"]>, string> = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-2",
    xl: "w-16 h-16 border-4",
}

export function LoadingSpinner({ className, size = "md" }: LoadingSpinnerProps) {
    return (
        <div className={cn("flex items-center justify-center", className)}>
            <div
                className={cn(
                    "animate-spin rounded-full border-muted border-t-primary",
                    SIZES[size]
                )}
            />
        </div>
    )
}
