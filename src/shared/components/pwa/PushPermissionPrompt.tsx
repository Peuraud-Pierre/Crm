import { Button } from "@/shared/ui/atoms/button"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { ensurePushSubscription, isPushSupported } from "@/shared/lib/pwa"
import { Bell } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { PUSH_DISMISS_KEY, isRecentlyDismissed, setDismissedNow } from "./promptState"

export function PushPermissionPrompt() {
    const { user } = useAuth()
    const [isVisible, setIsVisible] = useState(false)
    const [isRequesting, setIsRequesting] = useState(false)

    const hasRecentDismissal = useMemo(() => isRecentlyDismissed(PUSH_DISMISS_KEY), [])

    useEffect(() => {
        if (!user || !isPushSupported()) {
            return
        }

        if (Notification.permission === "granted") {
            ensurePushSubscription(user.user_id).catch((error) => {
                console.error("Souscription push impossible", error)
            })
            return
        }

        if (Notification.permission === "default" && !hasRecentDismissal) {
            // Initialisation one-shot dépendant de l'état runtime de Notification.permission
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setIsVisible(true)
        }
    }, [user, hasRecentDismissal])

    const handleEnable = useCallback(async () => {
        if (!user) {
            return
        }

        setIsRequesting(true)

        try {
            const permission = await Notification.requestPermission()
            if (permission === "granted") {
                await ensurePushSubscription(user.user_id)
            } else {
                setDismissedNow(PUSH_DISMISS_KEY)
            }
        } catch (error) {
            console.error("Échec de la demande de permission push", error)
        } finally {
            setIsRequesting(false)
            setIsVisible(false)
        }
    }, [user])

    const handleDismiss = useCallback(() => {
        setDismissedNow(PUSH_DISMISS_KEY)
        setIsVisible(false)
    }, [])

    if (!isVisible) {
        return null
    }

    return (
        <div className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:right-6 sm:w-80 z-40">
            <div className="rounded-xl border bg-background/95 backdrop-blur-sm shadow-lg p-4 space-y-4">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bell className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-semibold">
                            Activer les notifications
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Reçois une alerte push dès qu'une nouvelle
                            notification est disponible.
                        </p>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={handleDismiss}>
                        Plus tard
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleEnable}
                        disabled={isRequesting}
                    >
                        Autoriser
                    </Button>
                </div>
            </div>
        </div>
    )
}
