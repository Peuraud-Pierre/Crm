// Couche service de la feature mfa (docs/Architecture_Feature.pdf §5).
// Wrappers nommés, strictement mécaniques, autour de supabase.auth.mfa.*.
import { supabase } from "@/integrations/supabase/client"

export function listMfaFactors() {
    return supabase.auth.mfa.listFactors()
}

export function enrollTotpFactor() {
    return supabase.auth.mfa.enroll({ factorType: "totp" })
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

export function unenrollMfaFactor(factorId: string) {
    return supabase.auth.mfa.unenroll({ factorId })
}
