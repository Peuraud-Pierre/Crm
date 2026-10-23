import { useCallback, useEffect, useState } from "react"
import { fetchRecipientCount } from "@/features/client-newsletter/services/clientNewsletterService"

export function useNewsletterRecipientCount() {
    const [count, setCount] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [version, setVersion] = useState(0)

    useEffect(() => {
        const controller = new AbortController()
        fetchRecipientCount(controller.signal)
            .then(n => {
                setCount(n)
                setError(null)
            })
            .catch((e: unknown) => {
                if (controller.signal.aborted) return
                console.error("[client-newsletter] comptage", e)
                setCount(null)
                setError("Impossible de compter les destinataires.")
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })
        return () => controller.abort()
    }, [version])

    const reload = useCallback(() => {
        setLoading(true)
        setVersion(v => v + 1)
    }, [])
    return { count, loading, error, reload }
}
