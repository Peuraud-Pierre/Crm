import { Button } from "@/shared/ui/atoms/button"
import { Download, Smartphone } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

/** Type pour l’événement beforeinstallprompt (Chrome / Edge / Android) */
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[]
    readonly userChoice: Promise<{
        outcome: "accepted" | "dismissed"
        platform: string
    }>
    prompt(): Promise<void>
}

/** Constantes */
const DISMISS_STORAGE_KEY = "pwa-install-dismissed-at"
const DISMISS_DURATION_MS = 1000 * 60 * 60 * 24 * 7 // 7 jours

/** Utils stockage local */
function getDismissedAt(): number | null {
    if (typeof window === "undefined") return null
    try {
        const storedValue = window.localStorage.getItem(DISMISS_STORAGE_KEY)
        return storedValue ? Number.parseInt(storedValue, 10) : null
    } catch {
        return null
    }
}

function setDismissedAt(timestamp: number) {
    if (typeof window === "undefined") return
    try {
        window.localStorage.setItem(DISMISS_STORAGE_KEY, String(timestamp))
    } catch {
        // Stockage local indisponible: échec silencieux
    }
}

function clearDismissedAt() {
    if (typeof window === "undefined") return
    try {
        window.localStorage.removeItem(DISMISS_STORAGE_KEY)
    } catch {
        // Stockage local indisponible: échec silencieux
    }
}

/** 🔰 Composant principal */
export function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] =
        useState<BeforeInstallPromptEvent | null>(null)
    const [isVisible, setIsVisible] = useState(false)
    const [isPrompting, setIsPrompting] = useState(false)

    /** Détecte si l’utilisateur a récemment fermé la bannière */
    const hasRecentDismissal = useMemo(() => {
        const dismissedAt = getDismissedAt()
        if (!dismissedAt) return false
        return Date.now() - dismissedAt < DISMISS_DURATION_MS
    }, [])

    /** Détecte si on est sur iOS Safari */
    const isIOS = useMemo(() => {
        if (typeof window === "undefined") return false
        const ua = window.navigator.userAgent.toLowerCase()
        return /iphone|ipad|ipod/.test(ua) && /safari/.test(ua)
    }, [])

    /** Installation du comportement PWA */
    useEffect(() => {
        const isStandalone = window.matchMedia?.(
            "(display-mode: standalone)"
        ).matches
        if (isStandalone) {
            clearDismissedAt()
            return
        }

        // Cas iOS : pas de beforeinstallprompt → affichage manuel
        // Initialisation one-shot dépendant de détections runtime (matchMedia/userAgent)
        if (isIOS && !hasRecentDismissal) {
            // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
            setIsVisible(true)
            return
        }

        // Cas Android / Chrome / Edge
        const handleBeforeInstallPrompt = (event: Event) => {
            event.preventDefault()
            if (hasRecentDismissal) return
            setDeferredPrompt(event as BeforeInstallPromptEvent)
            setIsVisible(true)
        }

        const handleAppInstalled = () => {
            setDeferredPrompt(null)
            setIsVisible(false)
            clearDismissedAt()
        }

        window.addEventListener(
            "beforeinstallprompt",
            handleBeforeInstallPrompt
        )
        window.addEventListener("appinstalled", handleAppInstalled)

        return () => {
            window.removeEventListener(
                "beforeinstallprompt",
                handleBeforeInstallPrompt
            )
            window.removeEventListener("appinstalled", handleAppInstalled)
        }
    }, [isIOS, hasRecentDismissal])

    /** Déclenche l’invite Android */
    const handleInstall = useCallback(async () => {
        if (!deferredPrompt) return

        setIsPrompting(true)
        try {
            await deferredPrompt.prompt()
            const choice = await deferredPrompt.userChoice
            if (choice.outcome === "accepted") {
                clearDismissedAt()
            } else {
                setDismissedAt(Date.now())
            }
            setIsVisible(false)
        } catch (error) {
            console.error("Erreur lors de l'invite d'installation", error)
        } finally {
            setIsPrompting(false)
            setDeferredPrompt(null)
        }
    }, [deferredPrompt])

    /** Ferme la bannière */
    const handleDismiss = useCallback(() => {
        setDismissedAt(Date.now())
        setIsVisible(false)
        setDeferredPrompt(null)
    }, [])

    if (!isVisible) return null

    return (
        <div className="fixed bottom-6 inset-x-4 sm:inset-x-auto sm:right-6 sm:w-80 z-50">
            <div className="rounded-xl border bg-background/95 backdrop-blur-sm shadow-lg p-4 space-y-4">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Smartphone className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-semibold">
                            Installer Nokk_project
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {isIOS
                                ? "Sur iPhone, utilise le menu de partage Safari → 'Ajouter à l'écran d'accueil'."
                                : "Ajoute l'application sur ton écran d'accueil pour un accès rapide et hors connexion."}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={handleDismiss}>
                        Plus tard
                    </Button>

                    {isIOS ? (
                        <Button
                            size="sm"
                            onClick={() =>
                                alert(
                                    "📱 Pour installer sur iPhone :\n\n1. Ouvre le menu de partage (icône carré + flèche vers le haut)\n2. Sélectionne 'Ajouter à l’écran d’accueil'\n3. Confirme pour installer Nokk_project"
                                )
                            }
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Voir comment
                        </Button>
                    ) : (
                        <Button
                            size="sm"
                            onClick={handleInstall}
                            disabled={isPrompting}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Installer
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
