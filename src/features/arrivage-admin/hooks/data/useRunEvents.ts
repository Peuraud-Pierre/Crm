import { useCallback, useEffect, useRef, useState } from "react"
import { fetchRunEvents } from "@/features/arrivage-admin/services/newsletterService"
import type { SendEvent } from "@/features/arrivage-admin/types"

/**
 * Détail par destinataire d'un envoi. `runId` à `null` (sheet fermée) laisse le
 * hook au repos, sans requête ni état de chargement.
 */
export function useRunEvents(runId: string | null) {
    const [events, setEvents] = useState<SendEvent[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const abortRef = useRef<AbortController | null>(null)

    const load = useCallback(async () => {
        abortRef.current?.abort()
        if (!runId) {
            setEvents([])
            setError(null)
            setLoading(false)
            return
        }

        const controller = new AbortController()
        abortRef.current = controller

        setLoading(true)
        setError(null)
        try {
            const data = await fetchRunEvents(runId, controller.signal)
            if (controller.signal.aborted) return
            setEvents(data)
        } catch (e: unknown) {
            if (controller.signal.aborted) return
            setError(e instanceof Error ? e.message : "Erreur inattendue.")
        } finally {
            if (!controller.signal.aborted) setLoading(false)
        }
    }, [runId])

    useEffect(() => {
        load()
        return () => abortRef.current?.abort()
    }, [load])

    return { events, loading, error }
}
