import { useCallback, useEffect, useState } from "react"
import {
    readCameraPermission,
    requestCameraAccess,
    watchCameraPermission,
    type CameraAccess,
    type CameraPermission,
} from "@/shared/lib/camera"

/**
 * État affichable de la caméra : la permission du navigateur, plus ce qu'une
 * tentative a appris (pas de caméra, caméra prise par une autre app).
 */
export type CameraState = CameraPermission | "checking" | "no-camera" | "busy"

/**
 * Permission caméra de cet appareil, tenue à jour : relue quand le navigateur
 * signale un changement et au retour sur l'onglet (l'utilisateur part dans
 * les réglages puis revient).
 */
export function useCameraPermission({ enabled = true }: { enabled?: boolean } = {}) {
    const [state, setState] = useState<CameraState>("checking")
    const [requesting, setRequesting] = useState(false)

    const refresh = useCallback(async () => {
        const next = await readCameraPermission()
        setState(next)
        return next
    }, [])

    useEffect(() => {
        if (!enabled) return
        let cancelled = false
        const reread = () => {
            void readCameraPermission().then((next) => {
                if (!cancelled) setState(next)
            })
        }
        reread()
        const unwatch = watchCameraPermission(reread)
        const onVisible = () => {
            if (document.visibilityState === "visible") reread()
        }
        document.addEventListener("visibilitychange", onVisible)
        return () => {
            cancelled = true
            unwatch()
            document.removeEventListener("visibilitychange", onVisible)
        }
    }, [enabled])

    /** À brancher sur un `onClick` : c'est le geste qui fait apparaître l'invite. */
    const request = useCallback(async () => {
        setRequesting(true)
        try {
            const access = await requestCameraAccess()
            setState(access)
            return access
        } finally {
            setRequesting(false)
        }
    }, [])

    /** Une tentative de démarrage a échoué : on affiche pourquoi. */
    const report = useCallback((access: Exclude<CameraAccess, "granted">) => {
        setState(access)
    }, [])

    return { state, requesting, request, refresh, report }
}
