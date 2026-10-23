import * as React from "react"
import type { LucideIcon } from "lucide-react"
import type { ReactNode, RefObject } from "react"
import { LiquidTabsIndicator } from "@/shared/ui/molecules/liquid-tabs-indicator"
import { cn } from "@/shared/lib/utils"

interface TabButtonProps {
    id: string
    /**
     * Libellé affiché à partir de `sm`. Sous ce seuil, la bascule se réduit à
     * son icône, sauf si `shortLabel` prend le relais — c'est le contrat
     * d'origine des bascules de `stock`, où la place manque en mobile.
     */
    label?: string
    /** Libellé affiché sous `sm`, à la place de rien. */
    shortLabel?: string
    /** Infobulle ; retombe sur `label` quand elle n'est pas fournie. */
    title?: string
    /** Facultative : certaines bascules sont purement textuelles (Jour/Semaine/Mois). */
    icon?: LucideIcon
    /** Compteur ou pastille affiché après le libellé (ex. « Publiés 12 »). */
    badge?: ReactNode
    active: string
    set: (id: string) => void
}

/**
 * Bouton de bascule de vue (Balles/Livraisons, Grille/Tableau, Setters/Closers).
 *
 * Ce n'est pas un `TabsTrigger` Radix — le groupe ne pilote pas de panneaux,
 * juste un état local — mais il porte `data-state` pour que
 * `LiquidTabsIndicator` le reconnaisse comme élément actif. Le fond de l'état
 * actif vient de la pastille de `TabButtonGroup`, pas d'ici : les deux se
 * superposeraient. Voir DESIGN_SYSTEM.md §13.8.
 */
export const TabButton = ({
    id,
    label,
    shortLabel,
    title,
    icon: Icon,
    badge,
    active,
    set,
}: TabButtonProps) => (
    <button
        type="button"
        onClick={() => set(id)}
        data-state={active === id ? "active" : "inactive"}
        aria-pressed={active === id}
        className={cn(
            "relative z-10 flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md xs:flex-1 flex-none",
            "transition-colors duration-base ease-emphasized",
            // Anneau de focus clavier : la bascule n'en avait aucun.
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            active === id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
        )}
        title={title ?? label}
    >
        {Icon && <Icon size={14} />}
        {label && <span className="hidden sm:inline">{label}</span>}
        {shortLabel && <span className="sm:hidden">{shortLabel}</span>}
        {badge}
    </button>
)

/**
 * Conteneur d'un groupe de `TabButton` : pose la pastille qui glisse derrière
 * le bouton actif, exactement comme `<TabsList indicator>` le fait pour les
 * onglets Radix. Les bascules non-Radix de l'app ont ainsi le même
 * comportement visuel que ses onglets.
 */
export const TabButtonGroup = ({
    containerRef,
    className,
    children,
    ...props
}: {
    /** Doit être posé sur ce conteneur — il sert d'offsetParent à la pastille. */
    containerRef: RefObject<HTMLDivElement | null>
    className?: string
    children: ReactNode
} & Omit<React.ComponentProps<"div">, "ref" | "className" | "children">) => (
    // `relative` est baké ici et non laissé au `className` de l'appelant :
    // c'est le contrat de positionnement de la pastille (offsetParent). Un
    // appelant qui l'oublie obtient une pastille calée sur un ancêtre
    // quelconque — faux, silencieusement. `TabsList` fait de même.
    <div ref={containerRef} className={cn("relative", className)} {...props}>
        <LiquidTabsIndicator
            containerRef={containerRef}
            className="inset-y-1 rounded-md bg-background ring-1 ring-inset ring-primary/25"
        />
        {children}
    </div>
)
