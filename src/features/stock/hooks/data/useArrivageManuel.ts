import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import * as arrivageService from "@/features/stock/services/arrivageService"
import { fetchPackingSummaries } from "@/features/stock/services/packingListService"
import type {
    ArrivageManuelRow,
    ArrivageManuelCreateInput,
    ArrivageManuelUpdateInput,
} from "@/features/stock/types/arrivage-manuel.types"
import type { PackingListSummary } from "@/features/stock/types/packing-list.types"

/**
 * Synthèses de packing, sans jamais faire échouer le chargement des arrivages.
 *
 * `null` = lecture impossible (migration pas encore appliquée dans cet
 * environnement, erreur réseau) : les lignes gardent alors `packing` INDÉFINI
 * et tout le module packing reste invisible, plutôt que d'afficher « aucune
 * packing » sur des arrivages qui en ont peut-être une.
 */
async function loadPackingSummaries(): Promise<PackingListSummary[] | null> {
    try {
        return await fetchPackingSummaries()
    } catch (err) {
        console.warn("[useArrivageManuel] packing lists indisponibles :", err)
        return null
    }
}

/**
 * Hook bas niveau des arrivages manuels — fetch + mutations via la couche
 * service (`services/arrivageService.ts`).
 *
 * Chaque ligne reçoit sa synthèse de packing list (`row.packing`), résolue
 * côté client comme le fournisseur : deux requêtes plates plutôt qu'un
 * embarquement PostgREST sur une vue.
 */
export function useArrivageManuel() {
    const [rows, setRows] = useState<ArrivageManuelRow[] | undefined>(undefined)

    const fetchAll = useCallback(async () => {
        try {
            const [arrivages, summaries] = await Promise.all([
                arrivageService.fetchArrivages(),
                loadPackingSummaries(),
            ])
            if (summaries === null) {
                setRows(arrivages)
                return
            }
            const byArrivage = new Map(summaries.map((s) => [s.arrivage_manuel_id, s]))
            setRows(arrivages.map((row) => ({ ...row, packing: byArrivage.get(row.id) ?? null })))
        } catch (err) {
            toast.error("Erreur lors du chargement des arrivages")
            console.error("[useArrivageManuel] fetchAll:", err)
        }
    }, [])

    useEffect(() => { fetchAll() }, [fetchAll])

    const create = useCallback(async (
        data: ArrivageManuelCreateInput,
    ): Promise<ArrivageManuelRow | null> => {
        try {
            const created = await arrivageService.insertArrivage(data)
            toast.success("Arrivage créé")
            await fetchAll()
            return created
        } catch (err) {
            toast.error("Erreur lors de la création")
            console.error("[useArrivageManuel] create:", err)
            return null
        }
    }, [fetchAll])

    const update = useCallback(async (
        id: string,
        patch: ArrivageManuelUpdateInput,
    ): Promise<void> => {
        try {
            await arrivageService.patchArrivage(id, patch)
            toast.success("Arrivage mis à jour")
            await fetchAll()
        } catch (err) {
            toast.error("Erreur lors de la mise à jour")
            console.error("[useArrivageManuel] update:", err)
            throw err
        }
    }, [fetchAll])

    const remove = useCallback(async (id: string): Promise<void> => {
        try {
            await arrivageService.removeArrivage(id)
            await fetchAll()
        } catch (err) {
            // Sans ce toast, une suppression refusée (droit manquant, RLS)
            // n'apparaissait que dans la console : le dialogue se refermait et
            // l'arrivage restait là, sans explication.
            toast.error("Erreur lors de la suppression")
            console.error("[useArrivageManuel] remove:", err)
            throw err
        }
    }, [fetchAll])

    return { rows, fetchAll, create, update, remove }
}
