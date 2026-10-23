import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import * as balleService from "@/features/stock_handpick/services/balleHandpickService"
import type { BalleWritable } from "@/features/stock_handpick/services/balleHandpickService"
import {
    BALLE_INITIAL_LIMIT,
    BALLE_LOAD_MORE_INCREMENT,
    REALTIME_DEBOUNCE_MS,
} from "@/features/stock_handpick/constants"
import type { BalleHandpick } from "@/features/stock_handpick/types/balle.types"

/**
 * Hook bas niveau — fetch + mutations via la couche service.
 * La couche optimiste est gérée par useOptimisticCrud dans BalleHandpickContext.
 *
 * Le board charge par paliers (`limit`) plutôt que tout l'inventaire : la
 * table est celle qui grossit, et l'écran n'en montre qu'un écran à la fois.
 */
export function useBalleHandpick() {
    const [balles, setBalles] = useState<BalleHandpick[]>([])
    const [total, setTotal] = useState(0)
    const [limit, setLimit] = useState(BALLE_INITIAL_LIMIT)
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    // Le fetch lit `limit` : le garder dans une ref évite de recréer la
    // callback (et donc de relancer l'abonnement realtime) à chaque palier.
    const limitRef = useRef(limit)
    useEffect(() => {
        limitRef.current = limit
    }, [limit])

    // ─── Fetch ─────────────────────────────────────────────────────────────────

    const fetchBalles = useCallback(async () => {
        try {
            const [rows, count] = await Promise.all([
                balleService.fetchBalles(limitRef.current),
                balleService.countBalles(),
            ])
            setBalles(rows)
            setTotal(count)
        } catch (error) {
            toast.error("Erreur lors du chargement de l'inventaire")
            console.error(error)
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchSingleBalle = useCallback(async (id: string): Promise<BalleHandpick | null> => {
        try {
            return await balleService.fetchSingleBalle(id)
        } catch {
            return null
        }
    }, [])

    const loadMore = useCallback(() => {
        setLimit((current) => current + BALLE_LOAD_MORE_INCREMENT)
    }, [])

    // ─── Mutations — throw on error (gérées par useOptimisticCrud) ────────────

    const createBalle = useCallback(
        (payload: BalleWritable) => balleService.insertBalle(payload),
        [],
    )

    const createBalles = useCallback(
        (payloads: BalleWritable[]) => balleService.insertBalles(payloads),
        [],
    )

    const updateBalle = useCallback(
        async (id: string, payload: Partial<BalleHandpick>): Promise<void> => {
            await balleService.patchBalle(id, payload)
        },
        [],
    )

    const deleteBalle = useCallback(async (id: string): Promise<void> => {
        await balleService.removeBalle(id)
    }, [])

    const assignEmplacement = useCallback(
        async (id: string, emplacementId: string | null): Promise<void> => {
            await balleService.setEmplacement(id, emplacementId)
        },
        [],
    )

    const moveBalles = useCallback(
        (ids: readonly string[], emplacementId: string | null) =>
            balleService.moveBalles(ids, emplacementId),
        [],
    )

    /** Faux si quelqu'un d'autre a emprunté la balle entre-temps. */
    const borrowBalle = useCallback(
        async (id: string): Promise<boolean> => {
            if (!user?.user_id) throw new Error("Utilisateur non connecté")
            return balleService.borrowBalle(id, user.user_id)
        },
        [user?.user_id],
    )

    /** Faux si la balle a été rendue ou éclatée entre-temps. */
    const returnBalle = useCallback(
        async (id: string, emplacementId: string): Promise<boolean> =>
            balleService.returnBalle(id, emplacementId),
        [],
    )

    /** Faux si la balle était déjà éclatée. */
    const eclaterBalle = useCallback(
        async (id: string): Promise<boolean> => {
            if (!user?.user_id) throw new Error("Utilisateur non connecté")
            return balleService.eclaterBalle(id, user.user_id)
        },
        [user?.user_id],
    )

    // ─── Init & realtime ───────────────────────────────────────────────────────

    useEffect(() => {
        if (!user?.user_id) return
        fetchBalles()
    }, [user?.user_id, limit, fetchBalles])

    useEffect(() => {
        if (!user?.user_id) return

        // Une écriture groupée (un arrivage) émet un événement par ligne : on
        // ne recharge qu'une fois la rafale passée.
        let timer: ReturnType<typeof setTimeout> | undefined
        const unsubscribe = balleService.subscribeToBalles(user.user_id, () => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => { fetchBalles() }, REALTIME_DEBOUNCE_MS)
        })

        return () => {
            if (timer) clearTimeout(timer)
            unsubscribe()
        }
    }, [user?.user_id, fetchBalles])

    return {
        balles,
        total,
        limit,
        loading,
        /** Vrai tant que la base contient des balles au-delà du palier chargé. */
        hasMore: balles.length < total,
        fetchBalles,
        fetchSingleBalle,
        loadMore,
        createBalle,
        createBalles,
        updateBalle,
        deleteBalle,
        assignEmplacement,
        moveBalles,
        borrowBalle,
        returnBalle,
        eclaterBalle,
    }
}
