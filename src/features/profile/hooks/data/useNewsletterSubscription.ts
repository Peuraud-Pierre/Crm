import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    fetchNewsletterSubscription,
    subscribeToNewsletter,
    unsubscribeFromNewsletter,
} from "../../services/newsletterService"
import {
    NEWSLETTER_COLUMNS,
    NEWSLETTER_COLUMN_PERMISSION_PREFIX,
} from "../../constants"

/**
 * Abonnement de l'utilisateur à la newsletter arrivages.
 *
 * Les colonnes proposées sont filtrées par permission : `allowedColumns`
 * est mémoïsé sur `hasPermission` — le recalculer à chaque rendu ferait
 * changer l'identité de `refetch` et relancerait la lecture en boucle.
 */
export function useNewsletterSubscription() {
    const { user, hasPermission } = useAuth()
    const userId = user?.user_id ?? user?.id ?? null

    const allowedColumns = useMemo(
        () =>
            NEWSLETTER_COLUMNS.filter((column) =>
                hasPermission(
                    `${NEWSLETTER_COLUMN_PERMISSION_PREFIX}${column.key}`
                )
            ),
        [hasPermission]
    )

    const [isSubscribed, setIsSubscribed] = useState(false)
    const [selected, setSelected] = useState<Set<string>>(() => new Set())
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const requestIdRef = useRef(0)

    const refetch = useCallback(async () => {
        if (!userId) return

        const requestId = ++requestIdRef.current
        const permitted = new Set<string>(allowedColumns.map((c) => c.key))
        try {
            const subscription = await fetchNewsletterSubscription(userId)
            if (requestIdRef.current !== requestId) return

            setIsSubscribed(subscription?.active ?? false)
            // On restaure la sélection précédente, amputée des colonnes que
            // l'utilisateur n'a plus le droit de recevoir.
            const restored = new Set(
                (subscription?.visible_columns ?? []).filter((key) =>
                    permitted.has(key)
                )
            )
            setSelected(restored.size > 0 ? restored : permitted)
        } catch (err) {
            if (requestIdRef.current !== requestId) return
            console.error("[useNewsletterSubscription] refetch:", err)
            toast.error("Erreur lors du chargement de l'abonnement")
            setSelected(permitted)
        } finally {
            if (requestIdRef.current === requestId) setLoading(false)
        }
    }, [userId, allowedColumns])

    useEffect(() => {
        refetch()
    }, [refetch])

    const toggleColumn = useCallback((key: string) => {
        setSelected((previous) => {
            const next = new Set(previous)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }, [])

    const subscribe = useCallback(
        async (invitationCode: string): Promise<boolean> => {
            const columns = allowedColumns
                .map((c) => c.key)
                .filter((key) => selected.has(key))

            if (columns.length === 0) {
                toast.error("Sélectionnez au moins une colonne.")
                return false
            }

            setSaving(true)
            const wasSubscribed = isSubscribed
            try {
                await subscribeToNewsletter({
                    email: user?.email ?? "",
                    full_name: user?.full_name ?? "",
                    visible_columns: columns,
                    invitation_code: invitationCode,
                })
                setIsSubscribed(true)
                toast.success(
                    wasSubscribed
                        ? "Préférences mises à jour."
                        : "Abonnement enregistré."
                )
                return true
            } catch (err) {
                console.error("[useNewsletterSubscription] subscribe:", err)
                toast.error(
                    err instanceof Error ? err.message : "Erreur inattendue."
                )
                return false
            } finally {
                setSaving(false)
            }
        },
        [allowedColumns, selected, isSubscribed, user]
    )

    const unsubscribe = useCallback(async (): Promise<boolean> => {
        setSaving(true)
        try {
            await unsubscribeFromNewsletter()
            setIsSubscribed(false)
            toast.success("Désabonnement effectué.")
            return true
        } catch (err) {
            console.error("[useNewsletterSubscription] unsubscribe:", err)
            toast.error(
                err instanceof Error ? err.message : "Erreur inattendue."
            )
            return false
        } finally {
            setSaving(false)
        }
    }, [])

    return {
        allowedColumns,
        isSubscribed,
        selected,
        loading,
        saving,
        toggleColumn,
        subscribe,
        unsubscribe,
    }
}
