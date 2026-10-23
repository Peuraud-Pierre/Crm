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
 * Charge / enregistre les JOURS DE FERMETURE d'ENTREPRISE (globaux). Réservé aux
 * Admins (le bridge renvoie 403 sinon). Au save, les fermetures sont poussées au
 * réglage GLOBAL d'Amelia (amelia_settings.daysOff), qui bloque les réservations
 * de tous les commerciaux — sans toucher à leurs horaires hebdomadaires.
 *
 * Même signature que useAmeliaAvailability afin d'être interchangeable dans
 * AvailabilityEditor (prop `useController`). Le paramètre userId est ignoré.
 */
// Param userId ignoré: signature alignée sur useAmeliaAvailability (interchangeable)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useCompanyAvailability(_userId?: string) {
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
            const data = await ameliaAvailabilityService.getCompany(jwt)
            setAvailability({
                weekly: data.weekly ?? [],
                daysOff: data.daysOff ?? [],
                special: data.special ?? [],
                closures: data.closures ?? [],
            })
            setError(null)
        } catch (err: unknown) {
            console.error("[useCompanyAvailability] load", err)
            setError(err instanceof Error ? err.message : "Erreur inconnue")
        } finally {
            setLoading(false)
        }
    }, [getJwt])

    useEffect(() => {
        reload()
    }, [reload])

    const save = useCallback(
        async (payload: Omit<AvailabilityPayload, "userId">) => {
            try {
                setSaving(true)
                const jwt = await getJwt()
                if (!jwt) {
                    setError("Session Supabase manquante")
                    return false
                }
                const res = await ameliaAvailabilityService.saveCompany(
                    jwt,
                    payload
                )
                setAvailability({
                    weekly: payload.weekly,
                    daysOff: payload.daysOff,
                    special: payload.special,
                    closures: payload.closures ?? [],
                })
                // Succès réel = sauvegardé ET appliqué côté Amelia (réglage global).
                if (res.saved && res.ameliaUpdated) {
                    setError(null)
                    return true
                }
                setError(
                    res.pushError ??
                        "Enregistré dans le CRM mais non appliqué dans Amelia."
                )
                return false
            } catch (err: unknown) {
                console.error("[useCompanyAvailability] save", err)
                setError(err instanceof Error ? err.message : "Erreur inconnue")
                return false
            } finally {
                setSaving(false)
            }
        },
        [getJwt]
    )

    return { availability, loading, saving, error, reload, save }
}
