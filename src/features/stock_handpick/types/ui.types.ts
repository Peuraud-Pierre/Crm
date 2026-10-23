import { STOCK_HANDPICK_PERMISSIONS as P } from "@/features/stock_handpick/constants"
import type { TabDef, TabbedModuleConfig } from "@/shared/types/tabbed-module.types"

// Types liés à l'interface du module et à sa navigation.

export type HandpickTab =
    | "dashboardTab" | "inventaireTab" | "planTab" | "codesTab" | "historiqueTab" | "settingsTab"

/** Sous-sections de l'onglet Paramètres ; la première est le défaut. */
export const HANDPICK_SETTINGS_SECTIONS = ["fournisseurs", "categories"] as const
export type HandpickSettingsSection = (typeof HANDPICK_SETTINGS_SECTIONS)[number]

/**
 * Définition d'un onglet — voir `shared/types/tabbed-module.types.ts`. SOURCE
 * UNIQUE du gating et de la navigation : le stock principal a dû corriger une
 * duplication entre son composant de route (onglets atteignables par URL) et
 * son composant Tabs (onglets rendus), les deux pouvant diverger.
 */
export type HandpickTabDef = TabDef<HandpickTab>

// L'URL est la source de vérité (voir docs/ROUTING.md) ; cette table associe
// chaque identifiant interne à son segment et porte le gating.
export const STOCK_HANDPICK_TABS: readonly HandpickTabDef[] = [
    // Construit en dernier : masqué hors dev tant qu'il n'est pas livré.
    { id: "dashboardTab",  section: "dashboard",  permission: P.dashboardView, devOnly: true },
    { id: "inventaireTab", section: "inventaire", permission: P.inventaireView },
    { id: "planTab",       section: "plan",       permission: P.planView },
    // Remplace l'onglet Flux, retiré de la navigation (son code reste dans
    // components/flux, non monté).
    { id: "codesTab",      section: "codes",      permission: P.planView },
    { id: "historiqueTab", section: "historique", permission: P.historyView },
    {
        id: "settingsTab",
        section: "parametres",
        permission: P.settingsView,
        details: HANDPICK_SETTINGS_SECTIONS,
    },
]

/** Onglet servi quand l'URL ne désigne aucun onglet visible. */
export const DEFAULT_HANDPICK_TAB: HandpickTab = "inventaireTab"

/** Base d'URL du module — évite d'éparpiller le littéral dans les navigate(). */
export const HANDPICK_ROUTE_BASE = "/stock-handpick"

/**
 * Descripteur consommé par `app/routes/layouts/TabbedModuleRoute`. Pas de
 * `legacySections` : ce module est neuf, aucune URL de l'ancien vocabulaire ne
 * circule dans des favoris ou des notifications.
 */
export const STOCK_HANDPICK_MODULE: TabbedModuleConfig<HandpickTab> = {
    routeBase: HANDPICK_ROUTE_BASE,
    tabs: STOCK_HANDPICK_TABS,
    defaultTab: DEFAULT_HANDPICK_TAB,
}

export type HandpickDisplayStyle = "table" | "grid"
