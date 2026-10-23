import type { ReactNode } from "react"

/**
 * Section d'une fiche d'accès (utilisateur, rôle ou service) : eyebrow
 * uppercase + action optionnelle à droite. Même anatomie sur toutes les
 * fiches — c'est la signature visuelle de la page Administration.
 */
export function FicheSection({
    title,
    action,
    children,
}: {
    title: string
    action?: ReactNode
    children: ReactNode
}) {
    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {title}
                </h3>
                {action}
            </div>
            {children}
        </section>
    )
}
