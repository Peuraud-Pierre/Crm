import type { SupabaseClient } from "@supabase/supabase-js"
import { supabase } from "@/integrations/supabase/client"

/**
 * Client Supabase non typé ponctuel pour `crm_produit_recherche_monthly_stats` :
 * table pas encore dans `integrations/supabase/types.ts` (fichier
 * auto-généré). Typage applicatif assuré par `ProduitRechercheMonthlyPoint`
 * côté front en attendant.
 *
 * **À régénérer après avoir appliqué la migration** :
 *
 *   npx supabase gen types typescript --project-id <id> \
 *     > src/integrations/supabase/types.ts
 */
const supabaseProduitRechercheMonthly = supabase as unknown as SupabaseClient

export interface ProduitRechercheMonthlyPoint {
    month: string
    product: string
    total: number
}

export async function listProduitRechercheMonthlyStats(): Promise<
    ProduitRechercheMonthlyPoint[]
> {
    const { data, error } = await supabaseProduitRechercheMonthly
        .from("crm_produit_recherche_monthly_stats")
        .select("snapshot_month, product_name, total_entries")
        .order("snapshot_month", { ascending: true })
    if (error) throw error
    return (
        (data as {
            snapshot_month: string
            product_name: string
            total_entries: number
        }[]) || []
    ).map((row) => ({
        month: row.snapshot_month,
        product: row.product_name,
        total: row.total_entries,
    }))
}
