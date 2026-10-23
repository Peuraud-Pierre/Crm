import { useCallback, useEffect, useRef, useState } from "react"
import { fetchNewsletterRuns } from "@/features/arrivage-admin/services/newsletterService"
import type { RunStatus, SendRun } from "@/features/arrivage-admin/types"

/**
 * Historique des exécutions du pipeline, plus récentes d'abord.
 *
 * `status` vide = tous les statuts. Le filtrage est fait côté service
 * (`GET /runs?status=`) plutôt qu'en mémoire : filtrer après coup sur un lot
 * tronqué donnerait un décompte trompeur.
 */
export function useNewsletterRuns(limit: number, status: RunStatus | "" = "") {
    const [runs, setRuns] = useState<SendRun[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const abortRef = useRef<AbortController | null>(null)

    const refetch = useCallback(async () => {
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller

        setLoading(true)
        try {
            const data = await fetchNewsletterRuns(
                limit,
                status,
                controller.signal
            )
            if (controller.signal.aborted) return
            setRuns(data)
            setError(null)
        } catch (e: unknown) {
            if (controller.signal.aborted) return
            setError(e instanceof Error ? e.message : "Erreur inattendue.")
        } finally {
            if (!controller.signal.aborted) setLoading(false)
        }
    }, [limit, status])

    useEffect(() => {
        refetch()
        return () => abortRef.current?.abort()
    }, [refetch])

    return { runs, loading, error, refetch }
}
