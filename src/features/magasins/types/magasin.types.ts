// Modèle des magasins et de leur plan (migration 20261007100000_magasins).
//
// Même découpage que le plan du stock handpick : des conteneurs en arbre
// (zone › rayon › portant — `etagere` en base) et des emplacements, seules feuilles. Différence :
// la géométrie est ABSOLUE, en mètres, dans le repère du magasin (origine coin
// haut-gauche, x → droite, y ↓ bas).

export type ZoneKind = "zone" | "rayon" | "etagere"

/** Équipements du plan : rien ne s'y range, ils se placent seulement. */
export type EquipementKind = "caisse" | "entree" | "sortie" | "entree_sortie" | "escalier" | "escalier_colimacon" | "mannequin"

export interface Magasin {
    id: string
    code: string
    nom: string
    adresse: string | null
    ville: string | null
    /** Emprise du plan, en mètres. */
    largeur: number
    profondeur: number
    notes: string | null
    is_active: boolean
    created_at: string
    updated_at: string
    created_by: string | null
    /** Boutique de la console retail qui affiche ce plan ; `null` = aucune. */
    retail_shop_id: string | null
    /** Dernière publication du plan vers retail ; `null` = jamais publié. */
    retail_published_at: string | null
}

export type MagasinPatch = Partial<MagasinFormInput & Pick<Magasin, "retail_shop_id" | "retail_published_at">>

/** Point du plan, en mètres : [x, y]. */
export type Point = [number, number]

/**
 * Étage d'un magasin (migration 20261008110000). Chaque étage a son contour,
 * son plan importé à décalquer, ses zones et ses équipements ; les dimensions
 * du magasin sont le cadre commun.
 */
export interface Etage {
    id: string
    magasin_id: string
    nom: string
    /** 0 = rez-de-chaussée, 1 = 1er étage, -1 = sous-sol… */
    niveau: number
    /** Polygone du plan ; `null` = le rectangle entier du magasin. */
    contour: Point[] | null
    /** Plan importé à décalquer (bucket `magasin-plans`), calé en mètres. */
    fond_path: string | null
    fond_x: number | null
    fond_y: number | null
    fond_largeur: number | null
    fond_profondeur: number | null
    fond_opacite: number
    created_at: string
    updated_at: string
    created_by: string | null
}

export interface EtageFormInput {
    nom: string
    niveau: number
}

/** Calage du plan importé, modifiable sans toucher au fichier. */
export type FondCalage = Pick<Etage, "fond_x" | "fond_y" | "fond_largeur" | "fond_profondeur" | "fond_opacite">

export type EtagePatch = Partial<EtageFormInput & FondCalage & Pick<Etage, "fond_path" | "contour">>

export interface MagasinFormInput {
    code: string
    nom: string
    adresse: string | null
    ville: string | null
    largeur: number
    profondeur: number
    notes: string | null
    is_active: boolean
}

/** `null` partout = élément pas encore placé sur le plan. */
export interface PlanGeometry {
    pos_x: number | null
    pos_y: number | null
    width: number | null
    height: number | null
    /** Degrés, sens horaire, autour du centre. */
    rotation: number
}

export interface ZoneMagasin extends PlanGeometry {
    id: string
    magasin_id: string
    etage_id: string
    parent_id: string | null
    kind: ZoneKind
    code: string
    label: string | null
    /** #RRGGBB, ou null pour la couleur automatique. */
    color: string | null
    /**
     * Forme libre tracée point par point, RELATIVE au rectangle de la zone
     * ([u, v] entre 0 et 1) ; `null` = la zone est son rectangle.
     */
    forme: Point[] | null
    sort_order: number
    is_active: boolean
    created_at: string
    updated_at: string
    created_by: string | null
}

export interface EmplacementMagasin extends PlanGeometry {
    id: string
    magasin_id: string
    zone_id: string
    code: string
    label: string | null
    is_active: boolean
    notes: string | null
    created_at: string
    updated_at: string
    created_by: string | null
}

export interface EquipementMagasin extends PlanGeometry {
    id: string
    magasin_id: string
    etage_id: string
    kind: EquipementKind
    /** « C1 », « E1 »… attribué à la création. */
    code: string
    label: string | null
    /** Forme libre relative au rectangle, comme pour les zones ; `null` = le rectangle. */
    forme: Point[] | null
    /** Volées fusionnées en un seul escalier : même `groupe`. `null` = seul. */
    groupe: string | null
    /** Escalier qui descend vers l'étage du dessous (sinon il monte). */
    descend: boolean
    /** Mannequin : zone, rayon ou portant de rattachement ; `null` = aucun. */
    zone_id: string | null
    is_active: boolean
    created_at: string
    updated_at: string
    created_by: string | null
}

/**
 * Mur ou cloison d'un étage (migration 20261008150000) : ligne brisée en
 * mètres ; un mur fermé répète son premier point à la fin.
 */
export interface Mur {
    id: string
    magasin_id: string
    etage_id: string
    points: Point[]
    /** En mètres (0,15 = cloison courante). */
    epaisseur: number
    hauteur: number
    created_at: string
    updated_at: string
    created_by: string | null
}

export type MurPatch = Partial<Pick<Mur, "points" | "epaisseur" | "hauteur">>

export interface ZoneFormInput {
    parent_id: string | null
    kind: ZoneKind
    code: string
    label: string | null
    color: string | null
    is_active: boolean
}

export interface EmplacementFormInput {
    zone_id: string
    code: string
    label: string | null
    notes: string | null
    is_active: boolean
}

export interface ZoneTreeNode extends ZoneMagasin {
    children: ZoneTreeNode[]
    emplacements: EmplacementMagasin[]
}

export type PlanItemType = "zone" | "emplacement" | "equipement"

export type PlanItemKind = ZoneKind | "emplacement" | EquipementKind

/** Élément dessinable du plan, zone ou emplacement, à plat. */
export interface PlanItem {
    /** `z:<id>`, `e:<id>` ou `q:<id>` : unique entre les trois tables. */
    key: string
    type: PlanItemType
    id: string
    /** Clé de la zone qui le contient ; `null` pour une zone racine ou un équipement. */
    parentKey: string | null
    kind: PlanItemKind
    code: string
    label: string | null
    /** Chemin lisible : « A · R2 · E1 ». */
    path: string
    /** Profondeur dans l'arbre (0 = zone racine) : ordre de dessin. */
    depth: number
    color: string | null
    /** Rang de la zone racine, pour la couleur automatique. */
    colorIndex: number
    is_active: boolean
    geometry: PlanGeometry
    /** Forme libre relative au rectangle (zones et équipements). */
    forme: Point[] | null
    /** Groupe d'équipements fusionnés ; `null` hors groupe. */
    groupe: string | null
    /** Premier du groupe (par code) : seul à porter l'étiquette. */
    groupLeader: boolean
    /** Escalier qui descend depuis cet étage ; `false` pour le reste. */
    descend: boolean
}
