/**
 * Traduction des erreurs Supabase Auth (GoTrue) en messages français
 * affichables tels quels dans les formulaires d'authentification.
 *
 * On s'appuie sur `error.code` (stable, documenté par GoTrue) et seulement en
 * dernier recours sur le texte anglais de `error.message` : les instances
 * GoTrue plus anciennes ne renseignent pas toujours le code (cas connu du
 * captcha, qui ne renvoie que « captcha protection: request disallowed »).
 */

export interface AuthFailure {
    /** Code GoTrue, ou code local (`network`, `no-factor`, `unknown`). */
    code: string
    /** Message français, prêt à afficher. */
    message: string
}

const MESSAGES: Record<string, string> = {
    invalid_credentials: "Email ou mot de passe incorrect.",
    email_not_confirmed:
        "Adresse email non confirmée. Ouvrez le lien reçu par email avant de vous connecter.",
    user_banned: "Ce compte est désactivé. Contactez un administrateur.",
    over_request_rate_limit:
        "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
    over_email_send_rate_limit:
        "Trop d'emails envoyés. Patientez quelques minutes avant de réessayer.",
    captcha_failed:
        "La vérification de sécurité a échoué. Réessayez.",
    mfa_verification_failed: "Code incorrect. Vérifiez votre application et réessayez.",
    mfa_challenge_expired: "Le code a expiré. Saisissez le code actuel.",
    "no-factor":
        "Aucune application d'authentification n'est associée à ce compte.",
    weak_password: "Mot de passe trop faible.",
    same_password: "Le nouveau mot de passe doit être différent de l'ancien.",
    otp_expired: "Ce lien a expiré. Demandez-en un nouveau.",
    network: "Connexion impossible. Vérifiez votre réseau et réessayez.",
    unknown: "Une erreur est survenue. Réessayez.",
}

/** Repli par texte, pour les GoTrue qui ne renvoient pas de `code`. */
function codeFromMessage(message: string): string | null {
    const m = message.toLowerCase()
    if (m.includes("invalid login credentials")) return "invalid_credentials"
    if (m.includes("captcha")) return "captcha_failed"
    if (m.includes("email not confirmed")) return "email_not_confirmed"
    if (m.includes("rate limit")) return "over_request_rate_limit"
    if (m.includes("invalid totp") || m.includes("invalid code")) return "mfa_verification_failed"
    if (m.includes("failed to fetch") || m.includes("network")) return "network"
    return null
}

export function toAuthFailure(error: unknown): AuthFailure {
    const e = (typeof error === "object" && error !== null ? error : {}) as {
        code?: unknown
        name?: unknown
        message?: unknown
        status?: unknown
    }

    // AuthRetryableFetchError (status 0) = le serveur n'a jamais répondu.
    // TypeError = fetch() rejeté par le navigateur (hors ligne, DNS, CORS).
    if (e.name === "AuthRetryableFetchError" || e.name === "TypeError" || e.status === 0) {
        return { code: "network", message: MESSAGES.network }
    }

    const rawCode = typeof e.code === "string" ? e.code : null
    if (rawCode && rawCode in MESSAGES) {
        return { code: rawCode, message: MESSAGES[rawCode] }
    }

    const message = typeof e.message === "string" ? e.message : ""
    const inferred = codeFromMessage(message)
    if (inferred) {
        return { code: inferred, message: MESSAGES[inferred] }
    }

    return { code: rawCode ?? "unknown", message: MESSAGES.unknown }
}

/** Message seul, quand le code n'intéresse pas l'appelant. */
export function toAuthMessage(error: unknown): string {
    return toAuthFailure(error).message
}
