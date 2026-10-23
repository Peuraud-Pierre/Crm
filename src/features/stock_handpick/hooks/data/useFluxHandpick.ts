import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import * as fluxService from "@/features/stock_handpick/services/fluxHandpickService"
import { FLUX_PAGE_SIZE, REALTIME_DEBOUNCE_MS } from "@/features/stock_handpick/constants"
import type {
    FluxFormInput,
    FluxHandpickRow,
} from "@/features/stock_handpick/types/flux.types"

/**
 * Hook bas niveau des expéditions — fetch + mutations via la couche service.
 *
 * Une seule liste pour les deux sens, contrairement au modèle précédent qui
 * chargeait arrivages et départs séparément : le tableau groupe par mois et
 * pagine par mois, or deux jeux paginés indépendamment ne peuvent pas partager
 * un découpage mensuel. Le filtrage par sens se fait ensuite en mémoire.
 */
export function useFluxHandpick() {
    const [flux, setFlux] = useState<FluxHandpickRow[] | undefined>(undefined)
    const [total, setTotal] = useState(0)
    const [limit, setLimit] = useState(FLUX_PAGE_SIZE)
    const { user } = useAuth()

    // Garder `limit` dans une ref évite de recréer la callback (et donc de
    // relancer l'abonnement realtime) à chaque palier.
    const limitRef = useRef(limit)
    useEffect(() => {
        limitRef.current = limit
    }, [limit])

    const fetchFlux = useCallback(async () => {
        try {
            const [rows, count] = await Promise.all([
                fluxService.fetchFlux(limitRef.current),
                fluxService.fetchFluxCount(),
            ])
            setFlux(rows)
            setTotal(count)
        } catch (error) {
            toast.error("Erreur lors du chargement des flux")
            console.error(error)
            // Une liste vide plutôt qu'un chargement perpétuel : l'écran doit
            // pouvoir afficher son état vide et son bouton de création.
            setFlux([])
        }
    }, [])

    const loadMore = useCallback(() => {
        setLimit((current) => current + FLUX_PAGE_SIZE)
    }, [])

    /**
     * Lecture unitaire : une expédition plus ancienne que le palier chargé
     * (lien depuis la fiche d'une balle, notification) n'est pas dans `flux`.
     * `null` en échec comme en absence — la garde de lien profond traite les
     * deux cas de la même façon.
     */
    const fetchFluxById = useCallback(async (id: string) => {
        try {
            return await fluxService.fetchFluxById(id)
        } catch (error) {
            console.error(error)
            return null
        }
    }, [])

    // ─── Mutations — throw on error ───────────────────────────────────────────

    const createFlux = useCallback(
        async (payload: FluxFormInput) => {
            const created = await fluxService.insertFlux(payload)
            await fetchFlux()
            return created
        },
        [fetchFlux],
    )

    const updateFlux = useCallback(
        async (id: string, payload: Partial<FluxFormInput>) => {
            await fluxService.patchFlux(id, payload)
            await fetchFlux()
        },
        [fetchFlux],
    )

    const removeFlux = useCallback(
        async (id: string) => {
            await fluxService.removeFlux(id)
            await fetchFlux()
        },
        [fetchFlux],
    )

    // ─── Init & realtime ───────────────────────────────────────────────────────

    useEffect(() => {
        if (!user?.user_id) return
        fetchFlux()
    }, [user?.user_id, limit, fetchFlux])

    useEffect(() => {
        if (!user?.user_id) return

        let timer: ReturnType<typeof setTimeout> | undefined
        const unsubscribe = fluxService.subscribeToFlux(user.user_id, () => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => {
                fetchFlux()
            }, REALTIME_DEBOUNCE_MS)
        })

        return () => {
            if (timer) clearTimeout(timer)
            unsubscribe()
        }
    }, [user?.user_id, fetchFlux])

    return {
        flux,
        total,
        loading: flux === undefined,
        hasMore: (flux?.length ?? 0) < total,
        loadMore,
        fetchFlux,
        fetchFluxById,
        createFlux,
        updateFlux,
        removeFlux,
    }
}
