/**
 * Registre central des codes de permission et des slugs d'onglets de la
 * feature analytics. Tout check `hasPermission(...)` passe par ces constantes —
 * jamais par un littéral en dur.
 */
export const ANALYTICS_PERMISSIONS = {
    /** Onglet « Matomo ». Ouvre aussi la page (gate de route, router.tsx). */
    matomoView: "matomo.view",
    /** Stats CRM : même droit que l'accès au CRM lui-même (route /crm). */
    crmView: "crm.view",
    /** Onglet « Statistiques Leads » (catégorie `leads_stats` en base). */
    leadsView: "leads_stats.view",
} as const

/** Slugs d'onglets de la page /analytics/:tab? */
export const ANALYTICS_TABS = {
    matomo: "matomo",
    leads: "leads",
    crm: "crm",
} as const

export type AnalyticsTab = (typeof ANALYTICS_TABS)[keyof typeof ANALYTICS_TABS]
