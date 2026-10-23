/**
 * Contrat de navigation des modules à onglets.
 *
 * Pourquoi ce fichier existe
 * --------------------------
 * `features/stock` et `features/stock_handpick` portaient chacun sa propre
 * définition d'onglet (`StockTabDef` / `HandpickTabDef`) — identiques au
 * commentaire près — et chacun son propre algorithme de canonicalisation
 * d'URL, recopié mot pour mot. Deux implémentations d'une même règle finissent
 * toujours par diverger, et celle-ci porte un piège documenté (voir
 * `shared/lib/tabbedModule.ts`) qu'on ne veut pas avoir à redécouvrir dans un
 * troisième module.
 *
 * Ce fichier ne contient que des types : il est importable depuis une feature
 * sans créer de dépendance vers `app/`.
 */

/** Un onglet du module : son adresse, son gating, ses sous-sections admises. */
export interface TabDef<Id extends string> {
    id: Id
    /** Segment d'URL — `/<routeBase>/:section?/:detail?` */
    section: string
    /** Permission requise ; absente = visible dès l'accès au module. */
    permission?: string
    /** Onglet encore en chantier, masqué hors développement. */
    devOnly?: boolean
    /**
     * Valeurs admises pour le segment `detail`, la première faisant office de
     * défaut. Réservé aux onglets dont le détail est une sous-section fermée
     * (Paramètres) — pas à ceux dont le détail est un id libre (Flux).
     */
    details?: readonly string[]
}

export interface TabbedModuleConfig<Id extends string> {
    /** Base d'URL du module — `/stock`, `/stock-handpick`. */
    routeBase: string
    tabs: readonly TabDef<Id>[]
    /** Onglet servi quand l'URL ne désigne aucun onglet visible. */
    defaultTab: Id
    /**
     * Segments d'URL historiques → segment courant. Optionnel : seul le stock
     * principal en a. Absent, aucune traduction n'a lieu — exactement le
     * comportement du handpick, qui n'a pas d'historique d'URL à préserver.
     */
    legacySections?: Readonly<Record<string, string>>
}
