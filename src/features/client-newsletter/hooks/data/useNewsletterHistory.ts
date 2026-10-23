import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { fetchSendHistory } from "@/features/client-newsletter/services/clientNewsletterService"
import type { ClientNewsletterSend } from "@/features/client-newsletter/types"

const POLL_MS = 3000

/** Historique des envois ; rafraîchi toutes les 3 s tant qu'un envoi est en cours. */
export function useNewsletterHistory() {
    const [sends, setSends] = useState<ClientNewsletterSend[]>([])
    const [loading, setLoading] = useState(true)

    const reload = useCallback(async () => {
        try {
            setSends(await fetchSendHistory())
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Erreur inattendue.")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void reload()
    }, [reload])

    const hasActiveSend = sends.some(s => s.status === "sending")

    useEffect(() => {
        if (!hasActiveSend) return
        const id = window.setInterval(() => void reload(), POLL_MS)
        return () => window.clearInterval(id)
    }, [hasActiveSend, reload])

    return { sends, loading, hasActiveSend, reload }
}
