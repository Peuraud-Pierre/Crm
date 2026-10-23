import { encodeBase64 } from "tweetnacl-util"

const DEVICE_ID_KEY = "cryptedmessage:deviceId"
const DEVICE_NAME_KEY = "cryptedmessage:deviceName"
const FIRST_USE_KEY = "cryptedmessage:firstUse"

/**
 * Génère ou récupère un identifiant unique pour cet appareil.
 * Cet ID persiste même après reconnexion.
 */
export function getDeviceId(): string {
    if (typeof window === "undefined") return "unknown"

    let deviceId = window.localStorage.getItem(DEVICE_ID_KEY)
    if (!deviceId) {
        // Générer un nouvel ID unique
        const randomBytes = window.crypto.getRandomValues(new Uint8Array(16))
        deviceId = encodeBase64(randomBytes)
        window.localStorage.setItem(DEVICE_ID_KEY, deviceId)
    }
    return deviceId
}

/**
 * Récupère ou génère un nom convivial pour cet appareil.
 */
export function getDeviceName(): string {
    if (typeof window === "undefined") return "Appareil inconnu"

    let deviceName = window.localStorage.getItem(DEVICE_NAME_KEY)
    if (!deviceName) {
        deviceName = generateDeviceName()
        window.localStorage.setItem(DEVICE_NAME_KEY, deviceName)
    }
    return deviceName
}

/**
 * Permet à l'utilisateur de personnaliser le nom de son appareil.
 */
export function setDeviceName(name: string) {
    if (typeof window === "undefined") return
    window.localStorage.setItem(DEVICE_NAME_KEY, name)
}

/**
 * Génère un nom convivial basé sur le user agent.
 */
function generateDeviceName(): string {
    if (typeof window === "undefined") return "Appareil inconnu"

    const ua = window.navigator.userAgent.toLowerCase()

    // Détection du type d'appareil
    if (ua.includes("mobile") || ua.includes("android")) {
        if (ua.includes("chrome")) return "📱 Mobile Chrome"
        if (ua.includes("firefox")) return "📱 Mobile Firefox"
        if (ua.includes("safari")) return "📱 Mobile Safari"
        return "📱 Mobile"
    }

    if (ua.includes("tablet") || ua.includes("ipad")) {
        return "📱 Tablette"
    }

    // Desktop
    if (ua.includes("win")) return "💻 Windows"
    if (ua.includes("mac")) return "💻 Mac"
    if (ua.includes("linux")) return "💻 Linux"

    // Navigateur par défaut
    if (ua.includes("chrome")) return "🌐 Chrome"
    if (ua.includes("firefox")) return "🌐 Firefox"
    if (ua.includes("safari")) return "🌐 Safari"
    if (ua.includes("edge")) return "🌐 Edge"

    return "🌐 Navigateur"
}

/**
 * Vérifie si c'est la première utilisation sur cet appareil.
 */
export function isFirstUse(): boolean {
    if (typeof window === "undefined") return false
    return !window.localStorage.getItem(FIRST_USE_KEY)
}

/**
 * Marque l'appareil comme déjà utilisé.
 */
export function markDeviceUsed() {
    if (typeof window === "undefined") return
    window.localStorage.setItem(FIRST_USE_KEY, Date.now().toString())
}

/**
 * Réinitialise le marqueur de premier usage (pour réutilisation après purge).
 */
export function resetFirstUse() {
    if (typeof window === "undefined") return
    window.localStorage.removeItem(FIRST_USE_KEY)
}

/**
 * Récupère la date de première utilisation.
 */
export function getFirstUseDate(): Date | null {
    if (typeof window === "undefined") return null
    const timestamp = window.localStorage.getItem(FIRST_USE_KEY)
    if (!timestamp) return null
    return new Date(Number(timestamp))
}

/**
 * Type pour les informations d'appareil.
 */
export type DeviceInfo = {
    id: string
    name: string
    firstUse: Date | null
    isNew: boolean
}

/**
 * Récupère toutes les informations sur l'appareil actuel.
 */
export function getDeviceInfo(): DeviceInfo {
    return {
        id: getDeviceId(),
        name: getDeviceName(),
        firstUse: getFirstUseDate(),
        isNew: isFirstUse(),
    }
}
