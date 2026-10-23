// ── services/driveService.ts ──────────────────────────────────────────────────
// Couche service — seul point d'accès Supabase de la feature Drive.
// Le Drive parle à une API HTTP dédiée (fetch), Supabase ne sert ici qu'à
// récupérer le token de session pour l'en-tête Authorization.
// Déplacement mécanique depuis hooks/useDrive.ts et hooks/useShare.ts
// (règle no-restricted-imports).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/useDrive.ts
//   - hooks/useShare.ts

import { supabase } from "@/integrations/supabase/client"

/** Token d'accès de la session courante — lance une erreur si non authentifié. */
export async function getAccessToken(): Promise<string> {
    const session = (await supabase.auth.getSession()).data.session
    if (!session?.access_token) throw new Error("Non authentifié")
    return session.access_token
}
