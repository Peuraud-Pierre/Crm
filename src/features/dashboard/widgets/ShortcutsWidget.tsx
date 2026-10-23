import { Link } from "react-router"
import { Compass } from "lucide-react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { applySelection, parseList } from "@/shared/lib/settingsList"
import { cn } from "@/shared/lib/utils"
import type { WidgetProps } from "@/shared/types/widget.types"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

/**
 * Accès direct aux modules auxquels l'utilisateur a droit.
 *
 * Aucune liste à maintenir : `allowedRoutes` est déjà le résultat du
 * croisement entre `menuItems.ts` et les permissions de l'utilisateur,
 * calculé une fois par `AuthProvider`. Ajouter une feature à
 * `menuItems` la fait apparaître ici aussi.
 *
 * Les entrées masquées de la sidebar (`hideFromSidebar`, comme le profil)
 * sont écartées : ce widget double la navigation, il ne l'élargit pas.
 *
 * L'utilisateur peut ensuite choisir lesquelles garder (réglage `items`).
 * Ce choix ne peut jamais élargir ses droits : il ne fait que restreindre
 * une liste déjà filtrée par permission. Un raccourci enregistré dont la
 * permission a été retirée sort de `allowedRoutes`, donc disparaît de
 * lui-même — aucune disposition à nettoyer en base.
 */
export default function ShortcutsWidget({ height, settings }: WidgetProps) {
    const { allowedRoutes } = useAuth()

    const list = settings.display === "list"
    const limit = typeof settings.limit === "number" ? settings.limit : 0

    const visible = allowedRoutes.filter((item) => !item.hideFromSidebar)
    const selected = applySelection(
        visible,
        parseList(settings.items),
        (item) => item.title
    )
    const shortcuts = limit > 0 ? selected.slice(0, limit) : selected

    if (shortcuts.length === 0) {
        return (
            <EmptyState
                size="sm"
                icon={Compass}
                // Deux causes possibles, deux sorties différentes : soit
                // le compte n'a droit à rien, soit la sélection ne
                // correspond plus à rien. `variant="search"` annonce la
                // seconde comme un résultat de filtre (DESIGN_SYSTEM §13.8).
                variant={visible.length > 0 ? "search" : "default"}
                title={
                    visible.length > 0
                        ? "Aucun raccourci sélectionné"
                        : "Aucun raccourci"
                }
                description={
                    visible.length > 0
                        ? "Les raccourcis choisis ne sont plus disponibles. Modifiez la sélection dans les réglages."
                        : "Les modules auxquels vous avez accès apparaîtront ici."
                }
            />
        )
    }

    return (
        <div
            className="grid gap-2 p-3"
            style={{
                // En liste, une seule colonne quelle que soit la place.
                // En grille, le nombre de colonnes suit la hauteur
                // allouée : un module haut et étroit en veut une, un
                // module plat en veut plusieurs.
                gridTemplateColumns: list
                    ? "1fr"
                    : `repeat(auto-fill, minmax(${height > 4 ? 8 : 10}rem, 1fr))`,
            }}
        >
            {shortcuts.map((item) => {
                const Icon = item.icon
                return (
                    <Link
                        key={item.title}
                        to={item.href}
                        className={cn(
                            "flex items-center gap-2 rounded-lg border border-border/60 p-2.5 text-sm",
                            "transition-colors duration-fast hover:border-border hover:bg-accent hover:text-accent-foreground",
                            "focus-visible:bg-accent focus-visible:outline-none"
                        )}
                    >
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{item.displayName}</span>
                    </Link>
                )
            })}
        </div>
    )
}
