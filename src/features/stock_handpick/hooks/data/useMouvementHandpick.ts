import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import * as mouvementService from "@/features/stock_handpick/services/mouvementHandpickService"
import type {
    MouvementFormInput,
    MouvementHandpick,
} from "@/features/stock_handpick/types/flux.types"

/**
 * Liste de colisage d'UNE expédition.
 *
 * Chargée à la demande, quand la sheet de l'expédition s'ouvre : le tableau des
 * flux n'affiche que les en-têtes et leurs totaux, il n'a aucune raison de
 * tirer les lignes de toutes les expéditions visibles.
 *
 * `fluxId` à `null` = aucune sheet ouverte : le hook ne charge rien.
 *
 * Seule la DERNIÈRE lecture lancée a le droit d'écrire l'état : passer vite
 * d'une expédition à l'autre pouvait sinon afficher la liste de la précédente,
 * si sa requête revenait après celle de la suivante.
 */
export function useLignesHandpick(fluxId: string | null) {
    const [lignes, setLignes] = useState<MouvementHandpick[]>([])
    const [loading, setLoading] = useState(false)
    const requestRef = useRef(0)

    const fetchLignes = useCallback(async () => {
        const request = ++requestRef.current
        if (!fluxId) {
            setLignes([])
            return
        }
        setLoading(true)
        try {
            const rows = await mouvementService.fetchLignes(fluxId)
            if (request === requestRef.current) setLignes(rows)
        } catch (error) {
            if (request !== requestRef.current) return
            toast.error("Erreur lors du chargement de la liste de colisage")
            console.error(error)
            setLignes([])
        } finally {
            if (request === requestRef.current) setLoading(false)
        }
    }, [fluxId])

    useEffect(() => {
        fetchLignes()
    }, [fetchLignes])

    // ─── Mutations — throw on error ───────────────────────────────────────────

    const addLigne = useCallback(
        async (payload: MouvementFormInput) => {
            const created = await mouvementService.insertLigne(payload)
            await fetchLignes()
            return created
        },
        [fetchLignes],
    )

    const addLignes = useCallback(
        async (payloads: MouvementFormInput[]) => {
            const created = await mouvementService.insertLignes(payloads)
            await fetchLignes()
            return created
        },
        [fetchLignes],
    )

    const updateLigne = useCallback(
        async (id: string, payload: Partial<MouvementHandpick>) => {
            await mouvementService.patchLigne(id, payload)
            await fetchLignes()
        },
        [fetchLignes],
    )

    const removeLigne = useCallback(
        async (id: string) => {
            await mouvementService.removeLigne(id)
            await fetchLignes()
        },
        [fetchLignes],
    )

    return { lignes, loading, fetchLignes, addLigne, addLignes, updateLigne, removeLigne }
}
