import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"

/**
 * Nom de l'usine d'une balle. Repli sur l'instantané pris à l'éclatement :
 * une balle éclatée dont l'usine a été supprimée n'a plus de jointure.
 */
export function usineNameOf(balle: Pick<BalleHandpick, "fournisseur" | "fournisseur_label">): string | null {
    return balle.fournisseur?.name ?? balle.fournisseur_label ?? null
}
