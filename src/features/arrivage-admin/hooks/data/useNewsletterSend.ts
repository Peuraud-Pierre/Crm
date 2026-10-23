import { useState } from "react"
import { toast } from "sonner"
import {
    resendNewsletterToAll,
    resendNewsletterToSubscriber,
} from "@/features/arrivage-admin/services/newsletterService"

export function useNewsletterSend() {
    const [sendingId, setSendingId] = useState<string | null>(null)
    const [sendingAll, setSendingAll] = useState(false)

    const sendToSubscriber = async (userId: string) => {
        setSendingId(userId)
        try {
            await resendNewsletterToSubscriber(userId)
            toast.success("Newsletter renvoyée.")
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Erreur inattendue.")
        } finally {
            setSendingId(null)
        }
    }

    const sendToAll = async () => {
        setSendingAll(true)
        try {
            await resendNewsletterToAll()
            toast.success("Envoi à tous les abonnés déclenché.")
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Erreur inattendue.")
        } finally {
            setSendingAll(false)
        }
    }

    return { sendingId, sendingAll, sendToSubscriber, sendToAll }
}
