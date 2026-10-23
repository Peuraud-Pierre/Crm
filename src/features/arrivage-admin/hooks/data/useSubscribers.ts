import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
    fetchNewsletterSubscriptions,
    updateSubscriberArrivage,
    updateSubscriberCrmStat,
} from "@/features/arrivage-admin/services/newsletterService"
import type { Subscriber } from "@/features/arrivage-admin/types"

/**
 * Abonnés à la newsletter arrivages (lecture — la plupart des mutations
 * passent par l'API Go ; exceptions : `arrivage` et `crm_stat`, basculables
 * directement depuis ce panneau en écriture Supabase directe, cf.
 * toggleArrivage / toggleCrmStat).
 */
export function useSubscribers() {
    const [subscribers, setSubscribers] = useState<Subscriber[]>([])
    const [loading, setLoading] = useState(true)

    const requestIdRef = useRef(0)

    const refetch = useCallback(async () => {
        const requestId = ++requestIdRef.current
        setLoading(true)
        try {
            const data = await fetchNewsletterSubscriptions()
            if (requestId !== requestIdRef.current) return
            setSubscribers(data)
        } catch (e: unknown) {
            if (requestId !== requestIdRef.current) return
            toast.error(e instanceof Error ? e.message : "Erreur inattendue.")
        } finally {
            if (requestId === requestIdRef.current) setLoading(false)
        }
    }, [])

    useEffect(() => {
        refetch()
    }, [refetch])

    /**
     * Applique `value` au champ `field` en optimiste, avec rollback si
     * l'écriture Supabase échoue. Factorisé : toggleArrivage et
     * toggleCrmStat ne diffèrent que par le champ et l'appel réseau.
     */
    const optimisticToggle = useCallback(
        async (
            userId: string,
            field: "arrivage" | "crm_stat",
            value: boolean,
            write: () => Promise<void>
        ) => {
            setSubscribers(prev =>
                prev.map(s =>
                    s.user_id === userId ? { ...s, [field]: value } : s
                )
            )
            try {
                await write()
            } catch (e: unknown) {
                setSubscribers(prev =>
                    prev.map(s =>
                        s.user_id === userId ? { ...s, [field]: !value } : s
                    )
                )
                toast.error(e instanceof Error ? e.message : "Erreur inattendue.")
            }
        },
        []
    )

    const toggleArrivage = useCallback(
        (userId: string, arrivage: boolean) =>
            optimisticToggle(userId, "arrivage", arrivage, () =>
                updateSubscriberArrivage(userId, arrivage)
            ),
        [optimisticToggle]
    )

    const toggleCrmStat = useCallback(
        (userId: string, crmStat: boolean) =>
            optimisticToggle(userId, "crm_stat", crmStat, () =>
                updateSubscriberCrmStat(userId, crmStat)
            ),
        [optimisticToggle]
    )

    return {
        subscribers,
        loading,
        refetch,
        toggleArrivage,
        toggleCrmStat,
    }
}
