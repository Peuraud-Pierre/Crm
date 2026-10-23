import { useCallback, useEffect, useRef, useState } from "react"
import { STATUS_POLL_MS } from "@/features/packing-admin/constants"
import {
    fetchPackingServiceStatus,
    packingApiConfigured,
    packingApiReachable,
} from "@/features/packing-admin/services/packingAdminApi"
import { useAbortableResource } from "@/features/packing-admin/hooks/useAbortableResource"
import { PackingApiError } from "@/shared/services/packingApiClient"
import type { PackingServiceStatus } from "@/features/packing-admin/types"

/**
 * État du service, sondé tant que la console est ouverte.
 *
 * `/health` est interrogé SÉPARÉMENT de `/status`, et sans jeton. C'est ce qui
 * permet de distinguer deux pannes qui ne se corrigent pas du tout de la même
 * façon : un service à l'arrêt (on le relance) d'un service debout qui refuse la
 * requête (session sans MFA, ou droit manquant). Confondues, elles envoient
 * regarder le mauvais endroit.
 */
export function usePackingServiceStatus() {
    const configured = packingApiConfigured()

    const [pinged, setPinged] = useState<boolean | null>(null)
    const pingAbortRef = useRef<AbortController | null>(null)

    // Dérivé : sans URL de service il n'y a rien à joindre, et c'est vrai sans
    // qu'un effet ait à l'écrire.
    const reachable = configured ? pinged : false

    const ping = useCallback(async () => {
        pingAbortRef.current?.abort()
        const controller = new AbortController()
        pingAbortRef.current = controller
        const alive = await packingApiReachable(controller.signal)
        if (!controller.signal.aborted) setPinged(alive)
    }, [])

    useEffect(() => {
        if (!configured) return
        ping()
        const id = window.setInterval(ping, STATUS_POLL_MS)
        return () => {
            window.clearInterval(id)
            pingAbortRef.current?.abort()
        }
    }, [ping, configured])

    const load = useCallback(
        (signal: AbortSignal) => fetchPackingServiceStatus(signal),
        [],
    )
    const resource = useAbortableResource<PackingServiceStatus>(load, {
        pollMs: STATUS_POLL_MS,
        enabled: configured,
    })

    return {
        configured,
        reachable,
        status: resource.data,
        loading: resource.loading,
        /** Code HTTP inclus : le bandeau d'alertes distingue un 403 du reste. */
        error: resource.error
            ? {
                  message: resource.error.message,
                  status: resource.error instanceof PackingApiError ? resource.error.status : null,
              }
            : null,
        refetch: async () => {
            await Promise.all([ping(), resource.refetch()])
        },
    }
}
