import type { CommandeBoutique, LivraisonBoutique } from "@/features/commandes/types/commande.types"
import { isEnRetard } from "./planning"

/**
 * La file de travail de l'entrepôt — fonction pure.
 *
 * Chaque commande ou livraison active tombe dans UNE étape, celle dont
 * l'entrepôt doit s'occuper maintenant :
 *
 *   à préparer     — commande avec un reste à servir et aucune livraison
 *                    en cours de préparation
 *   en préparation — livraison planifiée ou en préparation (cartons à faire,
 *                    étiquettes, expédition)
 *   en route       — livraison partie, la boutique réceptionne
 *   à régler       — livraison en litige (écarts de réception)
 *
 * Les plus urgentes d'abord : en retard, puis par date.
 */

export const ETAPES = ["a_preparer", "preparation", "en_route", "a_regler"] as const
export type Etape = (typeof ETAPES)[number]

export interface FileDeTravail {
    a_preparer: CommandeBoutique[]
    preparation: LivraisonBoutique[]
    en_route: LivraisonBoutique[]
    a_regler: LivraisonBoutique[]
}

const PREPARATION = new Set(["planifiee", "preparation"])
const EN_ROUTE = new Set(["expediee", "en_reception"])

/** Date de tri : la plus proche échéance d'abord, sans date en dernier. */
const cle = (d: string | null | undefined) => d ?? "9999-12-31"

export function fileDeTravail(
    commandes: readonly CommandeBoutique[],
    livraisons: readonly LivraisonBoutique[],
    today: string,
): FileDeTravail {
    const enPreparation = new Set(livraisons.filter((l) => PREPARATION.has(l.statut) && l.commande_id).map((l) => l.commande_id))
    const parUrgence = (a: LivraisonBoutique, b: LivraisonBoutique) =>
        Number(isEnRetard(b, today)) - Number(isEnRetard(a, today))
        || cle(a.date_expedition_prevue).localeCompare(cle(b.date_expedition_prevue))
        || a.numero - b.numero

    return {
        a_preparer: commandes
            .filter((c) => (c.statut === "ouverte" || c.statut === "en_cours") && c.kg_reste > 0 && !enPreparation.has(c.id))
            .sort((a, b) => cle(a.date_souhaitee).localeCompare(cle(b.date_souhaitee)) || a.numero - b.numero),
        preparation: livraisons.filter((l) => PREPARATION.has(l.statut)).sort(parUrgence),
        en_route: livraisons.filter((l) => EN_ROUTE.has(l.statut)).sort(parUrgence),
        a_regler: livraisons.filter((l) => l.statut === "litige").sort((a, b) => b.numero - a.numero),
    }
}

/** Livraison en préparation d'une commande, s'il y en a une : « Continuer » plutôt que « Préparer ». */
export function livraisonEnPreparation(commandeId: string, livraisons: readonly LivraisonBoutique[]): LivraisonBoutique | null {
    return livraisons.find((l) => l.commande_id === commandeId && PREPARATION.has(l.statut)) ?? null
}
