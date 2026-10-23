import { STOCK_PERMISSIONS } from "@/features/stock/constants"
import type { TabDef, TabbedModuleConfig } from "@/shared/types/tabbed-module.types"

// Types liés à l'interface utilisateur du module stock
export type stockViewMode = "balles" | "livraisons"
export type stockDisplayStyle  = "table" | "grid"

/**
 * Identifiants d'onglet, alignés sur ceux du stock handpick : les deux modules
 * exposent les mêmes onglets, leur donner des noms internes différents ne
 * rendait service à personne et compliquait la lecture croisée.
 */
export type StockTab =
    | "dashboardTab" | "inventaireTab" | "fluxTab" | "scanTab" | "historiqueTab" | "settingsTab"

/** Sous-sections de l'onglet Paramètres ; la première est le défaut. */
export const SETTINGS_SECTIONS = ["fournisseurs", "categories", "packing"] as const

/**
 * Définition d'un onglet — voir `shared/types/tabbed-module.types.ts`. Le
 * gating était auparavant dupliqué entre le composant de route (onglets
 * atteignables par URL) et le composant Tabs (onglets rendus), les deux
 * pouvant diverger : cette table en est la source unique.
 */
export type StockTabDef = TabDef<StockTab>

// L'URL est la source de vérité (voir docs/ROUTING.md) ; cette table associe
// chaque identifiant interne à son segment et porte le gating.
export const STOCK_TABS: readonly StockTabDef[] = [
    { id: "dashboardTab",  section: "dashboard",  devOnly: true },
    { id: "inventaireTab", section: "inventaire", devOnly: true },
    { id: "fluxTab",       section: "flux" },
    // Pas de permission propre : toute personne qui voit le stock peut
    // transformer ses fiches papier en Excel. Rien n'est écrit en base.
    { id: "scanTab",       section: "scan" },
    { id: "historiqueTab", section: "historique", permission: STOCK_PERMISSIONS.historyView },
    {
        id: "settingsTab",
        section: "parametres",
        permission: STOCK_PERMISSIONS.settingsView,
        details: SETTINGS_SECTIONS,
    },
]

/** Onglet servi quand l'URL ne désigne aucun onglet visible. */
export const DEFAULT_STOCK_TAB: StockTab = "fluxTab"

/**
 * Segments d'URL historiques → segment courant.
 *
 * `stock` et `arrivage` ont été renommés en `inventaire` et `flux` pour que
 * les modules de stock partagent le même vocabulaire. Ces deux segments
 * circulent dans des favoris, des liens de notification et les widgets du
 * dashboard : ils sont traduits silencieusement par la canonicalisation de
 * `TabbedModuleRoute`, **en conservant le segment `detail`** — un
 * `/stock/arrivage/{id}` pointant une sheet d'édition continue de l'ouvrir.
 *
 * À ne pas retirer sans mesurer : rien n'expire un favori.
 */
export const LEGACY_SECTIONS: Record<string, string> = {
    arrivage: "flux",
    stock: "inventaire",
}

/** Base d'URL du module — évite d'éparpiller le littéral dans les navigate(). */
export const STOCK_ROUTE_BASE = "/stock"

/**
 * Descripteur consommé par `app/routes/layouts/TabbedModuleRoute` : il porte
 * l'adresse du module, ses onglets, son onglet par défaut et ses alias
 * historiques. Les tables section↔onglet en sont dérivées à la volée
 * (`shared/lib/tabbedModule.ts`) plutôt que recopiées ici.
 */
export const STOCK_MODULE: TabbedModuleConfig<StockTab> = {
    routeBase: STOCK_ROUTE_BASE,
    tabs: STOCK_TABS,
    defaultTab: DEFAULT_STOCK_TAB,
    legacySections: LEGACY_SECTIONS,
}

// Types pour la navigation dans les paramètres du stock
export type SettingsNavItem = (typeof SETTINGS_SECTIONS)[number]
