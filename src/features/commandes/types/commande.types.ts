/**
 * Types de la salle de commande — migration `20261001110000_stock_commandes.sql`.
 *
 *   commande (kg BRUTS demandés par catégorie de vêtements)
 *     └─ livraison(s) PARTIELLES vers la boutique
 *          └─ palette(s)
 *               └─ carton(s) — une catégorie par carton, en kg
 *
 * Les catégories sont celles du stock (`categories_gestion`). Pas de prix
 * ni de code couleur : ils relèvent de la boutique.
 *
 * À ne pas confondre avec `livraison.types.ts`, qui décrit les livraisons
 * FOURNISSEURS (arrivées à l'entrepôt, `deliveries_gestion`). Ici tout ce qui
 * part vers une boutique s'appelle `LivraisonBoutique`.
 *
 * Les totaux et l'avancement viennent des vues (`v_*`) : ils ne sont jamais
 * stockés, les cartons font foi.
 */

export interface Boutique {
    id: string
    nom: string
    /** 2 à 4 caractères, en majuscules. */
    code: string
    adresse: string | null
    actif: boolean
    /** Clé de rapprochement avec la console retail (V2). */
    retail_shop_id: string | null
    created_at: string
}

// ── Commandes ────────────────────────────────────────────────────────────────

export type CommandeStatut = "ouverte" | "en_cours" | "soldee" | "annulee"

export interface CommandeLigne {
    id: string
    commande_id: string
    category_id: string
    /** Poids brut : vêtements seuls, sans cintre ni antivol. */
    poids_kg_demande: number
    note: string | null
}

/** Ligne de `v_commandes_boutique`. */
export interface CommandeBoutique {
    id: string
    numero: number
    /** « CMD-0017 ». */
    code: string
    boutique_id: string
    boutique_nom: string
    boutique_code: string
    date_souhaitee: string | null
    statut: CommandeStatut
    motif_cloture: string | null
    note: string | null
    created_by: string | null
    created_at: string
    updated_at: string
    kg_demande: number
    kg_prepare: number
    kg_expedie: number
    kg_recu: number
    kg_reste: number
    nb_lignes: number
    nb_livraisons: number
    derniere_livraison_at: string | null
}

/** Ligne de `v_commande_avancement` : une ligne de commande et son avancement. */
export interface AvancementLigne {
    ligne_id: string
    commande_id: string
    category_id: string
    category_nom: string
    kg_demande: number
    kg_prepare: number
    /** Expédié, pas encore reçu : en transit. */
    kg_expedie: number
    kg_recu: number
    kg_manquant: number
    kg_reste: number
}

export interface CommandeInput {
    boutique_id: string
    date_souhaitee: string | null
    note: string | null
}

export interface CommandeLigneInput {
    category_id: string
    poids_kg_demande: number
}

// ── Livraisons boutiques ─────────────────────────────────────────────────────

export type LivraisonBoutiqueStatut =
    | "planifiee"
    | "preparation"
    | "expediee"
    | "en_reception"
    | "receptionnee"
    | "litige"
    | "annulee"

/** Ligne de `v_livraisons_boutique`. */
export interface LivraisonBoutique {
    id: string
    numero: number
    /** « LIV-0042 ». */
    code: string
    commande_id: string | null
    commande_code: string | null
    boutique_id: string
    boutique_nom: string
    boutique_code: string
    statut: LivraisonBoutiqueStatut
    date_preparation_prevue: string | null
    date_expedition_prevue: string | null
    date_livraison_prevue: string | null
    expediee_at: string | null
    expediee_par: string | null
    receptionnee_at: string | null
    note: string | null
    created_by: string | null
    created_at: string
    updated_at: string
    nb_palettes: number
    nb_cartons: number
    nb_recus: number
    nb_ecarts: number
    kg_prevu: number
    kg_recu: number
    /** Kilos en écart (poids, endommagé, mauvaise catégorie, manquant). */
    kg_ecart: number
}

export interface LivraisonBoutiqueInput {
    commande_id: string | null
    boutique_id: string
    date_preparation_prevue: string | null
    date_expedition_prevue: string | null
    date_livraison_prevue: string | null
    note: string | null
}

export interface Palette {
    id: string
    livraison_id: string
    numero: number
    note: string | null
    created_at: string
}

export type CartonStatut = "prepare" | "expedie" | "recu_conforme" | "recu_ecart" | "manquant"
export type CartonEtat = "conforme" | "ecart_poids" | "endommage" | "mauvaise_categorie" | "manquant"

/** Ligne de `v_cartons`. */
export interface Carton {
    id: string
    livraison_id: string
    palette_id: string | null
    numero: number
    /** « LIV-0042-C07 » : le contenu du QR. */
    code: string
    palette_code: string | null
    palette_numero: number | null
    livraison_numero: number
    livraison_statut: LivraisonBoutiqueStatut
    boutique_id: string
    commande_id: string | null
    category_id: string
    category_nom: string
    poids_kg_prevu: number
    statut: CartonStatut
    etat: CartonEtat | null
    poids_kg_recu: number | null
    recu_at: string | null
    recu_par: string | null
    note_reception: string | null
    ecart_kg: number
    created_at: string
}

export interface CartonInput {
    livraison_id: string
    palette_id: string | null
    category_id: string
    poids_kg_prevu: number
}

/** Saisie de réception d'un carton, envoyée à `receptionner_carton`. */
export interface ReceptionInput {
    /** Poids pesé ; `null` : pas de pesée, le prévu fait foi. */
    poidsRecu: number | null
    endommage: boolean
    /** Constaté à l'œil : le contenu n'est pas la catégorie annoncée. */
    mauvaiseCategorie: boolean
    note: string | null
}

// ── Espaces et vues ──────────────────────────────────────────────────────────

/**
 * Deux espaces sur la même page : l'ENTREPÔT (prépare, expédie) et la
 * BOUTIQUE (commande, réceptionne — simulée en V1, la console retail
 * prendra le relais).
 */
export const COMMANDE_ESPACES = ["entrepot", "boutique"] as const
export type CommandeEspace = (typeof COMMANDE_ESPACES)[number]

/** Vues de la page, portées par `?vue=` ; l'espace s'en déduit (voir `CommandesBoard`). */
export const COMMANDE_VUES = ["a-faire", "planning", "commandes", "livraisons", "boutiques", "accueil", "reception", "mes-commandes"] as const
export type CommandeVue = (typeof COMMANDE_VUES)[number]

export const ESPACE_DE_VUE: Record<CommandeVue, CommandeEspace> = {
    "a-faire": "entrepot",
    planning: "entrepot",
    commandes: "entrepot",
    livraisons: "entrepot",
    boutiques: "entrepot",
    accueil: "boutique",
    reception: "boutique",
    "mes-commandes": "boutique",
}
