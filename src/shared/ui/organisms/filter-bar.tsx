import { useId, type ReactNode } from "react"
import { Search, SlidersHorizontal } from "lucide-react"
import { Badge } from "@/shared/ui/atoms/badge"
import { Button } from "@/shared/ui/atoms/button"
import { Input } from "@/shared/ui/atoms/input"
import { Separator } from "@/shared/ui/atoms/separator"
import { cn } from "@/shared/lib/utils"

/** Sous-ensemble de `ModuleTheme["filterBar"]` réellement consommé ici. */
export interface FilterBarTheme {
    container: string
    search: string
    panel: string
}

interface FilterBarProps {
    theme: FilterBarTheme

    /** Champ de recherche. Omis, la barre n'en affiche aucun. */
    search?: {
        value: string
        onChange: (value: string) => void
        placeholder?: string
        ariaLabel?: string
    }

    /** Bascules de vue, rendues en tête (TabButtonGroup, segmented control…). */
    leading?: ReactNode
    /** Compteur de résultats ou actions secondaires, avant le bouton Filtres. */
    trailing?: ReactNode
    /** Action principale, poussée à droite (« Créer une balle »…). */
    action?: ReactNode

    /** Nombre de filtres actifs — le badge n'apparaît qu'au-delà de zéro. */
    activeCount: number
    open: boolean
    onOpenChange: (open: boolean) => void
    /** À false, le bouton Filtres et le panneau disparaissent (vue sans filtre). */
    filterable?: boolean

    /** Contenu du panneau repliable. */
    children?: ReactNode
}

/**
 * Barre de filtres commune aux modules de stock : une ligne compacte
 * (bascules + recherche + actions) surmontant un panneau repliable, avec un
 * badge chiffrant les filtres actifs.
 *
 * Pourquoi ce modèle plutôt que des filtres toujours visibles
 * -----------------------------------------------------------
 * Au-delà de quatre filtres, une barre à plat déborde sur deux ou trois
 * lignes et repousse le contenu ; le repli garde la densité. Le prix à payer
 * est qu'un filtre actif peut être invisible — d'où le badge, non
 * décoratif : sans lui, une liste filtrée à vide n'a aucune explication à
 * l'écran. C'est aussi pourquoi `activeCount` est requis et non optionnel.
 *
 * Le composant ne connaît aucun filtre : il fournit la coquille, le
 * comportement d'ouverture et le décompte ; le contenu du panneau reste
 * propre à chaque module.
 */
export function FilterBar({
    theme,
    search,
    leading,
    trailing,
    action,
    activeCount,
    open,
    onOpenChange,
    filterable = true,
    children,
}: FilterBarProps) {
    const panelId = useId()

    return (
        <div className={theme.container}>
            <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
                {leading}

                {search && (
                    <div className="relative w-full lg:w-56">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search.value}
                            onChange={(event) => search.onChange(event.target.value)}
                            placeholder={search.placeholder ?? "Rechercher..."}
                            aria-label={search.ariaLabel ?? search.placeholder ?? "Rechercher"}
                            className={cn("h-9 pl-9 text-xs", theme.search)}
                        />
                    </div>
                )}

                <div className="flex items-center gap-2 lg:ml-auto">
                    {trailing}

                    {filterable && (
                        <Button
                            size="sm"
                            variant={open ? "secondary" : "outline"}
                            onClick={() => onOpenChange(!open)}
                            aria-expanded={open}
                            aria-controls={panelId}
                            className="relative gap-2"
                        >
                            <SlidersHorizontal size={14} />
                            Filtres
                            {activeCount > 0 && (
                                <Badge
                                    variant="success"
                                    aria-label={`${activeCount} filtre${activeCount > 1 ? "s" : ""} actif${activeCount > 1 ? "s" : ""}`}
                                    className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center p-0 text-3xs"
                                >
                                    {activeCount}
                                </Badge>
                            )}
                        </Button>
                    )}

                    {action}
                </div>
            </div>

            {filterable && open && (
                <>
                    <Separator />
                    <div id={panelId} className={theme.panel}>
                        {children}
                    </div>
                </>
            )}
        </div>
    )
}

/**
 * Compte les filtres qui s'écartent de leur valeur par défaut.
 *
 * Générique à dessein : chaque module déclare déjà son objet de valeurs par
 * défaut (`DEFAULT_BALLE_FILTERS`, `DEFAULT_MOUVEMENT_FILTERS`…), donc la
 * convention utilisée pour dire « pas de filtre » — `"all"`, `""` ou `null` —
 * n'a pas à être connue ici. Les implémentations précédentes la codaient en
 * dur, et rataient tout filtre dont la valeur neutre sortait de la liste.
 *
 * `omit` sert aux vues qui n'exposent qu'une partie des filtres : compter un
 * filtre qu'on ne peut pas voir donnerait un badge inexplicable.
 */
export function countActiveFilters<T extends object>(
    filters: T,
    defaults: T,
    omit: readonly (keyof T)[] = [],
): number {
    return (Object.keys(defaults) as (keyof T)[]).filter(
        (key) => !omit.includes(key) && filters[key] !== defaults[key],
    ).length
}
