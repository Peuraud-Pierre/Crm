// Couche service de la feature manager — ressource logs_crm
// (docs/Architecture_Feature.pdf §5). Wrappers nommés, strictement
// mécaniques, autour des appels Supabase de la table d'audit `logs_crm`.
//
// ⚠️ Table d'audit CRM : le champ `brief` y est DOUBLE-ENCODÉ côté base
// (`(x::jsonb->>'brief')::jsonb`). Ne rien changer à la logique d'audit —
// ce service est un déplacement mécanique des requêtes de consultation.
import { supabase } from "@/integrations/supabase/client"

export interface LogsCRMQueryFilters {
    operation?: "all" | "INSERT" | "UPDATE" | "DELETE"
    search?: string
}

/**
 * Lecture des derniers logs CRM (avec profil de l'auteur).
 *
 * Pas de `count: "exact"` : il forçait un COUNT(*) sur toute la table
 * `logs_crm` à chaque chargement (scan complet → statement timeout 57014).
 * Seules `limit` lignes sont chargées puis paginées côté client.
 */
export function fetchLogsCRM(filters: LogsCRMQueryFilters, limit: number) {
    let query = supabase
        .from("logs_crm")
        .select(
            "*, changed_by_profile:profiles!logs_crm_changed_by_fkey(user_id, full_name)"
        )
        .order("change_at", { ascending: false })
        .limit(limit)

    if (filters.operation && filters.operation !== "all") {
        query = query.eq("operation", filters.operation)
    }

    if (filters.search) {
        query = query.or(
            `row_id.ilike.%${filters.search}%,table_name.ilike.%${filters.search}%`
        )
    }

    return query
}
