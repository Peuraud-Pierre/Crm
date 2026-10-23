import type { SupabaseClient } from "@supabase/supabase-js"
import { supabase } from "@/integrations/supabase/client"
import type { BriefCategorie, BriefOption } from "@/features/crm/types"

/**
 * Client Supabase non typé ponctuel pour `brief_cat` : table pas encore
 * dans `integrations/supabase/types.ts` (fichier auto-généré). Typage
 * applicatif assuré par `BriefOption` côté front en attendant.
 *
 * **À régénérer après avoir appliqué la migration** :
 *
 *   npx supabase gen types typescript --project-id <id> \
 *     > src/integrations/supabase/types.ts
 */
const supabaseBriefOptions = supabase as unknown as SupabaseClient

// `type`/`available` sont les noms de colonnes réels de brief_cat (créée
// manuellement) ; aliasés en `value`/`active` pour garder une API front
// lisible sans changer le schéma DB.
const SELECT_COLUMNS = "id, categorie, value:type, active:available"

export async function listBriefOptions(): Promise<BriefOption[]> {
    const { data, error } = await supabaseBriefOptions
        .from("brief_cat")
        .select(SELECT_COLUMNS)
        .order("categorie")
        .order("id")
    if (error) throw error
    return (data as BriefOption[]) || []
}

export async function createBriefOption(
    categorie: BriefCategorie,
    value: string
): Promise<number> {
    const { data, error } = await supabaseBriefOptions
        .from("brief_cat")
        .insert({ categorie, type: value })
        .select("id")
        .single()
    if (error) throw error
    return (data as { id: number }).id
}

export async function updateBriefOption(
    id: number,
    patch: Partial<Pick<BriefOption, "active" | "value">>
): Promise<void> {
    const dbPatch: Record<string, unknown> = {}
    if (patch.active !== undefined) dbPatch.available = patch.active
    if (patch.value !== undefined) dbPatch.type = patch.value
    const { error } = await supabaseBriefOptions
        .from("brief_cat")
        .update(dbPatch)
        .eq("id", id)
    if (error) throw error
}

export async function deleteBriefOption(id: number): Promise<void> {
    const { error } = await supabaseBriefOptions
        .from("brief_cat")
        .delete()
        .eq("id", id)
    if (error) throw error
}
