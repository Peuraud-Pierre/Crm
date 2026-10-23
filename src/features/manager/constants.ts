/**
 * Registre central des codes de permission et des slugs d'onglets de la
 * console Manager. Aucun littéral de permission dans les composants.
 */
export const MANAGER_PERMISSIONS = {
    /** Accès à la console. */
    view: "manager.view",
    /** Onglet Changelog. */
    changelog: "manager.changelog",
    /** Onglet Annonces. */
    announcements: "manager.annonce",
    /** Onglet Maintenance. */
    maintenance: "manager.maintenance",
    /** Console d'erreurs (route dédiée `/error-console`). */
    console: "manager.console",
    /**
     * Onglet « Gen Types ».
     *
     * Remplace le gate `user.role === "Super Admin"` — dernière
     * comparaison sur un libellé de rôle de l'application. Le code est
     * créé et attribué au rôle « Super Admin » par la migration
     * 20260824107000, donc à comportement constant.
     */
    genTypes: "manager.gen_types",
    /** Onglet « Tableaux de bord » : gabarits par rôle/service. */
    dashboardTemplates: "dashboard.templates.manage",
} as const

/** Slugs d'onglets de la page `/manager/:tab?`. */
export const MANAGER_TABS = {
    changelog: "changelog",
    maintenance: "maintenance",
    announcements: "annonces",
    dashboardTemplates: "tableaux-de-bord",
    genTypes: "gen-types",
} as const

export type ManagerTab = (typeof MANAGER_TABS)[keyof typeof MANAGER_TABS]
