import { supabase } from "@/integrations/supabase/client"

/**
 * Service d'accès au stockage des avatars.
 * Requête déplacée telle quelle depuis shared/lib/avatar.ts (couche service
 * obligatoire — voir Architecture_Feature.pdf §5).
 */

/** URL publique d'un fichier d'avatar stocké dans le bucket donné. */
export function getAvatarPublicUrl(
    path: string,
    bucket: string
): string | undefined {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data?.publicUrl
}
