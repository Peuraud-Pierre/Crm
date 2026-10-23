/**
 * Types de la salle de tri — migration `20261001100000_stock_tri.sql`.
 *
 * Une FICHE (trieur, date, horaires) porte N BALLES. Chaque balle
 * (fournisseur, catégorie, poids initial, qualité, note) est RÉPARTIE en kilos
 * entre les types de sortie (MAG, KS, SO3…). Un écart entre poids initial et
 * total réparti est admis et signalé, jamais refusé. Les totaux viennent des
 * vues `v_fiches_tri` / `v_fiches_tri_balles` : ils ne sont jamais stockés.
 */

export interface Trieur {
    id: string
    nom: string
    actif: boolean
    created_at: string
}

/** Type de sortie (MAG, KS, SO3, EXPORT…) : référentiel éditable. */
export interface TriSortie {
    id: string
    code: string
    libelle: string
    /** Fixe la colonne dans la saisie et la couleur dans les graphiques. */
    ordre: number
    actif: boolean
    created_at: string
}

export type Qualite = 1 | 2 | 3

/** Kilos d'une balle partis vers un type de sortie. */
export interface TriRepartition {
    sortie_id: string
    poids_kg: number
}

/** Ligne de `v_fiches_tri_balles` : une balle et ses totaux dérivés. */
export interface FicheTriBalle {
    id: string
    fiche_id: string
    ordre: number
    /** Le fournisseur est celui de la balle : une fiche en mêle plusieurs. */
    fournisseur_id: string
    /** `null` sans droit de lecture sur le référentiel. */
    fournisseur_nom: string | null
    category_id: string
    poids_initial_kg: number
    /** Qualité des vêtements de la balle : sert à juger chaque fournisseur. */
    qualite: Qualite
    note: string | null
    poids_reparti_kg: number
    /** Réparti − initial : négatif quand il manque des kilos. */
    ecart_kg: number
    repartition: TriRepartition[]
}

/** Ligne de `v_fiches_tri` : l'en-tête et ses totaux dérivés. */
export interface FicheTri {
    id: string
    numero: number
    /** « T-0142 ». */
    code: string
    date_tri: string
    trieur_id: string
    trieur_nom: string
    /** Fournisseurs des balles de la fiche, sans doublon. */
    fournisseur_ids: string[]
    /** « ABC, XYZ » ; `null` sans balle. */
    fournisseurs_noms: string | null
    /** `HH:MM:SS` ; les deux ou aucun. */
    heure_debut: string | null
    heure_fin: string | null
    /** Dérivée des horaires par la base. */
    duree_minutes: number | null
    created_by: string | null
    created_at: string
    updated_at: string
    poids_initial_kg: number
    poids_reparti_kg: number
    ecart_kg: number
    nb_balles: number
    nb_balles_ecart: number
    /** Moyenne pondérée par le poids initial ; `null` sans balle. */
    qualite_moyenne: number | null
}

/** Fiche avec ses balles : ce que lisent la fiche résumé et les stats. */
export interface FicheTriComplete extends FicheTri {
    balles: FicheTriBalle[]
}

/** En-tête d'une saisie, envoyé tel quel à la RPC `save_fiche_tri`. */
export interface FicheTriInput {
    id?: string
    date_tri: string
    trieur_id: string
    /** `HH:MM` ; les deux ou aucun. */
    heure_debut: string | null
    heure_fin: string | null
}

export interface FicheTriBalleInput {
    fournisseur_id: string
    category_id: string
    poids_initial_kg: number
    qualite: Qualite
    note: string | null
    repartition: TriRepartition[]
}

export interface TriFilters {
    trieurId: string | "all"
    fournisseurId: string | "all"
    categoryId: string | "all"
    sortieId: string | "all"
    /** Qualité minimale de balle (1 = toutes). */
    qualiteMin: Qualite
    /** Seulement les fiches qui portent une balle en écart. */
    ecartsSeuls: boolean
    /** Bornes incluses, `yyyy-MM-dd` ; vide = sans borne. */
    dateFrom: string
    dateTo: string
    search: string
}

/**
 * Affichage des fiches : la liste (tableau groupé par jour) ou des cartes,
 * comme les balles du stock. Préférence de lecture, pas une adresse : elle
 * n'entre pas dans l'URL.
 */
export const TRI_AFFICHAGES = ["liste", "cartes"] as const
export type TriAffichage = (typeof TRI_AFFICHAGES)[number]

/** Vues internes de la page, portées par `?vue=` (voir `TriBoard`). */
export const TRI_VUES = ["fiches", "statistiques", "referentiel"] as const
export type TriVue = (typeof TRI_VUES)[number]
