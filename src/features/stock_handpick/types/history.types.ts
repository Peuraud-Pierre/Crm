// Journal d'activité du stock handpick (table `activity_log_handpick`,
// alimentée exclusivement par des triggers — aucune écriture depuis le client
// n'est autorisée par la RLS).

export type HandpickEntityType =
    | "balle" | "category" | "fournisseur" | "fournisseur_category"
    | "flux" | "mouvement" | "zone" | "emplacement"

export type HandpickAction = "create" | "update" | "delete"

/** Diff d'une colonne. Le trigger générique garantit cette forme. */
export interface HandpickFieldChange {
    before: unknown
    after: unknown
}

export interface HandpickActivityLog {
    id: string
    created_at: string
    user_id: string | null
    entity_type: HandpickEntityType
    /**
     * TEXT et non UUID : la liaison fournisseur↔catégorie n'a pas d'id simple,
     * son entité est identifiée par la paire « uuid:uuid ».
     */
    entity_id: string | null
    /** Libellé figé au moment de l'action : reste lisible après suppression. */
    entity_label: string | null
    action: HandpickAction
    description: string | null
    /**
     * Uniquement les colonnes modifiées (`updated_at` exclue). Null sur
     * create / delete.
     */
    changes: Record<string, HandpickFieldChange> | null

    // Jointure résolue côté service
    user_name?: string | null
}

/**
 * Actions d'un même utilisateur rapprochées dans le temps, présentées comme
 * une seule entrée du feed (fenêtre : GROUPING_WINDOW_MS).
 */
export interface HandpickLogGroup {
    id: string
    user_id: string | null
    user_name: string | null
    entity_type: HandpickEntityType
    action: HandpickAction
    /** Horodatage de l'entrée la plus récente du groupe. */
    created_at: string
    entries: HandpickActivityLog[]
}

export interface HandpickHistoryFiltersState {
    entity_type: HandpickEntityType | "all"
    action: HandpickAction | "all"
    user_id: string | "all"
    search: string
}

export const DEFAULT_HANDPICK_HISTORY_FILTERS: HandpickHistoryFiltersState = {
    entity_type: "all",
    action: "all",
    user_id: "all",
    search: "",
}

export const HANDPICK_ENTITY_LABEL: Record<HandpickEntityType, string> = {
    balle: "Balle",
    category: "Catégorie",
    fournisseur: "Usine",
    fournisseur_category: "Liaison usine / catégorie",
    flux: "Expédition",
    mouvement: "Ligne de colisage",
    zone: "Zone",
    emplacement: "Emplacement",
}

export const HANDPICK_ACTION_LABEL: Record<HandpickAction, string> = {
    create: "Création",
    update: "Modification",
    delete: "Suppression",
}
