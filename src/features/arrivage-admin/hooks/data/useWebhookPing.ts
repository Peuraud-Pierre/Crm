import { useCallback, useEffect, useRef, useState } from "react"
import {
    checkWebhookPing,
    startWebhookPing,
} from "@/features/arrivage-admin/services/newsletterService"
import {
    WEBHOOK_PING_MAX_ATTEMPTS,
    WEBHOOK_PING_POLL_MS,
} from "@/features/arrivage-admin/constants"
import { buildWebhookPingVerdict } from "@/features/arrivage-admin/utils/webhookPing"
import type {
    WebhookPingResponse,
    WebhookPingVerdict,
} from "@/features/arrivage-admin/types"

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Déroule un test du webhook automatique : on poste, puis on attend le passage
 * du worker pg_net.
 *
 * Le polling n'est pas un raccourci : pg_net n'insère la requête dans sa file
 * que dans la transaction courante, donc son worker ne la voit qu'après le
 * COMMIT du premier appel. Attendre la réponse dans la même RPC ne donnerait
 * jamais rien — il faut deux allers-retours.
 *
 * La dernière réponse observée est conservée même quand les tentatives
 * s'épuisent : un état `queued` persistant n'est pas un « pas de réponse », il
 * désigne précisément un worker pg_net arrêté.
 */
export function useWebhookPing() {
    const [running, setRunning] = useState(false)
    const [verdict, setVerdict] = useState<WebhookPingVerdict | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Le test dure plusieurs secondes : sans ce garde-fou, une fermeture de la
    // page pendant l'attente déclenche un setState sur composant démonté.
    const aliveRef = useRef(true)
    useEffect(() => {
        aliveRef.current = true
        return () => {
            aliveRef.current = false
        }
    }, [])

    const run = useCallback(async () => {
        setRunning(true)
        setVerdict(null)
        setError(null)

        try {
            const start = await startWebhookPing()

            // Panne côté base (trigger absent, désactivé, pg_net manquant) :
            // rien n'est parti, il n'y a rien à attendre.
            if (!start.ok || start.request_id === undefined) {
                if (aliveRef.current) setVerdict(buildWebhookPingVerdict(start, null))
                return
            }

            let last: WebhookPingResponse | null = null

            for (let i = 0; i < WEBHOOK_PING_MAX_ATTEMPTS; i++) {
                await sleep(WEBHOOK_PING_POLL_MS)
                if (!aliveRef.current) return

                last = await checkWebhookPing(start.request_id)
                if (last.state === "done") break
            }

            if (aliveRef.current) setVerdict(buildWebhookPingVerdict(start, last))
        } catch (e: unknown) {
            if (aliveRef.current)
                setError(e instanceof Error ? e.message : "Erreur inattendue.")
        } finally {
            if (aliveRef.current) setRunning(false)
        }
    }, [])

    const reset = useCallback(() => {
        setVerdict(null)
        setError(null)
    }, [])

    return { running, verdict, error, run, reset }
}
