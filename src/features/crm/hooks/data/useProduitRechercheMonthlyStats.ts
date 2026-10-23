import { useCallback, useEffect, useState } from "react"
import * as produitRechercheMonthlyStatsService from "@/features/crm/services/produitRechercheMonthlyStatsService"
import type { ProduitRechercheMonthlyPoint } from "@/features/crm/services/produitRechercheMonthlyStatsService"

export function useProduitRechercheMonthlyStats() {
    const [data, setData] = useState<ProduitRechercheMonthlyPoint[]>([])
    const [loading, setLoading] = useState(true)

    const fetchStats = useCallback(async () => {
        setLoading(true)
        try {
            const points =
                await produitRechercheMonthlyStatsService.listProduitRechercheMonthlyStats()
            setData(points)
        } catch {
            // silent — le widget affiche l'état vide si data reste []
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    return { data, loading }
}
