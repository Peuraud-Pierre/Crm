import {
    challengeMfaFactor,
    getSession,
    listMfaFactors,
    verifyMfaChallenge,
} from "@/features/auth/services/authService"
import type { Factor, User } from "@supabase/supabase-js";
import { toAuthFailure } from "@/features/auth/utils/authErrors"

/**
 * Vérification OTP simplifiée :
 * - détecte automatiquement le facteur TOTP
 * - challenge automatiquement
 * - vérifie seulement avec le code
 *
 * N'affiche rien : `error` est un message français prêt à afficher dans le
 * formulaire (OtpStep), `code` le code GoTrue ou local correspondant.
 */
export async function verifyOtp(
    code: string
): Promise<{ user?: User | null; error?: string; code?: string }> {
    try {
        // Récupère le facteur TOTP actif
        const { data: factorsData, error: factorsError } =
            await listMfaFactors()

        if (factorsError) throw factorsError

        const totp = factorsData?.all?.find(
            (f: Factor) => f.factor_type === "totp" && f.status === "verified"
        )

        if (!totp) {
            const failure = toAuthFailure({ code: "no-factor" })
            return { error: failure.message, code: failure.code }
        }

        // Challenge
        const { data: challenge, error: challengeError } =
            await challengeMfaFactor(totp.id)

        if (challengeError) throw challengeError

        // Vérification OTP
        const { data, error } = await verifyMfaChallenge(
            totp.id,
            challenge.id,
            code
        )

        if (error) throw error

        // La redirection est faite par PublicOnlyLayout dès que le Provider
        // a reçu MFA_CHALLENGE_VERIFIED (AAL2) et hydraté `user`.
        return { user: data.user }
    } catch (err) {
        console.error("Erreur verifyOtp:", err)
        const failure = toAuthFailure(err)
        return { error: failure.message, code: failure.code }
    }
}

export async function hasAAL2Enabled() {
    const { data } = await listMfaFactors()
    return data?.all?.some(
        (f: Factor) => f.factor_type === "totp" && f.status === "verified"
    )
}

export async function getCurrentAAL(): Promise<"aal1" | "aal2"> {
    const {
        data: { session },
    } = await getSession()
    const aal = (session?.user as { aal?: unknown } | undefined)?.aal
    return aal === "aal2" ? "aal2" : "aal1"
}
