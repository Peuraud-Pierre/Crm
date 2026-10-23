import { supabase } from "@/integrations/supabase/client"

/**
 * Service d'enregistrement du consentement légal (RGPD, charte, etc.).
 * Requête déplacée telle quelle depuis PrivacyConsentDialog (couche service
 * obligatoire — voir Architecture_Feature.pdf §5).
 */

/** Enregistre l'acceptation des conditions légales sur le profil. */
export async function savePrivacyAcceptance(
    userId: string,
    acceptance: {
        privacy_accepted_at: string
        privacy_accepted_version: string
    }
) {
    return supabase.from("profiles").update(acceptance).eq("user_id", userId)
}
