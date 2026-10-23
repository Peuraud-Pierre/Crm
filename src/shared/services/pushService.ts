import { supabase } from "@/integrations/supabase/client"
import type { Json } from "@/integrations/supabase/types"

// Couche service pour les abonnements push et la session côté PWA
// (docs/Architecture_Feature.pdf §5).

// Enregistre l'abonnement push de cet appareil pour le compte connecté.
// Passe par la RPC save_push_subscription : l'endpoint appartient au
// navigateur, et s'il était rattaché à un autre compte (changement de compte
// sur le même navigateur), un upsert direct est refusé par la RLS (42501).
export async function savePushSubscription(
    endpoint: string,
    subscription: Json
): Promise<void> {
    const { error } = await supabase.rpc("save_push_subscription", {
        p_endpoint: endpoint,
        p_subscription: subscription,
    })

    if (error) {
        console.error("Erreur Supabase lors de l'enregistrement", error)
    }
}

// Supprime l'abonnement push d'un appareil (identifié par son endpoint).
export async function deletePushSubscription(endpoint: string): Promise<void> {
    const { error } = await supabase
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", endpoint)

    if (error) throw error
}

// Renvoie le jeton d'accès de la session courante (ou undefined).
export async function getAccessToken(): Promise<string | undefined> {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
}
