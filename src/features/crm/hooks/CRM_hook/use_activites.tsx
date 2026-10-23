import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { subscribeToTable } from "@/features/crm/services/realtimeService"
import { safeRandomUUID } from "@/shared/lib/uuid"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
    fetchActivites,
    touchClientTimestamp,
    createActivite,
    updateActivite,
    deleteActivite,
} from "@/features/crm/services/activitesService"

// --- Types re-exportés depuis le fichier de types partagés ---
export type { activites, ActiviteInput } from "@/features/crm/types"
import type { activites, ActiviteInput } from "@/features/crm/types"

export function useActivites() {
    const { user } = useAuth()
    const [activites, setActivites] = useState<activites[]>([])
    const [isLoading, setIsLoading] = useState<boolean>(false)
    const [currentClientId, setCurrentClientId] = useState<string | null>(null)

    // Ref pour éviter les conflits de requêtes
    const currentClientIdRef = useRef<string | null>(null)

    // Ref pour tracker les IDs récemment insérés localement
    // afin que la subscription Realtime ne les ré-ajoute pas en doublon
    const recentlyInsertedIdsRef = useRef<Set<string>>(new Set())

    // ✅ 1. TRI STABLE & ROBUSTE
    const stableSort = useCallback((list: activites[]) => {
        return [...list].sort((a, b) => {
            // A. Date d'activité (User date)
            const dateA = a.date ? new Date(a.date).getTime() : 0
            const dateB = b.date ? new Date(b.date).getTime() : 0
            // Sécurité NaN
            const safeA = isNaN(dateA) ? 0 : dateA
            const safeB = isNaN(dateB) ? 0 : dateB

            if (safeA !== safeB) return safeB - safeA

            // B. Date de création (System date - Stabilisateur)
            const createdA = a.created_at ? new Date(a.created_at).getTime() : 0
            const createdB = b.created_at ? new Date(b.created_at).getTime() : 0
            if (createdA !== createdB) return createdB - createdA

            // C. Fallback ID
            return (a.id || "").localeCompare(b.id || "")
        })
    }, [])

    // ✅ 2. FETCH (Lecture)
    // ✅ 2. FETCH (Lecture avec récupération de l'owner)
    const fetch_activite = useCallback(
        async (clientId?: string | null) => {
            // On utilise "ALL" comme identifiant interne si aucun clientId n'est fourni
            const effectiveId = clientId || "ALL"

            // Nettoyage immédiat si changement de client (ou passage au mode "tout voir")
            if (currentClientIdRef.current !== effectiveId) {
                setActivites([])
            }

            currentClientIdRef.current = effectiveId
            setCurrentClientId(clientId || "") // Remets string vide ou null selon ton state
            setIsLoading(true)

            try {
                const data = await fetchActivites(clientId)

                // Vérification anti-race condition
                if (currentClientIdRef.current === effectiveId) {
                    setActivites(stableSort(data))
                }
            } catch (err) {
                console.error("❌ Erreur fetch:", err)
            } finally {
                if (currentClientIdRef.current === effectiveId) {
                    setIsLoading(false)
                }
            }
        },
        [stableSort]
    )

    // ✅ 3. CREATE (Le coeur du correctif)
    // ✅ 3. CREATE (Version corrigée anti-doublon)
    const create_activites = useCallback(
        async (activite: ActiviteInput) => {
            if (!activite.client) return

            // On génère un tempId pour l'UI locale
            const tempId = safeRandomUUID()
            const now = new Date().toISOString()

            const optimisticActivity: activites = {
                ...activite,
                id: tempId,
                client: activite.client,
                date: activite.date || now,
                created_at: now,
                title: activite.title || "",
                content: activite.content || "",
                owner: user?.user_id || "unknown",
            } as activites

            // 1. On ajoute l'élément optimiste
            setActivites((prev) => stableSort([optimisticActivity, ...prev]))

            try {
                // Préparation du payload sans l'ID (la DB le gère)
                const payloadWithoutId = { ...optimisticActivity }
                delete (payloadWithoutId as Partial<activites>).id
                delete (payloadWithoutId as Partial<activites>).created_at

                const data = await createActivite(payloadWithoutId)

                // On marque le vrai ID comme "déjà inséré localement" AVANT
                // la mise à jour du state, pour que si le Realtime arrive
                // entre-temps, il l'ignore au lieu de créer un doublon.
                const realId = data?.id
                if (realId) {
                    recentlyInsertedIdsRef.current.add(realId)
                    // Nettoyage différé : on laisse le temps au Realtime de passer
                    setTimeout(() => {
                        recentlyInsertedIdsRef.current.delete(realId)
                    }, 10000)
                }

                // 2. IMPORTANT : Au lieu d'ajouter DATA (ce qui ferait un doublon avec le Realtime),
                // on remplace juste le tempId par le vrai ID dans la liste actuelle.
                setActivites((prev) => {
                    return prev.map((a) =>
                        a.id === tempId ? (data as activites) : a
                    )
                })

                await touchClientTimestamp(activite.client)
            } catch (err) {
                console.error("❌ Erreur création:", err)
                toast.error("Erreur lors de la création")
                // Rollback uniquement si erreur
                setActivites((prev) => prev.filter((a) => a.id !== tempId))
            }
        },
        [user?.user_id, stableSort, touchClientTimestamp]
    ) // Ajout des dépendances

    // ✅ 4. UPDATE
    const update_Activites = useCallback(
        async (act: Partial<activites>) => {
            if (!act.id) return

            setActivites((prev) =>
                stableSort(
                    prev.map((a) =>
                        a.id === act.id ? ({ ...a, ...act } as activites) : a
                    )
                )
            )

            try {
                await updateActivite(act.id, act)
                if (act.client) await touchClientTimestamp(act.client)
            } catch {
                // En cas d'erreur, on recharge pour être sûr
                if (currentClientIdRef.current)
                    fetch_activite(currentClientIdRef.current)
            }
        },
        [stableSort, fetch_activite, touchClientTimestamp]
    )

    // ✅ 5. DELETE
    const delete_activites = async (id?: string, clientID?: string) => {
        if (!id) return
        const backup = [...activites]

        setActivites((prev) => prev.filter((a) => a.id !== id))

        try {
            await deleteActivite(id)
            if (clientID) await touchClientTimestamp(clientID)
        } catch {
            toast.error("Erreur suppression")
            setActivites(backup)
        }
    }

    // ✅ 6. REALTIME (Sécurisé)
    useEffect(() => {
        if (!user?.user_id || !currentClientId) return

        const unsubscribe = subscribeToTable<activites>(
            `realtime-activites-${currentClientId}`,
            "Client_activite",
            `client=eq.${currentClientId}`,
            ({ eventType, newRow, oldRow }) => {
                setActivites((prev) => {
                    let newList = [...prev]

                    if (eventType === "INSERT" && newRow.id) {
                        // Skip si on vient de l'insérer localement
                        // (évite la race condition optimistic ↔ realtime)
                        if (recentlyInsertedIdsRef.current.has(newRow.id))
                            return prev
                        // Anti-doublon strict
                        if (prev.some((a) => a.id === newRow.id)) return prev
                        newList = [newRow as activites, ...prev]
                    }

                    if (eventType === "UPDATE" && newRow.id) {
                        newList = prev.map((a) =>
                            a.id === newRow.id
                                ? // 🔥 Merge Safe ici aussi
                                  { ...a, ...(newRow as activites) }
                                : a
                        )
                    }

                    if (eventType === "DELETE" && oldRow.id) {
                        newList = prev.filter((a) => a.id !== oldRow.id)
                    }

                    return stableSort(newList)
                })
            }
        )

        return unsubscribe
    }, [user?.user_id, currentClientId, stableSort])

    return {
        activites,
        isLoading,
        create_activites,
        fetch_activite,
        update_Activites,
        delete_activites,
    }
}
