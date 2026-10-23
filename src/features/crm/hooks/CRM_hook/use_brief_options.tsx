import { useCallback, useEffect, useMemo, useState } from "react"
import { listBriefOptions } from "@/features/crm/services/briefOptionsService"
import type { BriefCategorie, BriefOption } from "@/features/crm/types"

/**
 * Hook de lecture des listes de valeurs dynamiques du brief CRM
 * (brief_cat). Config quasi statique : pas de Realtime, fetch au montage
 * — même logique que use_type.tsx.
 */
export function useBriefOptions() {
    const [options, setOptions] = useState<BriefOption[]>([])
    const [loading, setLoading] = useState(true)

    const fetch_BriefOptions = useCallback(async () => {
        try {
            const data = await listBriefOptions()
            setOptions(data)
        } catch (error) {
            console.error(
                error,
                "❌ erreur lors de la récupération des options de brief"
            )
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetch_BriefOptions()
    }, [fetch_BriefOptions])

    const byCategorie = useMemo(() => {
        const grouped = {} as Record<BriefCategorie, BriefOption[]>
        for (const option of options) {
            if (!option.active) continue
            ;(grouped[option.categorie] ??= []).push(option)
        }
        return grouped
    }, [options])

    return { byCategorie, loading }
}
