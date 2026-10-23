// ── services/arrivageService.ts ───────────────────────────────────────────────
// Couche service — opérations Supabase du domaine Arrivage manuel
// (table `arrivage_manuel`).
//
// Les requêtes vivaient dans `hooks/data/useArrivageManuel.ts`, qui importait
// le client non typé depuis ce fichier : la règle ESLint `no-restricted-imports`
// (accès Supabase réservé à `services/`) ne voyait qu'un import de service et
// laissait passer. Elles sont revenues ici, comme pour les autres domaines.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useArrivageManuel.ts   → CRUD du tableau
//   - services/dashboardWidgetService.ts → client non typé (`supabaseArrivage`)

import type { SupabaseClient } from "@supabase/supabase-js"
import { supabase } from "@/integrations/supabase/client"
import type {
    ArrivageManuelCreateInput,
    ArrivageManuelRow,
    ArrivageManuelUpdateInput,
} from "@/features/stock/types/arrivage-manuel.types"

/**
 * Client Supabase non typé ponctuel pour les tables du domaine arrivage :
 * - arrivage_manuel (TABLE)
 *
 * Cette table n'est pas encore dans `integrations/supabase/types.ts`
 * (fichier auto-généré). Ce cast permet d'attendre la régénération sans
 * bloquer les hooks — typage applicatif assuré par les interfaces
 * ArrivageManuelRow / ArrivageManuelCreateInput / ArrivageManuelUpdateInput
 * côté front.
 *
 * **À régénérer après avoir appliqué les migrations** pour retrouver le
 * typage strict :
 *
 *   npx supabase gen types typescript --project-id <id> \
 *     > src/integrations/supabase/types.ts
 */
export const supabaseArrivage = supabase as unknown as SupabaseClient

const TABLE = "arrivage_manuel"

// ─── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchArrivages(): Promise<ArrivageManuelRow[]> {
    const { data, error } = await supabaseArrivage
        .from(TABLE)
        .select("*")
        .order("created_at", { ascending: false })

    if (error) throw error
    return (data ?? []) as ArrivageManuelRow[]
}

// ─── Mutations — throw on error ────────────────────────────────────────────────

export async function insertArrivage(
    input: ArrivageManuelCreateInput,
): Promise<ArrivageManuelRow> {
    const { data, error } = await supabaseArrivage
        .from(TABLE)
        .insert({ ...input, container_no: input.container_no.trim().toUpperCase() })
        .select()
        .single()

    if (error) throw error
    return data as ArrivageManuelRow
}

export async function patchArrivage(
    id: string,
    patch: ArrivageManuelUpdateInput,
): Promise<void> {
    const { error } = await supabaseArrivage
        .from(TABLE)
        .update(patch)
        .eq("id", id)

    if (error) throw error
}

export async function removeArrivage(id: string): Promise<void> {
    const { error } = await supabaseArrivage
        .from(TABLE)
        .delete()
        .eq("id", id)

    if (error) throw error
}
