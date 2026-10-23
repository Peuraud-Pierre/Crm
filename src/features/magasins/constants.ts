import type { EquipementKind, PlanItemKind, ZoneKind } from "./types/magasin.types"

/**
 * Codes de permission du module. Créés par
 * `supabase/migrations/20261007100000_magasins.sql`, qui n'en attribue
 * AUCUN : ils se donnent depuis /administration. La RLS des trois tables est
 * adossée à ces mêmes codes.
 */
export const MAGASIN_PERMISSIONS = {
    view: "magasin.view",
    create: "magasin.create",
    update: "magasin.update",
    delete: "magasin.delete",
} as const

export const MAGASIN_TABLES = {
    magasins: "magasins",
    zones: "zones_magasin",
    emplacements: "emplacements_magasin",
    equipements: "equipements_magasin",
    etages: "etages_magasin",
    murs: "murs_magasin",
} as const

/** Épaisseurs proposées pour un mur, en mètres. */
export const MUR_EPAISSEURS = [0.07, 0.1, 0.15, 0.2, 0.3] as const
export const MUR_EPAISSEUR_DEFAUT = 0.15
export const MUR_HAUTEUR_DEFAUT = 2.5

/** Bucket Storage privé des fonds de plan (lecture par URL signée). */
export const FOND_BUCKET = "magasin-plans"

/** Base d'URL du module — évite d'éparpiller le littéral dans les navigate(). */
export const MAGASINS_ROUTE_BASE = "/magasins"

/** Onglets de la fiche d'un magasin, dans l'ordre ; le premier est le défaut. */
export const MAGASIN_SECTIONS = ["plan", "emplacements"] as const
export type MagasinSection = (typeof MAGASIN_SECTIONS)[number]

export const ZONE_KIND_LABEL: Record<ZoneKind, string> = {
    zone: "Zone",
    rayon: "Rayon",
    // Valeur en base : `etagere` (contrainte de zones_magasin). Seul le
    // libellé dit « portant », le meuble des boutiques de vêtements.
    etagere: "Portant",
}

export const EQUIPEMENT_KIND_LABEL: Record<EquipementKind, string> = {
    caisse: "Caisse",
    entree: "Porte d'entrée",
    sortie: "Porte de sortie",
    entree_sortie: "Entrée / sortie",
    escalier: "Escalier",
    escalier_colimacon: "Escalier en colimaçon",
    mannequin: "Mannequin",
}

/** Préfixe du code attribué à la création : C1, C2… E1… */
export const EQUIPEMENT_CODE_PREFIX: Record<EquipementKind, string> = {
    caisse: "C",
    entree: "E",
    sortie: "S",
    entree_sortie: "ES",
    escalier: "ESC",
    escalier_colimacon: "COL",
    mannequin: "MQ",
}

export const PLAN_KIND_LABEL: Record<PlanItemKind, string> = {
    ...ZONE_KIND_LABEL,
    ...EQUIPEMENT_KIND_LABEL,
    emplacement: "Emplacement",
}

/** Niveaux de parent autorisés — miroir du trigger `zones_magasin_check_hierarchy`. */
export const ALLOWED_PARENT_KINDS: Record<ZoneKind, readonly ZoneKind[]> = {
    zone: [],
    rayon: ["zone"],
    etagere: ["zone", "rayon"],
}

