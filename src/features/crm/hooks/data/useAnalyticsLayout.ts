import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { useLiveRef } from "@/shared/hooks/useLiveRef"
import {
    fetchSectionLayout,
    saveSectionLayout,
} from "../../services/analyticsLayoutService"
import {
    DEFAULT_SECTION_LAYOUT,
    type SectionLayoutItem,
} from "../../types/analytics"

/**
 * Disposition (ordre + taille) des modules de l'onglet CRM Analytics,
 * propre à l'utilisateur courant — persistée en base (table
 * user_crm_analytics_layout) pour suivre le compte d'un appareil à
 * l'autre. Tant qu'aucune ligne n'existe, DEFAULT_SECTION_LAYOUT
 * s'applique et la première modification crée la ligne (upsert).
 *
 * Même stratégie optimiste + « dernière écriture gagne » que
 * UserPreferencesProvider : reorder() applique la nouvelle disposition
 * immédiatement, puis persiste ; en cas d'échec l'état revient à sa
 * valeur précédente, sauf si une écriture plus récente a entre-temps
 * pris le dessus.
 */
export function useAnalyticsLayout() {
    const { user } = useAuth()
    const userId = user?.user_id ?? user?.id ?? null

    const [layout, setLayout] = useState<SectionLayoutItem[]>(DEFAULT_SECTION_LAYOUT)
    const [loading, setLoading] = useState(true)
    const layoutRef = useLiveRef(layout)
    const writeIdRef = useRef(0)
    // Dernière lecture gagne : une réponse tardive ne doit pas écraser une
    // disposition plus récente (même garde que UserPreferencesProvider.refetch).
    const readIdRef = useRef(0)

    const refetch = useCallback(async () => {
        if (!userId) {
            setLoading(false)
            return
        }
        const requestId = ++readIdRef.current
        try {
            const fetched = await fetchSectionLayout(userId)
            if (readIdRef.current !== requestId) return
            setLayout(fetched)
        } catch (err) {
            if (readIdRef.current !== requestId) return
            console.error("[useAnalyticsLayout] fetch:", err)
            toast.error("Erreur lors du chargement de la disposition")
        } finally {
            if (readIdRef.current === requestId) setLoading(false)
        }
    }, [userId])

    useEffect(() => {
        refetch()
    }, [refetch])

    const reorder = useCallback(
        async (next: SectionLayoutItem[]) => {
            if (!userId) return

            const writeId = ++writeIdRef.current
            const previous = layoutRef.current
            setLayout(next)

            try {
                await saveSectionLayout(userId, next)
            } catch (err) {
                console.error("[useAnalyticsLayout] reorder:", err)
                if (writeIdRef.current !== writeId) return
                toast.error("Erreur lors de l'enregistrement de la disposition")
                setLayout(previous)
            }
        },
        [userId, layoutRef]
    )

    return { layout, loading, reorder, refetch }
}
