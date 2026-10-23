import { useCallback, useEffect, useRef, useState } from "react"
import {
    fetchPgNetHealth,
    fetchServiceStatus,
    pingNewsletterApi,
} from "@/features/arrivage-admin/services/newsletterService"
import { SERVICE_STATUS_POLL_MS } from "@/features/arrivage-admin/constants"
import type { ServiceHealth } from "@/features/arrivage-admin/types"

/**
 * Disponibilité du service Go et état de son debouncer, rafraîchis en continu
 * tant que le dashboard est monté.
 *
 * `/health` est interrogé d'abord : il ne demande pas de JWT, donc il distingue
 * « service à l'arrêt » d'une simple erreur d'autorisation sur `/status`.
 *
 * L'état de la file pg_net est relevé en parallèle, et indépendamment du reste :
 * il vient de Postgres, pas du service Go. C'est même le seul indicateur qui
 * reste pertinent quand le service est joignable et que rien ne part quand
 * même — la panne du 26/08, où pg_net avait cessé d'émettre sans que ni le
 * service ni la base ne signalent quoi que ce soit.
 */
export function useServiceHealth() {
    const [health, setHealth] = useState<ServiceHealth>({
        reachable: null,
        status: null,
        pgNet: null,
    })
    const [loading, setLoading] = useState(true)

    const abortRef = useRef<AbortController | null>(null)

    const refetch = useCallback(async () => {
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller

        // Les deux sondes sont indépendantes : un service Go à l'arrêt ne doit
        // pas empêcher de voir l'état de pg_net, et réciproquement.
        const [reachable, pgNet] = await Promise.all([
            pingNewsletterApi(controller.signal),
            fetchPgNetHealth(),
        ])
        if (controller.signal.aborted) return

        if (!reachable) {
            setHealth({ reachable: false, status: null, pgNet })
            setLoading(false)
            return
        }

        try {
            const status = await fetchServiceStatus(controller.signal)
            if (controller.signal.aborted) return
            setHealth({ reachable: true, status, pgNet })
        } catch {
            // Service debout mais /status refusé ou en erreur : on garde
            // `reachable` à true, l'absence de `status` suffit à masquer le
            // bloc debounce sans crier à la panne.
            if (!controller.signal.aborted) {
                setHealth({ reachable: true, status: null, pgNet })
            }
        } finally {
            if (!controller.signal.aborted) setLoading(false)
        }
    }, [])

    useEffect(() => {
        refetch()
        const id = window.setInterval(refetch, SERVICE_STATUS_POLL_MS)
        return () => {
            window.clearInterval(id)
            abortRef.current?.abort()
        }
    }, [refetch])

    return { health, loading, refetch }
}
