import { useCallback, useEffect, useRef, useState } from "react"
import * as historyService from "@/features/stock_handpick/services/balleEmplacementHistoryService"
import type { BalleEmplacementEvent } from "@/features/stock_handpick/types/balle.types"

/**
 * Historique d'emplacement d'une balle, et les noms des personnes qu'il cite.
 *
 * Chargé à la demande, quand la fiche s'ouvre : `balleId` à `null` ne charge
 * rien, et seule la dernière lecture lancée écrit l'état.
 *
 * `refreshKey` relance la lecture : la fiche passe `updated_at` et
 * `borrowed_by`, si bien qu'un emprunt ou un retour — d'ici ou d'ailleurs,
 * via le realtime de l'inventaire — rafraîchit l'historique.
 *
 * `extraUserIds` : utilisateurs à nommer en plus des auteurs (l'emprunteur
 * courant), résolus dans la même requête.
 */
export function useBalleEmplacementHistory(
    balleId: string | null,
    refreshKey: string,
    extraUserIds: readonly (string | null)[] = [],
) {
    const [events, setEvents] = useState<BalleEmplacementEvent[]>([])
    const [userNames, setUserNames] = useState<Map<string, string>>(() => new Map())
    const [loading, setLoading] = useState(false)
    const requestRef = useRef(0)

    const extraKey = extraUserIds.filter(Boolean).join(",")

    const fetchHistory = useCallback(async () => {
        const request = ++requestRef.current
        if (!balleId) {
            setEvents([])
            return
        }
        setLoading(true)
        try {
            const rows = await historyService.fetchEmplacementHistory(balleId)
            const ids = new Set<string>(extraKey ? extraKey.split(",") : [])
            for (const row of rows) if (row.user_id) ids.add(row.user_id)
            // Un nom manquant n'invalide pas l'historique : on l'affiche sans.
            const names = await historyService
                .fetchUserNames([...ids])
                .catch(() => new Map<string, string>())
            if (request !== requestRef.current) return
            setEvents(rows)
            setUserNames(names)
        } catch (error) {
            if (request !== requestRef.current) return
            console.error(error)
            setEvents([])
        } finally {
            if (request === requestRef.current) setLoading(false)
        }
    }, [balleId, extraKey])

    // `refreshKey` ne sert qu'à relancer la lecture.
    useEffect(() => {
        fetchHistory()
    }, [fetchHistory, refreshKey])

    return { events, userNames, loading }
}
