import type { TabDef, TabbedModuleConfig } from "@/shared/types/tabbed-module.types"

/**
 * Résolution d'URL des modules à onglets — pure, sans React ni routeur.
 *
 * L'URL est la source de vérité (`docs/ROUTING.md`) : c'est elle qui dit quel
 * onglet est ouvert et sur quel détail. Ce module traduit une paire
 * `(section, detail)` brute en état canonique, et c'est `TabbedModuleRoute` qui
 * se charge d'émettre la redirection quand les deux diffèrent.
 *
 * Le découpage n'est pas cosmétique : sorti de React, l'algorithme se teste en
 * table, et les cas tordus (alias historique combiné à un onglet refusé,
 * sous-section d'un autre onglet) cessent d'exiger un routeur monté.
 */

/** Table `section d'URL → identifiant d'onglet`, dérivée des définitions. */
export function sectionToTab<Id extends string>(
    tabs: readonly TabDef<Id>[],
): Record<string, Id> {
    const map: Record<string, Id> = {}
    for (const tab of tabs) map[tab.section] = tab.id
    return map
}

/** Table `identifiant d'onglet → section d'URL`, dérivée des définitions. */
export function tabToSection<Id extends string>(
    tabs: readonly TabDef<Id>[],
): Record<Id, string> {
    const map = {} as Record<Id, string>
    for (const tab of tabs) map[tab.id] = tab.section
    return map
}

export interface ResolvedTabState<Id extends string> {
    activeTab: Id
    /** Section que l'URL devrait porter pour `activeTab`. */
    canonicalSection: string
    /** Détail que l'URL devrait porter, une fois clampé sur l'onglet retenu. */
    canonicalDetail: string | undefined
}

/**
 * Détermine l'onglet actif et la forme canonique de l'URL.
 *
 * L'ordre des étapes est significatif :
 *
 *  1. **Traduction de l'alias historique en premier.** Un segment renommé
 *     (`arrivage` → `flux`) désigne le même onglet : le traduire d'emblée fait
 *     tomber la redirection vers le segment courant du calcul commun, sans
 *     branche dédiée et **sans perdre le `detail`** — un lien de notification
 *     `/stock/arrivage/{id}` continue d'ouvrir la sheet d'édition de `{id}`.
 *  2. **Gating ensuite.** Un onglet demandé mais non visible retombe sur
 *     `defaultTab`.
 *  3. **Report conditionnel du détail.** Le `detail` n'est conservé que si
 *     l'onglet demandé est bien l'onglet retenu : sinon
 *     `/stock/parametres/categories` refusé glisserait vers
 *     `/stock/flux/categories`, où « categories » serait lu comme un id.
 *  4. **Clamp sur `details`.** Pour un onglet à sous-sections fermées, une
 *     valeur inconnue retombe sur la première.
 *
 * `activeDef` est cherché dans **toutes** les définitions et non dans les
 * seules visibles : quand `defaultTab` est lui-même gaté (le cas du handpick,
 * dont l'onglet par défaut exige `inventaire.view`), le chercher parmi les
 * visibles le rendrait introuvable et ferait sauter le clamp de `details`.
 */
export function resolveTabState<Id extends string>({
    config,
    visibleTabs,
    section,
    detail,
}: {
    config: TabbedModuleConfig<Id>
    visibleTabs: readonly TabDef<Id>[]
    section: string | undefined
    detail: string | undefined
}): ResolvedTabState<Id> {
    const bySection = sectionToTab(config.tabs)

    const requestedSection = section
        ? config.legacySections?.[section] ?? section
        : undefined
    const requestedTab = requestedSection ? bySection[requestedSection] : undefined

    const activeTab =
        requestedTab && visibleTabs.some((tab) => tab.id === requestedTab)
            ? requestedTab
            : config.defaultTab

    const activeDef = config.tabs.find((tab) => tab.id === activeTab)

    const carriedDetail = requestedTab === activeTab ? detail : undefined
    const canonicalDetail = activeDef?.details
        ? carriedDetail && activeDef.details.includes(carriedDetail)
            ? carriedDetail
            : activeDef.details[0]
        : carriedDetail

    return {
        activeTab,
        canonicalSection: tabToSection(config.tabs)[activeTab],
        canonicalDetail,
    }
}

/** Chemin canonique correspondant à un état résolu. */
export function tabPath(
    routeBase: string,
    section: string,
    detail?: string,
): string {
    return `${routeBase}/${section}${detail ? `/${detail}` : ""}`
}
