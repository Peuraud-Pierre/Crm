import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Une lecture distante, annulable, éventuellement sondée en continu.
 *
 * Le dépôt n'utilise pas TanStack Query (installé, mais employé nulle part) : la
 * convention est un hook écrit à la main qui rend `{data, loading, error,
 * refetch}`. Ce socle en tient la mécanique une seule fois, pour les cinq
 * lectures de la console.
 *
 * Trois points qui justifient de le factoriser plutôt que de le recopier :
 *
 *  · **Annulation.** Un changement de curseur de simulation part avant que la
 *    réponse précédente arrive. Sans `AbortController`, la réponse tardive écrase
 *    la plus récente et l'écran affiche un état qu'on a déjà quitté.
 *  · **Pas de `toast`.** Quand le service est à l'arrêt, l'erreur est remontée à
 *    l'appelant qui l'affiche UNE fois dans le bandeau d'alertes, au lieu d'une
 *    notification à chaque sondage.
 *  · **`loading` ne repasse pas à vrai sur un rafraîchissement silencieux.** Un
 *    sondage toutes les 30 s ferait clignoter les squelettes sans rien apprendre.
 */

export interface AbortableResource<T> {
    data: T | null
    loading: boolean
    error: Error | null
    /** `silent` : ne repasse pas par l'état de chargement (sondage, auto-refresh). */
    refetch: (options?: { silent?: boolean }) => Promise<void>
}

export function useAbortableResource<T>(
    load: (signal: AbortSignal) => Promise<T>,
    options?: { pollMs?: number; enabled?: boolean },
): AbortableResource<T> {
    const pollMs = options?.pollMs
    const enabled = options?.enabled ?? true

    const [data, setData] = useState<T | null>(null)
    const [fetching, setFetching] = useState(enabled)
    const [error, setError] = useState<Error | null>(null)

    // Dérivé, pas stocké : une lecture désactivée ne charge rien, quel que soit
    // l'état laissé par une activation précédente. Le poser depuis l'effet
    // demanderait un `setState` de plus dans un effet, pour une valeur que
    // `enabled` détermine déjà.
    const loading = enabled && fetching

    const abortRef = useRef<AbortController | null>(null)

    const refetch = useCallback(
        async ({ silent = false }: { silent?: boolean } = {}) => {
            abortRef.current?.abort()
            const controller = new AbortController()
            abortRef.current = controller

            if (!silent) setFetching(true)
            try {
                const next = await load(controller.signal)
                if (controller.signal.aborted) return
                setData(next)
                setError(null)
            } catch (err) {
                // Une annulation n'est pas une panne : elle est décidée par nous.
                if (controller.signal.aborted) return
                if (err instanceof DOMException && err.name === "AbortError") return
                setError(err instanceof Error ? err : new Error("Erreur inattendue."))
            } finally {
                if (!controller.signal.aborted) setFetching(false)
            }
        },
        [load],
    )

    useEffect(() => {
        if (!enabled) return
        refetch()
        if (!pollMs) return () => abortRef.current?.abort()

        const id = window.setInterval(() => refetch({ silent: true }), pollMs)
        return () => {
            window.clearInterval(id)
            abortRef.current?.abort()
        }
    }, [refetch, pollMs, enabled])

    return { data, loading, error, refetch }
}
