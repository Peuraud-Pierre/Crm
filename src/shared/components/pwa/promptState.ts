/**
 * État des invites PWA : « Plus tard » les masque une semaine. La caméra n'a
 * pas d'invite globale : elle est demandée à l'ouverture d'un scanner.
 */

export const PUSH_DISMISS_KEY = "pwa-push-dismissed-at"

const DISMISS_DURATION_MS = 1000 * 60 * 60 * 24 * 7

export function isRecentlyDismissed(key: string): boolean {
    try {
        const value = window.localStorage.getItem(key)
        const dismissedAt = value ? Number.parseInt(value, 10) : null
        return dismissedAt !== null && Date.now() - dismissedAt < DISMISS_DURATION_MS
    } catch {
        return false
    }
}

export function setDismissedNow(key: string) {
    try {
        window.localStorage.setItem(key, String(Date.now()))
    } catch {
        // Stockage indisponible (navigation privée) : l'invite reviendra.
    }
}
