/**
 * Registre central des codes de permission consommés par la feature.
 * Tout check `hasPermission(...)` de la feature passe par ces constantes —
 * jamais par un littéral en dur.
 */
export const ADMIN_PERMISSIONS = {
    usersView: "users.view",
    usersCreate: "users.create",
    usersUpdate: "users.update",
    usersDelete: "users.delete",
    rolesServicesView: "roles_services.view",
    // Aucun code granulaire roles_services.create/update/delete n'existe en
    // base : les mutations rôles/services sont gatées par roles_services.view.
    // En introduire un = seed additif en base + changer cette seule ligne.
    rolesServicesManage: "roles_services.view",
} as const

/** Slugs d'onglets de la page /administration/:tab? */
export const ADMIN_TABS = {
    users: "utilisateurs",
    roles: "roles",
    services: "services",
    permissions: "permissions",
} as const

export type AdminTab = (typeof ADMIN_TABS)[keyof typeof ADMIN_TABS]
