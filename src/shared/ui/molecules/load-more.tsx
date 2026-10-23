import { ChevronDown } from "lucide-react"
import { cn } from "@/shared/lib/utils"

interface LoadMoreProps {
    onClick: () => void
    /** Classes de la pilule, fournies par le thème du module. */
    className: string
    /** Nombre d'éléments restants, affiché entre parenthèses quand il est connu. */
    remaining?: number
    label?: string
}

/**
 * Pilule « Voir plus » des grilles de cartes.
 *
 * Règle de pagination des modules de stock, posée avec la convergence UI :
 * une **grille de cartes** se charge par paliers avec ce bouton, un
 * **tableau** se pagine par numéros de page (`atoms/pagination`). Les deux
 * modules mélangeaient les deux modèles sans critère.
 *
 * Annoncer le reste à charger n'est pas cosmétique : sans ce chiffre,
 * l'utilisateur ne sait pas s'il regarde dix éléments ou dix sur mille.
 */
export function LoadMore({ onClick, className, remaining, label = "Voir plus" }: LoadMoreProps) {
    return (
        <div className="flex w-full justify-center">
            <button type="button" onClick={onClick} className={cn(className)}>
                <ChevronDown size={18} className="mr-2" />
                {label}
                {remaining !== undefined && remaining > 0 && (
                    <span className="ml-1 tabular-nums">
                        ({remaining} restante{remaining > 1 ? "s" : ""})
                    </span>
                )}
            </button>
        </div>
    )
}
