import { useCallback } from "react"
import { IMPORTS_PAGE_SIZE } from "@/features/packing-admin/constants"
import { fetchImportHistory } from "@/features/packing-admin/services/packingAdminService"
import { useAbortableResource } from "@/features/packing-admin/hooks/useAbortableResource"
import type { PackingImportRow } from "@/features/packing-admin/types"

/**
 * Historique des imports, lu directement en base.
 *
 * Rapatrié en un bloc borné puis paginé côté client : le volume est celui d'un
 * import par conteneur, et un aller-retour par page coûterait plus que de tout
 * charger. Même choix que l'historique des envois de `arrivage-admin`.
 */
const FETCH_LIMIT = IMPORTS_PAGE_SIZE * 8

export function usePackingImportHistory() {
    const load = useCallback(() => fetchImportHistory(FETCH_LIMIT), [])
    const resource = useAbortableResource<PackingImportRow[]>(load)

    return {
        imports: resource.data ?? [],
        loading: resource.loading,
        error: resource.error,
        refetch: resource.refetch,
    }
}
