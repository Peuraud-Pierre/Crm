/**
 * Registre central des codes de permission consommés par la feature
 * maintenance. Tout check `hasPermission(...)` de la feature passe par
 * ces constantes — jamais par un littéral en dur.
 */
export const MAINTENANCE_PERMISSIONS = {
    /** Programmer / activer / lever une maintenance (console Manager). */
    manage: "manager.maintenance",
    /**
     * Continuer à utiliser l'application pendant une maintenance.
     * Remplace la comparaison `user.role !== "Super Admin"` qui était le
     * seul gate par libellé de rôle de l'application.
     */
    bypass: "maintenance.bypass",
} as const

/** Nom du canal Realtime — unique par table (convention supabase-js). */
export const MAINTENANCE_CHANNEL = "app-maintenance-changes"

/** Table portant les fenêtres de maintenance. */
export const MAINTENANCE_TABLE = "app_maintenance"
