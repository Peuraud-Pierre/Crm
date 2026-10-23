import { supabase } from "@/integrations/supabase/client"

/**
 * Service d'accès aux permissions utilisateur (RPC Supabase).
 * Requête déplacée telle quelle depuis shared/components/misc/Permission.tsx
 * (couche service obligatoire — voir Architecture_Feature.pdf §5).
 */

/** Permissions de l'utilisateur via la RPC get_user_permissions. */
export async function getUserPermissions(uid: string) {
    return supabase.rpc("get_user_permissions", { uid })
}
