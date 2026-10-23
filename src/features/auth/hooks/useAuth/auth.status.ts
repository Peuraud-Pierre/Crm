// src/hooks/useAuth/auth.status.ts
import {
    refreshSession,
    updateProfileStatus,
    updateProfileStatusKeepalive,
} from "@/features/auth/services/authService"

export async function updateUserStatus(
    userId: string,
    state: "active" | "inactive"
) {
    if (!userId) return
    try {
        const { error } = await updateProfileStatus(userId, state)

        if (error?.code === "PGRST303") {
            // Décalage d'horloge : iat du JWT légèrement dans le futur → refresh et réessai
            await refreshSession()
            await updateProfileStatus(userId, state)
            return
        }

        if (error) {
            console.error("updateUserStatus error", { userId, state, error })
        }
    } catch (err) {
        // Lock timeout sur sb-api-auth-token : pas critique, on ignore silencieusement
        if (err instanceof Error && err.message.includes("LockManager")) return
        console.error("updateUserStatus unexpected error", err)
    }
}

const DEBOUNCE_MS = 2_000

export function setupPresenceListeners(userId: string) {
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastState: "active" | "inactive" | null = null

    const set = (s: "active" | "inactive") => {
        if (s === lastState) return
        lastState = s
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => {
            timer = null
            void updateUserStatus(userId, s)
        }, DEBOUNCE_MS)
    }

    // La page part : envoi immédiat, sans debounce et en `keepalive` — une
    // requête classique serait avortée avec le document (le statut restait
    // alors « active » indéfiniment après fermeture de l'onglet).
    const onHide = () => {
        if (timer) clearTimeout(timer)
        timer = null
        if (lastState === "inactive") return
        lastState = "inactive"
        void updateProfileStatusKeepalive(userId, "inactive").catch(() => {
            // Page en cours de destruction : rien à rattraper ni à loguer.
        })
    }

    // `hidden` couvre aussi la fermeture d'onglet sur mobile, où
    // `beforeunload` ne se déclenche pas du tout — d'où le chemin keepalive
    // ici plutôt que le debounce.
    const onVisibilityChange = () => {
        if (document.visibilityState === "hidden") onHide()
        else set("active")
    }
    const onFocus = () => set("active")
    const onBlur = () => set("inactive")

    void updateUserStatus(userId, "active")
    lastState = "active"
    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("focus", onFocus)
    window.addEventListener("blur", onBlur)
    window.addEventListener("pagehide", onHide)

    return () => {
        if (timer) clearTimeout(timer)
        document.removeEventListener("visibilitychange", onVisibilityChange)
        window.removeEventListener("focus", onFocus)
        window.removeEventListener("blur", onBlur)
        window.removeEventListener("pagehide", onHide)
    }
}
