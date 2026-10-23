// Couche service partagée de la feature calendar-integrations
// (docs/Architecture_Feature.pdf §5). Seul point d'accès Supabase de la
// feature : les bridges (Amelia/Apple/Outlook) n'ont besoin que du JWT.
import { supabase } from "@/integrations/supabase/client"

/** JWT de la session Supabase courante (null si non connecté). */
export async function getAccessToken(): Promise<string | null> {
    const session = await supabase.auth.getSession()
    return session.data.session?.access_token ?? null
}
