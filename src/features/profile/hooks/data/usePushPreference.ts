import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    ensurePushSubscription,
    hasPushSubscription,
    isPushSupported,
    removePushSubscription,
} from "@/shared/lib/pwa"

/** Position du navigateur sur les notifications, hors décision applicative. */
export type PushPermission = "default" | "granted" | "denied" | "unsupported"

function readPermission(): PushPermission {
    if (!isPushSupported()) return "unsupported"
    return Notification.permission
}

/**
 * Notifications push de **cet appareil** : le navigateur a le dernier mot
 * (une permission refusée ne peut pas être rétablie depuis la page), et
 * l'abonnement lui-même est propre au couple appareil/navigateur.
 *
 * Le consentement applicatif, lui, est une préférence de compte portée par
 * `useUserPreferences` (`push_enabled`).
 */
export function usePushPreference() {
    const { user } = useAuth()
    const userId = user?.user_id ?? user?.id ?? null

    const [permission, setPermission] = useState<PushPermission>(readPermission)
    const [subscribed, setSubscribed] = useState(false)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        let cancelled = false

        hasPushSubscription()
            .then((value) => {
                if (!cancelled) setSubscribed(value)
            })
            .catch((err) => {
                console.error("[usePushPreference] hasPushSubscription:", err)
            })

        return () => {
            cancelled = true
        }
    }, [])

    /** Demande la permission si besoin, puis inscrit l'appareil. */
    const enable = useCallback(async (): Promise<boolean> => {
        if (!userId || permission === "unsupported") return false

        setBusy(true)
        try {
            const granted =
                Notification.permission === "granted"
                    ? "granted"
                    : await Notification.requestPermission()

            setPermission(granted)
            if (granted !== "granted") {
                toast.error(
                    "Les notifications ont été refusées dans le navigateur."
                )
                return false
            }

            await ensurePushSubscription(userId)
            const active = await hasPushSubscription()
            setSubscribed(active)
            return active
        } catch (err) {
            console.error("[usePushPreference] enable:", err)
            toast.error("Impossible d'activer les notifications push.")
            return false
        } finally {
            setBusy(false)
        }
    }, [userId, permission])

    const disable = useCallback(async (): Promise<boolean> => {
        setBusy(true)
        try {
            await removePushSubscription()
            setSubscribed(false)
            return true
        } catch (err) {
            console.error("[usePushPreference] disable:", err)
            toast.error("Impossible de désactiver les notifications push.")
            return false
        } finally {
            setBusy(false)
        }
    }, [])

    return { permission, subscribed, busy, enable, disable }
}
