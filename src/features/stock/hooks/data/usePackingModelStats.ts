import { useCallback, useEffect, useState } from "react"
import { fetchPackingModelStats } from "@/features/stock/services/packingImportService"
import type { PackingModelStats } from "@/features/stock/types/packing-list.types"

/**
 * Ce que le modèle de `packing-api` a appris des décisions humaines.
 *
 * `stats === null` sans erreur : aucun service configuré (faux import de dev).
 * Une erreur n'est pas bloquante — le tableau de correspondance reste
 * utilisable sans ce résumé — elle est donc exposée, pas notifiée.
 */
export function usePackingModelStats() {
    const [stats, setStats] = useState<PackingModelStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    const refresh = useCallback(async () => {
        setLoading(true)
        setError(false)
        try {
            setStats(await fetchPackingModelStats())
        } catch (err) {
            console.error("[usePackingModelStats] refresh:", err)
            setStats(null)
            setError(true)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    return { stats, loading, error, refresh }
}
