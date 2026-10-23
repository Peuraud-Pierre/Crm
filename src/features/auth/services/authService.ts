// Couche service de la feature auth (docs/Architecture_Feature.pdf §5).
// Seul endroit de la feature autorisé à importer le client Supabase :
// wrappers nommés, strictement mécaniques, autour de supabase.auth.* et
// supabase.from("profiles"). Aucune logique métier ici — elle reste dans
// les hooks/actions appelants.
import { supabase } from "@/integrations/supabase/client"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"
import { env } from "@/shared/lib/env"

/* ============================
   Session / connexion
============================ */

export function signInWithPassword(
    email: string,
    password: string,
    captchaToken?: string
) {
    return supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken },
    })
}

export function signUpWithPassword(
    email: string,
    password: string,
    captchaToken?: string
) {
    return supabase.auth.signUp({
        email,
        password,
        options: { captchaToken },
    })
}

export function signOut() {
    return supabase.auth.signOut()
}

export function getSession() {
    return supabase.auth.getSession()
}

export function refreshSession() {
    return supabase.auth.refreshSession()
}

export function updateUserPassword(password: string) {
    return supabase.auth.updateUser({ password })
}

export function resetPasswordForEmail(
    email: string,
    options: { redirectTo?: string; captchaToken?: string }
) {
    return supabase.auth.resetPasswordForEmail(email, options)
}

/** Vérifie un token de lien email (recovery ou signup). */
export function verifyEmailOtp(tokenHash: string, type: "recovery" | "signup") {
    return supabase.auth.verifyOtp({ token_hash: tokenHash, type })
}

export function onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void
) {
    return supabase.auth.onAuthStateChange(callback)
}

/* ============================
   MFA
============================ */

export function listMfaFactors() {
    return supabase.auth.mfa.listFactors()
}

export function challengeMfaFactor(factorId: string) {
    return supabase.auth.mfa.challenge({ factorId })
}

export function verifyMfaChallenge(
    factorId: string,
    challengeId: string,
    code: string
) {
    return supabase.auth.mfa.verify({ factorId, challengeId, code })
}

export function getAuthenticatorAssuranceLevel() {
    return supabase.auth.mfa.getAuthenticatorAssuranceLevel()
}

/* ============================
   Profil (table profiles)
============================ */

/** Profil + jointures role/service, tel qu'attendu par fetchUserProfile. */
export function fetchProfileByUserId(userId: string) {
    return supabase
        .from("profiles")
        .select(
            `
            *,
            role:roles ( id, nom ),
            service:services ( id, nom )
        `
        )
        .eq("user_id", userId)
        .single()
}

export function updateProfileStatus(
    userId: string,
    state: "active" | "inactive"
) {
    return supabase.from("profiles").update({ status: state }).eq("user_id", userId)
}

/**
 * Variante « survit au déchargement de la page » de `updateProfileStatus`.
 *
 * Une requête lancée par le client Supabase au moment où l'onglet se ferme est
 * avortée avec la page : le passage en `inactive` ne partait donc jamais, et
 * l'échec réseau était logué en erreur. `keepalive` demande au navigateur de
 * terminer l'envoi après la destruction du document — d'où le fetch direct :
 * supabase-js n'expose pas cette option par requête.
 *
 * `sendBeacon` ne conviendrait pas : il ne permet pas de poser les en-têtes
 * `apikey` / `Authorization` exigés par PostgREST.
 */
export async function updateProfileStatusKeepalive(
    userId: string,
    state: "active" | "inactive"
) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    // Session déjà fermée : l'UPDATE serait de toute façon refusé par la RLS.
    if (!token) return

    await fetch(
        `${env.PUBLIC_SUPABASE_URL}/rest/v1/profiles?user_id=eq.${userId}`,
        {
            method: "PATCH",
            keepalive: true,
            headers: {
                apikey: env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
            },
            body: JSON.stringify({ status: state }),
        }
    )
}
