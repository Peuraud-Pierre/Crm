import { supabase } from "@/integrations/supabase/client"

/**
 * Service d'accès à la session Supabase (auth).
 * Seule couche autorisée à importer le client Supabase
 * (règle ESLint no-restricted-imports — voir Architecture_Feature.pdf §5).
 */

/** Utilisateur courant (résultat brut Supabase, non déballé). */
export async function getUser() {
    return supabase.auth.getUser()
}

/** Session courante (résultat brut Supabase, non déballé). */
export async function getSession() {
    return supabase.auth.getSession()
}
