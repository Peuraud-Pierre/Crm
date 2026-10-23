/**
 * Packing list d'un arrivage manuel — tables `packing_list` (en-tête),
 * `packing_list_ligne` et `packing_label_category`, vue
 * `v_packing_list_summary`.
 *
 * Voir `supabase/migrations/20260915100000_stock_packing_list.sql` pour le
 * cycle de vie et les droits, `20260917100000_stock_packing_list_document_shape.sql`
 * pour la forme réelle du document fournisseur, et
 * `20260917101000_stock_packing_label_dictionary.sql` pour le tableau de
 * correspondance.
 */

export type PackingListStatus = "en_traitement" | "a_verifier" | "validee" | "echec"

/** Régime d'unité d'une ligne : son contenu se compte en pièces ou en kilos. */
export type PackingUnitKind = "pcs" | "kgs"

/**
 * Provenance de la catégorie retenue.
 *
 * `null` — l'import n'a pas tranché : la ligne peut porter une suggestion,
 *          mais `category_id` est vide et la validation reste fermée.
 * `dictionary` — correspondance exacte d'un libellé déjà validé sur un autre
 *          conteneur. Aucune relecture nécessaire : l'arbitrage a déjà eu lieu.
 * `model` — classée seule par le modèle de `packing-api`, qui ne le fait qu'au-
 *          dessus d'un seuil calibré sur sa précision MESURÉE. Visible et
 *          corrigeable : la corriger la repasse en `human`.
 * `human` — un utilisateur a tranché sur cette packing.
 */
export type PackingResolution = "dictionary" | "model" | "human"

/** Provenance de `suggested_category_id`. */
export type PackingSuggestionSource = "dictionary" | "model" | "name"

/** Une ligne de `v_packing_list_summary` : l'en-tête et ses totaux calculés. */
export interface PackingListSummary {
    id: string
    arrivage_manuel_id: string
    status: PackingListStatus
    source_filename: string | null
    error_message: string | null
    imported_by: string | null
    imported_at: string
    validated_by: string | null
    validated_at: string | null
    created_at: string
    updated_at: string
    /** Titre lu dans le fichier — à rapprocher du conteneur de l'arrivage. */
    container_label: string | null
    /** Feuille effectivement lue : « Invoice », « Sheet1 »… */
    source_sheet: string | null
    /** Nombre de colis que le fichier annonce lui-même. */
    declared_package_count: number | null

    line_count: number
    /** Lignes sans catégorie : elles seules bloquent la validation. */
    lines_unmatched: number
    /** Lignes résolues par le tableau de correspondance, sans relecture. */
    lines_from_dictionary: number
    /** Lignes classées seules par le modèle, sous garde calibrée. */
    lines_from_model: number
    /** Lignes tranchées par un humain sur cette packing. */
    lines_reviewed: number

    /** Somme des colis. La seule grandeur additive du document. */
    total_packages: number
    /** Somme des totaux des lignes en régime `pcs`. */
    total_pieces: number
    /** Somme des totaux des lignes en régime `kgs`. Souvent 0 : voir la migration. */
    total_weight_kg: number

    /** Lignes dont l'arithmétique du fichier ne tombe pas juste. */
    rows_failing_math: number
    /**
     * Colis lus moins colis annoncés par le fichier. Positif : le fichier
     * contient plus qu'il ne dit. `null` quand il n'annonce aucun total.
     */
    package_count_gap: number | null
}

export interface PackingListLigne {
    id: string
    packing_list_id: string
    /** Ordre de la ligne dans le fichier. */
    position: number
    /** Ligne Excel 1-basée, pour renvoyer l'utilisateur au document d'origine. */
    source_row: number | null
    /** Libellé tel que lu dans le fichier — ne jamais le réécrire. */
    raw_label: string
    /** Libellé normalisé : clé de regroupement et clé du dictionnaire. */
    raw_label_key: string
    raw_row: Record<string, unknown> | null

    /** Colonne QTY : nombre de colis. */
    package_count: number | null
    /** Contenu d'un colis, dans l'unité de `unit_kind`. */
    units_per_package: number | null
    unit_kind: PackingUnitKind | null
    /** Colonne TOTAL PCS/KG telle que lue, sans recalcul. */
    declared_total: number | null

