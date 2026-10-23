/**
 * briefOptions.ts — Listes de valeurs dynamiques du brief CRM
 *
 * Remplace les tableaux en dur (PLATEFORMES, STYLES...) qui vivaient dans
 * colonneBrief.tsx : stockées en base (table brief_cat) pour être
 * éditables depuis l'administration sans déploiement.
 *
 * Mapping colonnes DB → champs applicatifs (brief_cat.type/available sont
 * nommés ainsi côté DB, aliasés côté service pour rester lisibles ici) :
 *   type      → value  (la valeur affichée en badge, ex: "Vinted")
 *   categorie → categorie (le discriminant de liste, ex: "plateformes")
 *   available → active
 */

export type BriefCategorie =
    | "plateformes"
    | "provenances"
    | "produits"
    | "marques"
    | "styles"
    | "matieres"
    | "budgets"
    | "horizons"
    | "experiences"

export const BRIEF_CATEGORIES: BriefCategorie[] = [
    "plateformes",
    "provenances",
    "produits",
    "marques",
    "styles",
    "matieres",
    "budgets",
    "horizons",
    "experiences",
]

export interface BriefOption {
    id: number
    categorie: BriefCategorie
    value: string
    active: boolean
}
