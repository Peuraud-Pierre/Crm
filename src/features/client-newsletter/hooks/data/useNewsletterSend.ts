import { useState } from "react"
import { toast } from "sonner"
import {
    sendClientNewsletterTest,
    startClientNewsletterSend,
} from "@/features/client-newsletter/services/clientNewsletterService"
import type { NewsletterDraft } from "@/features/client-newsletter/types"

const errorMessage = (e: unknown) =>
    e instanceof Error ? e.message : "Erreur inattendue."

export function useNewsletterSend() {
    const [testing, setTesting] = useState(false)
    const [sending, setSending] = useState(false)

    const sendTest = async (draft: NewsletterDraft) => {
        setTesting(true)
        try {
            const { to } = await sendClientNewsletterTest(draft)
            toast.success(`Test envoyé à ${to}.`)
        } catch (e: unknown) {
            toast.error(errorMessage(e))
        } finally {
            setTesting(false)
        }
    }

    /** Renvoie true si l'envoi a bien démarré (202). */
    const send = async (draft: NewsletterDraft): Promise<boolean> => {
        setSending(true)
        try {
            const { recipient_count } = await startClientNewsletterSend(draft)
            toast.success(
                `Envoi lancé vers ${recipient_count} client${recipient_count > 1 ? "s" : ""}.`
            )
            return true
        } catch (e: unknown) {
            toast.error(errorMessage(e))
            return false
        } finally {
            setSending(false)
        }
    }

    return { testing, sending, sendTest, send }
}
