import { ExportButton } from "@/shared/ui/organisms/export-button"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { useArrivageManuelContext } from "@/features/stock/hooks/context/StockProvider"
import { COLUMN_DEFS } from "@/features/stock/utils/arrivageExportColumns"
import { filterArrivagesByRange } from "@/features/stock/utils/arrivageGrouping"
import { exportArrivageRows } from "@/features/stock/utils/buildArrivageWorkbook"
import { STOCK_PERMISSIONS } from "@/features/stock/constants"

/**
 * Export des arrivages.
 *
 * La mécanique du bouton (export global, export par période) est partagée ;
 * ce qui reste ici est propre au stock principal : les colonnes de l'export
 * sont filtrées une par une par les permissions `stock.arrivage.newsletter.*`,
 * les mêmes que celles du service newsletter — un destinataire ne doit pas
 * recevoir par l'application des colonnes que son abonnement ne lui donne pas.
 */
export default function ExportArrivageButton() {
    const { rows } = useArrivageManuelContext()
    const { hasPermission } = useAuth()

    if (!hasPermission(STOCK_PERMISSIONS.arrivageExport)) return null

    const allowedCols = COLUMN_DEFS.filter((col) =>
        hasPermission(`stock.arrivage.newsletter.${col.permKey}`),
    )

    return (
        <ExportButton
            rows={rows}
            onExport={(exported, suffix) =>
                exportArrivageRows([...exported], allowedCols, suffix)
            }
            filterByRange={(all, from, to) => filterArrivagesByRange([...all], from, to)}
            rangeHint="Filtré par date de référence (déchargement → Le Havre → départ)"
        />
    )
}
