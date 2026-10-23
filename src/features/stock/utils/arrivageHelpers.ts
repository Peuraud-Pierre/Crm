import type { ArrivageManuelRow } from "@/features/stock/types/arrivage-manuel.types"
import { INVOICE_ALERT_DAYS } from "@/features/stock/constants"
import { isInvoiceAlert } from "@/shared/lib/shipment"

// La lecture d'une expédition (déchargement, alerte facture) est partagée avec
// le stock handpick : les deux tableaux doivent alerter au même moment.
export { parseDechargement, daysFromDechargement } from "@/shared/lib/shipment"

/**
 * Facture manquante à l'approche du déchargement.
 *
 * `now` est injectable : l'export Excel (`rowStateOf`) et le garde-fou
 * d'alignement avec la newsletter figent la date, pour que leurs attendus ne
 * dépendent pas du jour où le test tourne.
 */
export function isArrivageInvoiceAlert(
    row: Pick<ArrivageManuelRow, "prev_dechargement_at" | "invoice_date" | "status">,
    now: Date = new Date(),
): boolean {
    return isInvoiceAlert(row, INVOICE_ALERT_DAYS, now)
}
