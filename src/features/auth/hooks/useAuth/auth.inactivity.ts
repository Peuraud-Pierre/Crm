// src/features/auth/hooks/useAuth/auth.inactivity.ts
import { signOutAction } from "./auth.actions"

// Doit rester aligné sur GOTRUE_SESSIONS_INACTIVITY_TIMEOUT (docker-compose du
// backend). Le serveur est la vraie garantie ; ce module ne couvre que le cas
// qu'il ne peut pas voir : l'onglet resté ouvert au premier plan sur un poste
// sans personne devant, où supabase-js rafraîchit le token toutes les heures
// et maintient donc la session « active » aux yeux de GoTrue.
const TIMEOUT_MS = 4 * 60 * 60 * 1000

const CHECK_INTERVAL_MS = 60_000

// localStorage plutôt qu'un ref : l'activité dans un onglet vaut pour tous les
// autres, sinon un second onglet inactif déconnecterait le premier.
const STORAGE_KEY = "pa:last-activity"

// Écriture throttlée : `keydown` écrirait sinon à chaque touche frappée, et
// localStorage est synchrone. 30 s d'imprécision sur un seuil de 4 h.
const WRITE_THROTTLE_MS = 30_000

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart"] as const

export function setupInactivityLogout() {
    let lastWrite = 0

    const touch = () => {
        const now = Date.now()
        if (now - lastWrite < WRITE_THROTTLE_MS) return
        lastWrite = now
        try {
            localStorage.setItem(STORAGE_KEY, String(now))
        } catch {
            // Quota plein / stockage bloqué : on retombe sur le timeout serveur.
        }
    }

    const lastActivity = () => {
        const raw = Number(localStorage.getItem(STORAGE_KEY))
        return Number.isFinite(raw) && raw > 0 ? raw : Date.now()
    }

    touch()
    for (const event of ACTIVITY_EVENTS) {
        document.addEventListener(event, touch, { passive: true })
    }

    const timer = window.setInterval(() => {
        if (Date.now() - lastActivity() < TIMEOUT_MS) return
        window.clearInterval(timer)
        localStorage.removeItem(STORAGE_KEY)
        void signOutAction()
    }, CHECK_INTERVAL_MS)

    return () => {
        window.clearInterval(timer)
        for (const event of ACTIVITY_EVENTS) {
            document.removeEventListener(event, touch)
        }
    }
}
