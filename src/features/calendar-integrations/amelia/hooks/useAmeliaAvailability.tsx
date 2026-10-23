import { useCallback, useEffect, useState } from "react"
import { getAccessToken } from "../../services/calendarSessionService"
import {
    ameliaAvailabilityService,
    type AvailabilityPayload,
} from "../services/AmeliaAvailabilityService"

const EMPTY: AvailabilityPayload = {
    weekly: [],
    daysOff: [],
    special: [],
    closures: [],
}

/**
 * Charge / enregistre la disponibilité d'un commercial via le bridge.
 *
 * @param userId user_id Supabase ciblé. Omis = sa propre dispo. Si renseigné
 *               et différent de l'utilisateur courant, le bridge exige un rôle
 *               manager (sinon 403).
 */
export function useAmeliaAvailability(userId?: string) {
    const [availability, setAvailability] = useState<AvailabilityPayload>(EMPTY)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const getJwt = useCallback(async () => getAccessToken(), [])

    const reload = useCallback(async () => {
        try {
            setLoading(true)
            const jwt = await getJwt()
            if (!jwt) {
                setError("Session Supabase manquante")
                return
            }
            const data = await ameliaAvailabilityService.get(jwt, userId)
            setAvailability({
                weekly: data.weekly ?? [],
                daysOff: data.daysOff ?? [],
                special: data.special ?? [],
                closures: data.closures ?? [],
            })
            setError(null)
        } catch (err: unknown) {
            console.error("[useAmeliaAvailability] load", err)
            setError(err instanceof Error ? err.message : "Erreur inconnue")
        } finally {
            setLoading(false)
        }
    }, [getJwt, userId])

    useEffect(() => {
        reload()
    }, [reload])

    /** Remplace le planning et pousse vers Amelia. Retourne true si OK. */
    const save = useCallback(
        async (payload: Omit<AvailabilityPayload, "userId">) => {
            try {
                setSaving(true)
                const jwt = await getJwt()
                if (!jwt) {
                    setError("Session Supabase manquante")
                    return false
                }
                const res = await ameliaAvailabilityService.save(jwt, {
                    ...payload,
                    userId,
                })
                setAvailability({
                    weekly: payload.weekly,
                    daysOff: payload.daysOff,
                    special: payload.special,
                    closures: payload.closures ?? [],
                })
                setError(null)
                return res.saved
            } catch (err: unknown) {
                console.error("[useAmeliaAvailability] save", err)
                setError(err instanceof Error ? err.message : "Erreur inconnue")
                return false
            } finally {
                setSaving(false)
            }
        },
        [getJwt, userId]
    )

    return { availability, loading, saving, error, reload, save }
}
