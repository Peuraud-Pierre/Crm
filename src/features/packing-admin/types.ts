/**
 * Types de la console de supervision de `packing-api`.
 *
 * `PackingModelStats` n'est PAS redéclaré ici : il est importé de
 * `features/stock` et vient du même contrat `GET /model/stats`. Deux
 * déclarations du même corps de réponse finiraient par décrire deux choses
 * différentes, et c'est exactement la divergence que cette console est censée
 * rendre visible ailleurs.
 */

import type { PackingListStatus, PackingModelStats } from "@/features/stock/types/packing-list.types"

export type { PackingModelStats }

/** Onglets de la console. Le segment d'URL est le même que l'identifiant. */
export type PackingAdminTab = "pilotage" | "imports" | "ecarts" | "simulation"

/** `GET /status` — configuration effective et volumes. */
export interface PackingServiceStatus {
    service: string
    version: string
    started_at: string
    uptime_s: number
    normalizer_version: number
    config: {
        supabase_url: string
        max_upload_mb: number
        allowed_origins: string[]
        log_level: string
        log_format: string
        guard: PackingGuardSettings
    }
    model: Omit<PackingModelStats, "recent_imports">
    counts: {
        packing_lists: number
        a_verifier: number
        validee: number
        echec: number
        en_traitement: number
    }
}

export interface PackingGuardSettings {
    target_precision: number
    min_evidence: number
    min_margin: number
}

/** Une étape de `GET /model/replay` : ce que le modèle aurait fait, conteneur par conteneur. */
export interface PackingReplayStep {
    packing_list_id: string
    container_label: string | null
    imported_at: string | null
    label: string
    lines: number
    from_dictionary: number
    /** Lignes classées SEUL par le modèle, garde passée. */
    auto: number
    /** Parmi elles, celles où il avait tort. Le seul chiffre qui doit rester à zéro. */
    auto_wrong: number
    suggestions_right: number
    to_review: number
    /** Part des lignes que PERSONNE n'a eu à trancher. La mesure de la promesse. */
    untouched_share: number
    threshold: number | null
}

export interface PackingReplayReport {
    settings: PackingGuardSettings
    simulated: boolean
    total_packings: number
    returned: number
    steps: PackingReplayStep[]
}

/** Une ligne de l'historique des imports, lue dans `packing_list`. */
export interface PackingImportRow {
    id: string
    arrivage_manuel_id: string
    container_label: string | null
    source_filename: string | null
    status: PackingListStatus
    error_message: string | null
    imported_at: string
    imported_by: string | null
    /** Répartition des lignes au moment de l'import (`classifier_meta`). */
    lines: {
        dictionary: number
        model: number
        suggested: number
        none: number
    } | null
    /** Seuil en vigueur à l'import, pour situer la ligne dans l'histoire du modèle. */
    threshold: number | null
}

/**
 * Un libellé où l'humain a contredit le modèle.
 *
 * Lu dans `packing_label_feedback`, qui conserve la proposition AFFICHÉE au
 * moment de la décision : c'est ce qui permet de dire que le modèle avait tort,
 * et non de le supposer.
 */
export interface PackingModelMiss {
    packing_list_ligne_id: string
    packing_list_id: string
    raw_label_key: string
    /** Ce que l'humain a retenu. */
    category_id: string
    /** Ce que le modèle proposait. */
    suggested_category_id: string | null
    suggested_confidence: number | null
    /** Vrai quand la garde avait laissé le modèle classer seul : une erreur passée sans regard. */
    was_auto: boolean
    decided_by: string | null
    created_at: string
}

/**
 * Une correspondance du dictionnaire que des décisions humaines plus récentes
 * contredisent. Une erreur apprise une fois se répète sur tous les conteneurs
 * suivants — d'où un panneau qui la nomme.
 */
export interface PackingDictionaryConflict {
    raw_label_key: string
    raw_label_sample: string
    dictionary_category_id: string
    latest_human_category_id: string
    latest_decision_at: string
    hit_count: number
}

export type PackingAlertLevel = "error" | "warning" | "info"

export interface PackingAdminAlert {
    id: string
    level: PackingAlertLevel
    title: string
    /** Porte l'ACTION à mener, pas seulement le constat. */
    detail: string
    /** Onglet où corriger, quand il y en a un. */
    tab?: PackingAdminTab
}
