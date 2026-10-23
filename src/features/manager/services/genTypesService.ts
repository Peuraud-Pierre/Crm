// Couche service de la feature manager — génération de types TypeScript
// (docs/Architecture_Feature.pdf §5). Wrappers nommés, strictement
// mécaniques : session Supabase (JWT) + URL de l'endpoint admin gen-types.
import { supabase } from "@/integrations/supabase/client"
import { env } from "@/shared/lib/env"

/** JWT de la session courante (pour appeler l'endpoint admin gen-types). */
export async function getAccessToken(): Promise<string | null> {
    const {
        data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token ?? null
}

/** URL de l'endpoint admin de génération des types pour un schéma donné. */
export function buildGenTypesUrl(schema: string): string {
    return `${env.PUBLIC_SUPABASE_URL}/keyexchange/api/admin/gen-types?schema=${encodeURIComponent(schema)}`
}
