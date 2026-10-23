import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/features/auth/hooks/useAuth"
import { subscribeToTable } from "@/features/crm/services/realtimeService"
import { getErrorMessage } from "@/features/crm/utils/errors"
import type { Devis } from "@/features/crm/types"
import * as devisService from "@/features/crm/services/devisService"

// --- Types re-exportés depuis le fichier de types partagés ---
export type {
    Payment,
    LigneProduit,
    Devis,
    DevisTableau,
} from "@/features/crm/types"

// --- HOOK PRINCIPAL ---

export function useDevis(realtimeEnabled: boolean = true) {
    const { user } = useAuth()
    const [devisList, setDevisList] = useState<Devis[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Ref toujours à jour pour éviter les stale closures dans DeleteDevis
    const devisListRef = useRef<Devis[]>([])
    useEffect(() => {
        devisListRef.current = devisList
    }, [devisList])

    // --- HELPER: Récupérer un devis complet ---
    const fetchOneFullDevis = useCallback(devisService.fetchOneFullDevis, [])

    /** ---------- CREATE ---------- */
    const Register_devis = useCallback(
        async (newDevis: Devis) => {
            setError(null)
            const tempId = `temp-${Date.now()}`

            // Optimistic Update
            setDevisList((prev) => [{ ...newDevis, id: tempId }, ...prev])

            try {
                // 1. Insert Devis
                const createdDevis = await devisService.createDevis(
                    newDevis,
                    user?.user_id
                )

                // 2. Insert Products
                if (newDevis.Tableau && newDevis.Tableau.length > 0) {
                    await devisService.insertDevisLines(
                        createdDevis.Tableau_id,
                        newDevis.Tableau
                    )
                }

                // 3. Re-sync via DB
                const freshDevis = await fetchOneFullDevis(createdDevis.id)

                if (freshDevis) {
                    setDevisList((prev) =>
                        prev.map((d) => (d.id === tempId ? freshDevis : d))
                    )
                    return freshDevis
                }
            } catch (err: unknown) {
                console.error("❌ Erreur création:", err)
                setError(getErrorMessage(err))
                setDevisList((prev) => prev.filter((d) => d.id !== tempId))
                throw err
            }
        },
        [user?.user_id, fetchOneFullDevis]
    )

    /** ---------- UPDATE ---------- */
    const Update_devis = useCallback(
        async (devis: Devis) => {
            setError(null)
            if (!devis.id) return

            let previousList: Devis[] = []
            setDevisList((prev) => {
                previousList = prev
                return prev.map((d) => (d.id === devis.id ? devis : d))
            })

            try {
                const updatedMeta = await devisService.updateDevisHeader(
                    devis as Devis & { id: string }
                )

                const tableauId = updatedMeta?.Tableau_id

                if (tableauId) {
                    await devisService.deleteDevisLines(tableauId)

                    if (devis.Tableau && devis.Tableau.length > 0) {
                        await devisService.insertDevisLines(
                            tableauId,
                            devis.Tableau
                        )
                    }
                }

                const freshDevis = await fetchOneFullDevis(devis.id)
                if (freshDevis) {
                    setDevisList((prev) =>
                        prev.map((d) => (d.id === devis.id ? freshDevis : d))
                    )
                }
            } catch (err: unknown) {
                console.error("❌ Erreur mise à jour:", err)
                setError(getErrorMessage(err))
                setDevisList(previousList)
            }
        },
        [fetchOneFullDevis]
    )

    /** ---------- DELETE ---------- */
    const DeleteDevis = useCallback(
        async (id_devis: string, tableau_id?: string) => {
            setError(null)

            // Snapshot stable via ref (évite la stale closure sans ajouter devisList aux deps)
            const previousList = devisListRef.current
            const devisToDelete = previousList.find((d) => d.id === id_devis)

            // 1. Mise à jour optimiste
            setDevisList((prev) => prev.filter((d) => d.id !== id_devis))

            try {
                // 2. Suppression des produits (Enfants)
                const targetTableauId = tableau_id || devisToDelete?.Tableau_id
                if (targetTableauId) {
                    await devisService.deleteDevisLines(targetTableauId)
                }

                // 3. Suppression du Devis (Parent)
                await devisService.deleteDevis(id_devis)
            } catch (err: unknown) {
                setError(getErrorMessage(err))
                // Rollback si échec
                setDevisList(previousList)
            }
        },
        [] // stable — lit via devisListRef.current au moment de l'appel
    )
    /** ---------- FETCH ---------- */
    const fetchDevisByUser = useCallback(
        async (info: { type: string; id: string }) => {
            setIsLoading(true)
            setError(null)
            try {
                const formattedDevis = await devisService.fetchDevisByUser(info)
                setDevisList(formattedDevis)
                return formattedDevis
            } catch (err: unknown) {
                console.error("Erreur fetch:", err)
                setError(getErrorMessage(err))
                return []
            } finally {
                setIsLoading(false)
            }
        },
        []
    )

    /** ---------- REALTIME ---------- */
    // Abonnement monté uniquement quand le flux devis est actif (onglet Bon de
    // commande / création). Hors de là (ex. onglet Clients), `fetchDevisByUser`
    // reste utilisable à la demande sans channel ouvert.
    useEffect(() => {
        if (!realtimeEnabled) return
        if (!user?.user_id) return

        const unsubscribe = subscribeToTable<Devis>(
            "devis_realtime_smart",
            "Devis",
            undefined,
            async ({ eventType, newRow, oldRow }) => {
                if (eventType === "DELETE") {
                    setDevisList((prev) =>
                        prev.filter((d) => d.id !== oldRow.id)
                    )
                    return
                }

                if (newRow.id) {
                    const newId = newRow.id
                    const fullData = await fetchOneFullDevis(newId)

                    if (fullData) {
                        setDevisList((prev) => {
                            const exists = prev.find((d) => d.id === newId)
                            if (eventType === "INSERT") {
                                if (exists)
                                    return prev.map((d) =>
                                        d.id === newId ? fullData : d
                                    )
                                return [fullData, ...prev]
                            } else {
                                return prev.map((d) =>
                                    d.id === newId ? fullData : d
                                )
                            }
                        })
                    }
                }
            }
        )

        return unsubscribe
    }, [realtimeEnabled, user?.user_id, fetchOneFullDevis])

    // --- RETURN ---
    const values = useMemo(
        () => ({
            Devis: devisList,
            isLoading,
            error,
            Register_devis,
            fetchDevisByUser,
            Update_devis,
            DeleteDevis,
        }),
        [
            devisList,
            isLoading,
            error,
            Register_devis,
            fetchDevisByUser,
            Update_devis,
            DeleteDevis,
        ]
    )

    return values
}

export type fetchDevisType = ReturnType<typeof useDevis>
