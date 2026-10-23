// src/hooks/useAuth/auth.actions.ts
import {
    signInWithPassword,
    signUpWithPassword,
    signOut,
    updateUserPassword,
} from "@/features/auth/services/authService"
import { removePushSubscription } from "@/shared/lib/pwa"
import { toAuthFailure } from "@/features/auth/utils/authErrors"
import { toast } from "sonner"
import {type  AppUser } from "./types"

/**
 * SIGN IN — version simplifiée et compatible Provider/MFA centralisé
 * -----------------------------------------------------------------
 * - ne retourne jamais factorId
 * - ne déclenche pas MFA localement
 * - ne touche pas requiresMfa
 * - laisse le Provider gérer le MFA via validateMfaBeforeLogin()
 * - n'affiche RIEN : l'écran de connexion montre l'erreur dans le formulaire.
 *   `error` est déjà traduit en français, `code` permet d'adapter l'UI
 *   (vider le mot de passe, relancer le captcha…).
 */
export async function signIn(
    email: string,
    password: string,
    captchaToken?: string
) {
    try {
        // La vérification du captcha est faite par GoTrue (GOTRUE_SECURITY_CAPTCHA_*) :
        // les tokens Turnstile sont à usage unique, ne pas les vérifier deux fois.

        // LOGIN PASSWORD UNIQUEMENT
        const { data, error } = await signInWithPassword(
            email,
            password,
            captchaToken
        )

        if (error) {
            const failure = toAuthFailure(error)
            return { error: failure.message, code: failure.code }
        }

        // À ce stade, Supabase renvoie AAL1 si MFA existe mais pas validé.
        // Le Provider détectera AAL1 → demandera OTP → requireMfaRef = true
        if (typeof window !== "undefined" && password) {
            window.sessionStorage.setItem(
                "cryptedmessage:pendingAuthSecret",
                password
            )
            window.sessionStorage.setItem(
                "cryptedmessage:pendingAuthSecretAt",
                Date.now().toString()
            )
        }

        return { user: data.user as AppUser }
    } catch (error) {
        console.error("Erreur signIn:", error)
        const failure = toAuthFailure(error)
        return { error: failure.message, code: failure.code }
    }
}

/**
 * Abandon d'une connexion restée en AAL1 (étape MFA → « Utiliser un autre
 * compte »). Ferme la session partielle sans le toast « Déconnecté » de
 * signOutAction — l'utilisateur ne s'est jamais vu connecté — et oublie le
 * secret de messagerie mémorisé par signIn, qui appartient au compte quitté.
 */
export async function abandonPendingSignIn() {
    if (typeof window !== "undefined") {
        window.sessionStorage.removeItem("cryptedmessage:pendingAuthSecret")
        window.sessionStorage.removeItem("cryptedmessage:pendingAuthSecretAt")
    }
    try {
        await signOut()
    } catch (e) {
        // Session déjà expirée côté serveur : rien à fermer, on revient
        // quand même à l'écran de connexion.
        console.error("Abandon de la connexion MFA :", e)
    }
}

/**
 * SIGN UP
 */
export async function signUp(
    email: string,
    password: string,
    captchaToken?: string
) {
    try {
        const { data, error } = await signUpWithPassword(
            email,
            password,
            captchaToken
        )
        if (error) throw error

        toast.success("Inscription réussie ! Vérifiez votre email.")
        return { user: data.user as AppUser, error: null }
    } catch (err) {
        const message =
            err instanceof Error
                ? err.message
                : typeof err === "object" && err !== null && "message" in err
                  ? String((err as { message: unknown }).message)
                  : "Erreur inconnue"
        toast.error(message)
        return { user: null, error: message }
    }
}

/**
 * SIGN OUT
 */
export async function signOutAction() {
    // Avant signOut (la RLS a besoin de la session) : un navigateur partagé ne
    // doit pas continuer à recevoir les push du compte qui vient de partir.
    // Jamais bloquant pour la déconnexion.
    await removePushSubscription().catch((e) =>
        console.error("Push: désabonnement à la déconnexion impossible", e)
    )
    try {
        await signOut()
        toast.success("Déconnecté")
    } catch (e) {
        const err = e as { code?: string }
        if (err?.code === "session_not_found") {
            toast.message("Session déjà expirée")
            return
        }
        console.error(e)
    }
}

/**
 * CHANGE PASSWORD
 */
export async function changePassword(newPassword: string): Promise<{ error?: boolean; success?: boolean }> {
    if (newPassword.length < 6) {
        toast.error("Mot de passe trop court")
        return { error: true }
    }

    const { error } = await updateUserPassword(newPassword)
    if (error) {
        toast.error(error.message)
        return { error: true }
    }

    toast.success("Mot de passe mis à jour")
    return { success: true }
}
