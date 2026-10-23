import { useCallback, useState } from "react"
import { toast } from "sonner"
import * as clientService from "@/features/crm/services/clientService"
import { downloadClientsWorkbook } from "@/features/crm/utils/clientsExport"
import { getErrorMessage } from "@/features/crm/utils/errors"

/** Export Excel de toute la base clients (bouton de la FilterBar). */
export function useClientsExport() {
    const [exporting, setExporting] = useState(false)

    const exportClients = useCallback(async () => {
        setExporting(true)
        try {
            const rows = await clientService.fetchAllClientsForExport()
            downloadClientsWorkbook(rows)
            toast.success(`${rows.length} clients exportés`)
        } catch (err) {
            console.error("[useClientsExport]", err)
            toast.error("Échec de l'export de la base clients", {
                description: getErrorMessage(err),
            })
        } finally {
            setExporting(false)
        }
    }, [])

    return { exportClients, exporting }
}
