import type { ReactNode } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/atoms/tabs"

/**
 * Navigation principale d'un module à onglets.
 *
 * Présentation seule : ni react-router, ni `hasPermission`, ni vocabulaire
 * métier (DESIGN_SYSTEM.md §14.3). Le gating est fait en amont — ce composant
 * rend les onglets qu'on lui donne — et la navigation est remontée par
 * `onTabChange`, ce qui le garde montable dans un test sans routeur.
 *
 * L'état actif est porté par la pastille glissante de `<TabsList indicator>`
 * (§13.8). Elle se mesure sur son `offsetParent`, qui doit rester la `TabsList`
 * elle-même : **les `TabsTrigger` doivent demeurer ses enfants DIRECTS**.
 * Interposer un conteneur — le geste naturel quand on ajoute un défilement
 * horizontal ou un groupe — ne produit aucune erreur : la pastille s'affiche,
 * glisse, et se pose simplement au mauvais endroit. Un test le vérifie.
 */

export interface ModuleTabItem<Id extends string> {
    id: Id
    label: string
    icon: ReactNode
    tooltip: string
    content: ReactNode
}

/** Sous-ensemble de `ModuleTheme["tabs"]` réellement consommé ici. */
export interface ModuleTabsTheme {
    list: string
    trigger: string
}

interface ModuleTabsProps<Id extends string> {
    value: Id
    items: readonly ModuleTabItem<Id>[]
    theme: ModuleTabsTheme
    onTabChange: (id: Id) => void
}

export function ModuleTabs<Id extends string>({
    value,
    items,
    theme,
    onTabChange,
}: ModuleTabsProps<Id>) {
    return (
        <Tabs
            value={value}
            // Action utilisateur : push, pour que le bouton retour du navigateur
            // refasse le chemin inverse. Seules les corrections d'URL invalide
            // sont en replace, et elles vivent dans `TabbedModuleRoute`.
            onValueChange={(next) => onTabChange(next as Id)}
            className="w-full"
        >
            <TabsList indicator indicatorClassName="inset-y-1.5 rounded-lg" className={theme.list}>
                {items.map((item) => (
                    <TabsTrigger
                        key={item.id}
                        value={item.id}
                        title={item.tooltip}
                        className={theme.trigger}
                    >
                        <div className="opacity-80 data-[state=active]:opacity-100">
                            {item.icon}
                        </div>
                        <span className="hidden sm:block text-2xs font-medium leading-none">
                            {item.label}
                        </span>
                    </TabsTrigger>
                ))}
            </TabsList>

            <div className="mt-6">
                {items.map((item) => (
                    <TabsContent key={item.id} value={item.id}>
                        {item.content}
                    </TabsContent>
                ))}
            </div>
        </Tabs>
    )
}