    /** Catégorie proposée par le rapprochement automatique. */
    suggested_category_id: string | null
    /** Confiance du rapprochement, entre 0 et 1. */
    match_confidence: number | null
    suggestion_source: PackingSuggestionSource | null
    /** Catégorie retenue — celle qui fait foi. */
    category_id: string | null
    resolution: PackingResolution | null
    normalizer_version: number
    reviewed_at: string | null
    reviewed_by: string | null
}

/** Une entrée du tableau de correspondance libellé → catégorie. */
export interface PackingLabelMapping {
    raw_label_key: string
    normalizer_version: number
    raw_label_sample: string
    category_id: string
    hit_count: number
    /** Conteneur sur lequel la correspondance a été validée la dernière fois. */
    last_container_label: string | null
    created_at: string
    updated_at: string
}

/**
 * État d'un groupe de libellés bruts, dans l'ordre où l'écran les présente :
 * ce qui demande du travail d'abord, ce qui est acquis ensuite.
 */
export type PackingGroupState =
    /** Sans catégorie retenue : le seul vrai travail. */
    | "unmatched"
    /** Classé seul par le modèle : acquis, mais à survoler. */
    | "model"
    /** Résolu par le tableau de correspondance : zéro œil nécessaire. */
    | "dictionary"
    /** Tranché par un humain sur cette packing. */
    | "reviewed"

/** Toutes les lignes partageant un même libellé brut normalisé. */
export interface PackingGroup {
    key: string
    /** Libellé brut le plus fréquent du groupe, pour l'affichage. */
    rawLabel: string
    lignes: PackingListLigne[]
    state: PackingGroupState
    /**
     * Catégorie commune à toutes les lignes, ou `null` si le groupe est
     * mixte ou sans catégorie. Voir `mixed`.
     */
    categoryId: string | null
    suggestedCategoryId: string | null
    /** Confiance la plus basse du groupe : le maillon faible décide. */
    confidence: number | null
    /** Les lignes n'ont pas toutes la même catégorie retenue. */
    mixed: boolean
    /** Colis du groupe : la mesure de son poids dans le conteneur. */
    totalPackages: number
    totalPieces: number
    totalWeightKg: number
}

/**
 * Écart entre les totaux saisis sur l'arrivage et ceux de la packing list.
 *
 * La « Quantité » d'un arrivage est un nombre de COLIS (décision du
 * demandeur) : c'est à `total_packages` qu'elle se compare. Le poids ne se
 * compare que si la packing en porte vraiment — sur un document en pièces,
 * une absence de poids n'est pas un écart.
 */
export interface PackingGap {
    /** Colis de la packing moins colis saisis. `null` si non saisis. */
    packages: number | null
    /** Kilos de la packing moins kilos saisis. `null` si l'un des deux manque. */
    weightKg: number | null
    /** Au moins un écart dépasse la tolérance `PACKING_GAP_TOLERANCE`. */
    diverges: boolean
}

/**
 * Ce que le modèle de `packing-api` a appris (`GET /model/stats`) : l'indicateur
 * de « de moins en moins besoin de valider ».
 */
export interface PackingModelStats {
    /** Décisions humaines et entrées du tableau qui entraînent le modèle. */
    examples: number
    categories: number
    vocabulary: number
    dictionary_entries: number
    /** Propositions du modèle déjà arbitrées par un humain. */
    evidence: number
    evidence_correct: number
    overall_precision: number | null
    /** `null` : pas assez de preuves, le modèle ne classe pas seul. */
    threshold: number | null
    precision_at_threshold: number | null
    support_at_threshold: number
    target_precision: number
    min_evidence: number
    min_margin?: number
    /**
     * Réglages de garde EFFECTIFS de cette réponse. Diffèrent des réglages du
     * service quand `simulated` vaut vrai.
     */
    settings?: {
        target_precision: number
        min_evidence: number
        min_margin: number
    }
    /**
     * Vrai quand la réponse répond à une hypothèse et non à la production.
     * Sans ce drapeau, un seuil simulé s'afficherait comme le vrai.
     */
    simulated?: boolean
    recent_imports: {
        packing_list_id: string
        container_label: string | null
        imported_at: string
        lines: number
        from_dictionary: number
        from_model: number
    }[]
}

/** Réponse du service d'import (`packing-api`, ou faux import en dev). */
export interface PackingImportResult {
    packing_list_id: string
    status: PackingListStatus
}
