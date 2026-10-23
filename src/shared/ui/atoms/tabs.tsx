import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { LiquidTabsIndicator } from "@/shared/ui/molecules/liquid-tabs-indicator"
import { cn } from "@/shared/lib/utils"

const Tabs = TabsPrimitive.Root

interface TabsListProps extends React.ComponentProps<typeof TabsPrimitive.List> {
    /**
     * Affiche la pastille « liquid glass » qui glisse derrière l'onglet actif.
     *
     * Opt-in : l'indicateur remplace le fond plein de l'onglet actif, donc il
     * neutralise `data-[state=active]:bg-background` sur les triggers. Ce
     * n'est pas un défaut parce que certaines `TabsList` passent à la ligne
     * (`flex-wrap`) ou débordent, cas où la mesure `offsetLeft` place la
     * pastille au mauvais endroit — chaque liste doit être vue une fois avant
     * d'être basculée. Voir DESIGN_SYSTEM.md §13.
     */
    indicator?: boolean
    /** Classes appliquées à la pastille (forme, marges internes). */
    indicatorClassName?: string
    /**
     * `underline` : onglets soulignés au lieu de la pastille pleine, pour les
     * barres collées en haut d'un panneau (fiche client, feuilles de détail),
     * où une pastille flotterait au milieu d'une bordure. Le style est porté
     * par la liste : il était auparavant recopié sur chaque trigger, à
     * l'identique, dans chaque barre concernée.
     */
    variant?: "pill" | "underline"
}

function TabsList({
    className,
    indicator = false,
    indicatorClassName,
    variant = "pill",
    children,
    ref,
    ...props
}: TabsListProps) {
    const innerRef = React.useRef<HTMLDivElement | null>(null)

    // Le ref reçu du consommateur reste honoré : on branche le nôtre en plus,
    // sinon activer `indicator` casserait tout appelant qui mesure la liste.
    const setRefs = React.useCallback(
        (node: HTMLDivElement | null) => {
            innerRef.current = node
            if (typeof ref === "function") ref(node)
            else if (ref) (ref as React.RefObject<HTMLDivElement | null>).current = node
        },
        [ref]
    )

    return (
        <TabsPrimitive.List
            ref={setRefs}
            className={cn(
                "relative inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
                // Porté par la liste et non par chaque trigger : sans ça, le
                // fond plein de l'onglet actif se superpose à la pastille et
                // chaque consommateur devrait répéter ces classes.
                // `text-sidebar-accent-foreground` n'est pas cosmétique : la
                // pastille peint `bg-sidebar-accent/85` (vert sombre) et on vient
                // de neutraliser le fond du trigger, donc le
                // `data-[state=active]:text-foreground` de la base tomberait sur
                // du vert sombre — ~2:1 en thème clair, sous le seuil WCAG AA.
                // Porté ici plutôt qu'au site d'appel : 5 des 6 premières
                // activations avaient oublié de compenser.
                variant === "underline" &&
                    "h-auto rounded-none bg-transparent p-0 [&_[role=tab]]:h-full [&_[role=tab]]:rounded-none [&_[role=tab]]:border-b-2 [&_[role=tab]]:border-transparent [&_[role=tab]]:shadow-none [&_[role=tab][data-state=active]]:border-primary [&_[role=tab][data-state=active]]:bg-transparent [&_[role=tab][data-state=active]]:shadow-none",
                indicator &&
                    "[&_[role=tab]]:relative [&_[role=tab]]:z-10 [&_[role=tab][data-state=active]]:bg-transparent [&_[role=tab][data-state=active]]:shadow-none [&_[role=tab][data-state=active]]:text-sidebar-accent-foreground",
                className
            )}
            {...props}
        >
            {indicator && (
                <LiquidTabsIndicator
                    containerRef={innerRef}
                    className={indicatorClassName}
                />
            )}
            {children}
        </TabsPrimitive.List>
    )
}

function TabsTrigger({
    className,
    ref,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
    return (
        <TabsPrimitive.Trigger
            ref={ref}
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-[color,background-color,box-shadow] duration-base ease-emphasized focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
                className
            )}
            {...props}
        />
    )
}

function TabsContent({
    className,
    ref,
    ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
    return (
        <TabsPrimitive.Content
            ref={ref}
            className={cn(
                // Fondu d'entrée intégré ici plutôt que recopié dans chaque feature :
                // la même constante était dupliquée dans 4 fichiers du CRM, avec une
                // 5e variante divergente. Voir DESIGN_SYSTEM.md §13.
                "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 data-[state=active]:animate-in data-[state=active]:fade-in-0 duration-slow ease-emphasized",
                className
            )}
            {...props}
        />
    )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
