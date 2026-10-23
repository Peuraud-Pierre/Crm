import { supabase } from "@/integrations/supabase/client"
import type { Tables } from "@/integrations/supabase/types"

/**
 * Couche service pour la table `leads` (docs/Architecture_Feature.pdf §5).
 * Déplacé depuis routes/LeadsStats.tsx (déplacement mécanique) — seule la
 * couche service est autorisée à importer le client Supabase (règle ESLint
 * no-restricted-imports).
 */

export type LeadRow = Tables<"leads">

/** Leads créés depuis `fromISO`, du plus récent au plus ancien. */
export async function fetchLeadsSince(fromISO: string) {
    return supabase
        .from("leads")
        .select("*")
        .gte("created_at", fromISO)
        .order("created_at", { ascending: false })
}

/** Les `limit` leads les plus récents — widget de dashboard. */
export async function fetchLatestLeads(limit: number): Promise<LeadRow[]> {
    const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit)

    if (error) throw error
    return data ?? []
}
