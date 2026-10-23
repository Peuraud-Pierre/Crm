import type { BriefCategorie } from "@/features/crm/types"

/** Libellés affichés pour chaque catégorie de la fiche brief CRM. */
export const CATEGORIE_LABELS: Record<BriefCategorie, string> = {
    plateformes: "Plateformes",
    provenances: "Provenances",
    produits: "Produits",
    marques: "Marques",
    styles: "Styles",
    matieres: "Matières",
    budgets: "Budget",
    horizons: "Horizon projet",
    experiences: "Expérience",
}
