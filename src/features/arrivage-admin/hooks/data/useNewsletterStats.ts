import { useCallback, useEffect, useRef, useState } from "react"
import { fetchNewsletterStats } from "@/features/arrivage-admin/services/newsletterService"
import type { NewsletterStats } from "@/features/arrivage-admin/types"

/**
 * Agrégats du dashboard sur une fenêtre glissante.
 *
 * Volontairement sans `toast` : quand le service Go est injoignable, l'erreur
 * est remontée à l'appelant qui l'affiche une fois dans le bandeau d'alertes,
 * plutôt qu'en notification répétée à chaque rechargement.
 */
export function useNewsletterStats(days: number) {
    const [stats, setStats] = useState<NewsletterStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const abortRef = useRef<AbortController | null>(null)

    const refetch = useCallback(async () => {
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller

        setLoading(true)
        try {
            const data = await fetchNewsletterStats(days, controller.signal)
            if (controller.signal.aborted) return
            setStats(data)
            setError(null)
        } catch (e: unknown) {
            if (controller.signal.aborted) return
            setError(e instanceof Error ? e.message : "Erreur inattendue.")
        } finally {
            if (!controller.signal.aborted) setLoading(false)
        }
    }, [days])

    useEffect(() => {
        refetch()
        return () => abortRef.current?.abort()
    }, [refetch])

    return { stats, loading, error, refetch }
}
