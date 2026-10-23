import type { Tables, TablesInsert } from "@/integrations/supabase/types"

/**
 * Portée d'une fenêtre de maintenance.
 * - `global`  : toute l'application est coupée (feature_key null).
 * - `feature` : une seule feature est coupée (feature_key renseigné).
 *
 * Contraint par CHECK en base mais typé `string` dans les types générés —
 * l'union est rétablie ici (même parti pris que `ProfileStatus` dans
 * `features/administration/types.ts`).
 */
export type MaintenanceScope = "global" | "feature"

/** Une fenêtre de maintenance telle qu'elle vit en base. */
export type MaintenanceWindow = Omit<Tables<"app_maintenance">, "scope"> & {
    scope: MaintenanceScope
}

/**
 * Champs saisissables à la création. `scope`/`feature_key` sont portés
 * par le discriminant ci-dessous plutôt que librement combinables : la
 * base refuse (CHECK app_maintenance_scope_key_coherent) une portée
 * globale avec une feature, et l'inverse.
 */
export type MaintenanceDraft = Pick<
    TablesInsert<"app_maintenance">,
    "starts_at" | "ends_at" | "message" | "active"
> &
    (
        | { scope: "global"; feature_key?: null }
        | { scope: "feature"; feature_key: string }
    )

/** Champs modifiables sur une fenêtre existante. */
export type MaintenanceUpdate = Partial<
    Pick<
        Tables<"app_maintenance">,
        "active" | "starts_at" | "ends_at" | "message"
    >
>

/**
 * État résolu exposé aux consommateurs (app-shell, dashboard).
 *
 * `byFeature` est indexé par la clé de feature — c'est-à-dire `title` de
 * `menuItems.ts`, le registre central des features de l'application.
 */
export interface MaintenanceState {
    /** Fenêtre globale, ou null si aucune n'est programmée. */
    global: MaintenanceWindow | null
    /** Fenêtres par feature, indexées par `feature_key`. */
    byFeature: Record<string, MaintenanceWindow>
}
