import { useEffect, useRef, useState } from "react"
import {
    listRecentConversations,
    subscribeToConversationEvents,
} from "../services/conversationsService"

/**
 * Récence des conversations 1-à-1 de l'utilisateur courant.
 *
 * Les messages de groupe et 1-à-1 partagent la table `cryptedmessage` ; un
 * message de groupe a `recipient_id = null`, un 1-à-1 a un destinataire. On ne
 * garde donc que les messages avec `recipient_id` non-null impliquant l'user
 * courant (envoyé OU reçu), et on retient la date du plus récent par
 * interlocuteur.
 *
 * Aucune agrégation côté serveur n'existe : la requête et la déduction du
 * dernier message par partenaire vivent dans services/conversationsService.ts.
 *
 * @returns `Record<partnerUserId, lastMessageISO>`
 */
export function useRecentConversations(currentUserId: string | null) {
    const [recentByUser, setRecentByUser] = useState<Record<string, string>>({})
    const debounceRef = useRef<number | undefined>(undefined)

    useEffect(() => {
        if (!currentUserId) return
        let active = true

        const load = async () => {
            const next = await listRecentConversations(currentUserId)
            if (active) setRecentByUser(next)
        }

        // Debounce : une rafale de messages (realtime) ne doit déclencher qu'un
        // seul rechargement REST, pas un par event (évite de saturer le rate-limit).
        const scheduleLoad = () => {
            window.clearTimeout(debounceRef.current)
            debounceRef.current = window.setTimeout(() => {
                if (active) load()
            }, 800)
        }

        load()

        // Realtime : tout event (envoyé ou reçu) → recalcul debouncé.
        // Le détail des filtres Postgres vit dans conversationsService.
        const unsubscribe = subscribeToConversationEvents(
            currentUserId,
            scheduleLoad
        )

        return () => {
            active = false
            window.clearTimeout(debounceRef.current)
            unsubscribe()
        }
    }, [currentUserId])

    return recentByUser
}
