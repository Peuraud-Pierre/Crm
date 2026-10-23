import type { ReactNode } from "react"
import { cn } from "@/shared/lib/utils"

/**
 * Surface d'un bloc de la page : feuille posée (DESIGN.md, ombre minimale au
 * repos), titre 14px, même respiration sous le titre partout. Les panneaux
 * divergeaient (marges de titre à 8, 12 ou 16px, ombre sur un seul d'entre eux).
 */
export default function Panel({
    title,
    children,
    className,
    busy = false,
}: {
    title: ReactNode
    children: ReactNode
    className?: string
    /** Données de l'ancien filtre affichées pendant le rechargement : atténuées. */
    busy?: boolean
}) {
    return (
        <section
            aria-busy={busy}
            className={cn("rounded-lg border bg-card p-4 shadow-sm", className)}
        >
            <h2 className="mb-4 text-sm font-medium text-foreground">{title}</h2>
            <div
                className={cn(
                    "transition-opacity duration-base",
                    busy && "opacity-60"
                )}
            >
                {children}
            </div>
        </section>
    )
}
