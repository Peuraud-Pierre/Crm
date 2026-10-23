import { supabase } from "@/integrations/supabase/client"

// Couche service pour le consentement RGPD (docs/Architecture_Feature.pdf §5).

// Enregistre l'acceptation de la politique de confidentialité pour un
// utilisateur (horodatage + version acceptée).
export async function acceptPrivacyPolicy(
    userId: string,
    version: string,
    acceptedAt: string
): Promise<void> {
    const { error } = await supabase
        .from("profiles")
        .update({
            privacy_accepted_at: acceptedAt,
            privacy_accepted_version: version,
        })
        .eq("user_id", userId)

    if (error) throw error
}
