// Couche service de la feature profile (docs/Architecture_Feature.pdf §5).
// Seul endroit de la feature autorisé à toucher Supabase (auth, storage,
// table profiles). Fonctions async pures : aucune gestion d'état React,
// aucun toast — l'erreur remonte au hook appelant.
import { supabase } from "@/integrations/supabase/client"
import { getAvatarPublicUrl } from "@/shared/services/avatarService"
import type { ProfileIdentityInput } from "../types"

/** Bucket de stockage des photos de profil. */
const AVATAR_BUCKET = "avatars"

/* ============================
   Session / mot de passe
============================ */

/** JWT de la session courante (pour appeler les APIs externes). */
export async function getAccessToken(): Promise<string | null> {
    const {
        data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token ?? null
}

export async function updateUserPassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
}

/* ============================
   Identité (table profiles)
============================ */

/** Champs modifiables par l'utilisateur sur son propre profil. */
export async function updateProfileIdentity(
    userId: string,
    input: ProfileIdentityInput
): Promise<void> {
    const { error } = await supabase
        .from("profiles")
        .update({
            full_name: input.full_name,
            // Champ facultatif : on écrit NULL plutôt qu'une chaîne vide.
            phone: input.phone?.trim() ? input.phone.trim() : null,
        })
        .eq("user_id", userId)

    if (error) throw error
}

/** Profil + noms role/service (renvoie null si aucun profil). */
export function fetchProfileWithRelations(userId: string) {
    return supabase
        .from("profiles")
        .select(
            `
        *,
        role:roles(nom),
        service:services(nom)
      `
        )
        .eq("user_id", userId)
        .maybeSingle()
}

/* ============================
   Avatar (storage + profiles)
============================ */

/**
 * Téléverse la nouvelle photo et enregistre son URL publique sur le profil.
 * Renvoie l'URL à propager dans le contexte d'auth.
 */
export async function uploadProfileAvatar(
    userId: string,
    file: File
): Promise<string> {
    const extension = file.name.split(".").pop() || "png"
    const filePath = `${userId}/${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, file, { upsert: true })
    if (uploadError) throw uploadError

    const publicUrl = getAvatarPublicUrl(filePath, AVATAR_BUCKET)
    if (!publicUrl) {
        throw new Error("URL publique de l'avatar introuvable.")
    }

    const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", userId)
    if (updateError) throw updateError

    return publicUrl
}
