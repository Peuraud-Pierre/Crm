/**
 * Accès caméra de **cet appareil**, hors React. Le navigateur a le dernier
 * mot : une permission refusée ne se redemande pas depuis la page, il faut
 * la rétablir dans les réglages du site — d'où les instructions par
 * plateforme de `cameraHelp()`.
 */

/** Position du navigateur, lue sans rien demander. */
export type CameraPermission = "granted" | "prompt" | "denied" | "unsupported" | "insecure"

/** Issue d'une demande (ou d'un démarrage) de caméra. */
export type CameraAccess = "granted" | "denied" | "no-camera" | "busy" | "insecure" | "unsupported"

function hasMediaDevices(): boolean {
    return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function"
}

export async function readCameraPermission(): Promise<CameraPermission> {
    if (typeof window === "undefined") return "unsupported"
    if (!window.isSecureContext) return "insecure"
    if (!hasMediaDevices()) return "unsupported"
    try {
        // `camera` n'est pas dans le type `PermissionName` de tous les DOM lib.
        const status = await navigator.permissions.query({ name: "camera" as PermissionName })
        return status.state
    } catch {
        // Firefox et les anciens Safari ne savent pas interroger la caméra :
        // on ne sait pas, donc on proposera de demander.
        return "prompt"
    }
}

/**
 * S'abonne aux changements de la permission caméra quand le navigateur le
 * permet (Chrome, Safari récents). Renvoie de quoi se désabonner.
 */
export function watchCameraPermission(onChange: () => void): () => void {
    let status: PermissionStatus | null = null
    let disposed = false
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
        navigator.permissions
            .query({ name: "camera" as PermissionName })
            .then((s) => {
                if (disposed) return
                status = s
                s.addEventListener("change", onChange)
            })
            .catch(() => {
                // Non pris en charge : le retour sur l'onglet suffira.
            })
    }
    return () => {
        disposed = true
        status?.removeEventListener("change", onChange)
    }
}

/**
 * Traduit une erreur de `getUserMedia` — ou de `Html5Qrcode.start()`, qui la
 * relaie parfois en chaîne (`"NotAllowedError: Permission denied"`).
 */
export function classifyCameraError(error: unknown): Exclude<CameraAccess, "granted"> {
    const text =
        error instanceof Error || error instanceof DOMException
            ? `${error.name} ${error.message}`
            : String(error)
    if (/NotAllowedError|PermissionDenied|Permission denied/i.test(text)) return "denied"
    if (/NotFoundError|OverconstrainedError|DevicesNotFound|Requested device not found/i.test(text)) return "no-camera"
    if (/NotReadableError|TrackStartError|Could not start video source/i.test(text)) return "busy"
    if (/SecurityError/i.test(text)) return "insecure"
    if (typeof window !== "undefined" && !window.isSecureContext) return "insecure"
    // Inconnu : le cas le plus fréquent en pratique reste un refus.
    return "denied"
}

/**
 * Demande l'accès puis rend la caméra aussitôt. **À appeler directement dans
 * un gestionnaire de clic** : Safari (et les PWA iOS) n'affichent l'invite
 * qu'en réponse à un geste de l'utilisateur.
 */
export async function requestCameraAccess(): Promise<CameraAccess> {
    if (typeof window === "undefined") return "unsupported"
    if (!window.isSecureContext) return "insecure"
    if (!hasMediaDevices()) return "unsupported"
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        stream.getTracks().forEach((track) => track.stop())
        return "granted"
    } catch (error) {
        console.error("[camera] getUserMedia:", error)
        return classifyCameraError(error)
    }
}

type Platform = "ios-pwa" | "ios" | "android" | "desktop"

function detectPlatform(): Platform {
    if (typeof navigator === "undefined") return "desktop"
    const ua = navigator.userAgent
    // iPadOS se présente comme un Mac : on le reconnaît à l'écran tactile.
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    if (ios) {
        const standalone =
            (navigator as Navigator & { standalone?: boolean }).standalone === true ||
            window.matchMedia?.("(display-mode: standalone)").matches
        return standalone ? "ios-pwa" : "ios"
    }
    if (/Android/.test(ua)) return "android"
    return "desktop"
}

const HELP: Record<Platform, string[]> = {
    ios: [
        "Touchez « aA » (ou l'icône de réglages) dans la barre d'adresse de Safari.",
        "Ouvrez « Réglages du site » puis mettez « Caméra » sur « Autoriser ».",
        "Revenez ici : l'accès est pris en compte.",
    ],
    "ios-pwa": [
        "Ouvrez l'app Réglages de l'iPhone, puis « Safari » › « Caméra ».",
        "Choisissez « Demander » ou « Autoriser ».",
        "Revenez dans l'application et réessayez.",
    ],
    android: [
        "Touchez l'icône à gauche de l'adresse (cadenas ou réglages).",
        "Ouvrez « Autorisations » puis activez « Caméra ».",
        "Revenez ici et réessayez.",
    ],
    desktop: [
        "Cliquez sur l'icône à gauche de l'adresse (ou sur l'icône caméra barrée).",
        "Autorisez la caméra pour ce site.",
        "Revenez ici et réessayez.",
    ],
}

/** Étapes pour rétablir une caméra refusée, selon l'appareil. */
export function cameraHelp(): string[] {
    return HELP[detectPlatform()]
}
