import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Button } from "@/shared/ui/atoms/button"
import { cn } from "@/shared/lib/utils"

export interface BoardHeaderAction {
    label: string
    onClick: () => void
    icon?: LucideIcon
}

interface BoardHeaderProps {
    title: string
    description?: ReactNode
    /** Classes de titre/description, fournies par le thème du module. */
    theme: { title: string; description: string }
    /** Bouton principal, rendu à droite. Absent = pas de bouton (droits manquants). */
    action?: BoardHeaderAction
    /** Contenu libre à droite, avant l'action (compteur, bascule de vue…). */
    trailing?: ReactNode
    /**
     * Pastille rendue AVANT le titre. Sert aux boards qui se répètent sur un
     * même écran et que seule une couleur distingue (arrivages / départs du
     * flux handpick) : sans elle, deux en-têtes voisins ne se différencient que
     * par leur libellé.
     */
    leading?: ReactNode
    className?: string
}

/**
 * En-tête d'un onglet : titre, sous-titre, action principale.
 *
 * Chaque écran posait le sien à la main, d'où des échelles typographiques qui
 * divergeaient entre modules (`text-xl font-bold` d'un côté, `text-base
 * font-semibold` de l'autre) alors que rien ne le justifiait. Les classes
 * viennent du thème du module appelant — le composant impose la structure et
 * le comportement responsive, pas la couleur.
 *
 * Sur mobile, la rangée d'actions passe à la ligne : les boutons secondaires
 * (`trailing`) restent groupés et l'action principale prend une ligne pleine
 * largeur en dessous. Sans ce retour, trois boutons plus l'action débordaient
 * d'un écran de 375 px.
 */
export function BoardHeader({
    title,
    description,
    theme,
    action,
    trailing,
    leading,
    className,
}: BoardHeaderProps) {
    const ActionIcon = action?.icon

    return (
        <div
            className={cn(
                "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
                className,
            )}
        >
            <div className="flex min-w-0 items-center gap-2">
                {leading}
                <div className="min-w-0">
                    <h2 className={theme.title}>{title}</h2>
                    {description && <div className={theme.description}>{description}</div>}
                </div>
            </div>

            {(trailing || action) && (
                <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
                    {trailing}
                    {action && (
                        <Button
                            className="w-full gap-2 shadow-sm sm:w-auto"
                            onClick={action.onClick}
                        >
                            {ActionIcon && <ActionIcon size={16} />}
                            {action.label}
                        </Button>
                    )}
                </div>
            )}
        </div>
    )
}
