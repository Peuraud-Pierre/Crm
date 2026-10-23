// Couche service de l'abonnement newsletter arrivages, côté utilisateur.
// Deux backends distincts :
//   - lecture de l'état courant : table public.newsletter_subscriptions
//   - abonnement / désabonnement : service Go (PUBLIC_NEWSLETTER_API_URL),
//     qui gère le code d'invitation et l'envoi.
// Le pendant administrateur vit dans features/arrivage-admin/services.
import { supabase } from "@/integrations/supabase/client"
import { env } from "@/shared/lib/env"
import type {
    NewsletterSubscribeInput,
    NewsletterSubscription,
} from "../types"
import { getAccessToken } from "./profileService"

const NEWSLETTER_API = env.PUBLIC_NEWSLETTER_API_URL ?? ""

async function authHeaders(): Promise<Record<string, string>> {
    const accessToken = await getAccessToken()
    return { Authorization: `Bearer ${accessToken}` }
}

async function assertOk(res: Response, fallback: string): Promise<void> {
    if (!res.ok) {
        const message = await res.text()
        throw new Error(message || fallback)
    }
}

/** Abonnement courant, ou null si l'utilisateur n'est pas inscrit. */
export async function fetchNewsletterSubscription(
    userId: string
): Promise<NewsletterSubscription | null> {
    const { data, error } = await supabase
        .from("newsletter_subscriptions")
        .select("active, visible_columns")
        .eq("user_id", userId)
        .maybeSingle()

    if (error) throw error
    if (!data) return null

    return {
        active: data.active,
        // Colonne jsonb (Json générique côté types générés) : narrows au
        // tableau de chaînes réellement stocké, vide si la forme diverge.
        visible_columns: Array.isArray(data.visible_columns)
            ? data.visible_columns.filter((v): v is string => typeof v === "string")
            : [],
    }
}

/** Crée l'abonnement ou met à jour les colonnes visibles. */
export async function subscribeToNewsletter(
    input: NewsletterSubscribeInput
): Promise<void> {
    const res = await fetch(`${NEWSLETTER_API}/subscribe`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(await authHeaders()),
        },
        body: JSON.stringify(input),
    })
    await assertOk(res, "Erreur lors de l'abonnement.")
}

export async function unsubscribeFromNewsletter(): Promise<void> {
    const res = await fetch(`${NEWSLETTER_API}/unsubscribe`, {
        method: "DELETE",
        headers: await authHeaders(),
    })
    await assertOk(res, "Erreur lors du désabonnement.")
}
