import { supabase } from "@/integrations/supabase/client"
import type { Json } from "@/integrations/supabase/types"

export type AppLogRow = {
    level: string
    message: string
    user_id: string
    context: Json
    created_at: string
}

/**
 * Insère une ligne dans la table d'audit `app_logs`.
 * Déplacé depuis core/logger.ts — seule la couche service est autorisée à
 * importer le client Supabase (règle ESLint no-restricted-imports).
 */
export async function insertAppLog(
    row: AppLogRow
): Promise<{ error: unknown }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("app_logs") as any).insert([row])
    return { error }
}
