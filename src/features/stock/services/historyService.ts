// ── services/historyService.ts ────────────────────────────────────────────────
// Couche service — opérations Supabase du domaine Historique
// (tables `activity_log`, `category_price_history`, `profiles`).
// Déplacement mécanique depuis hooks/data/useHistory.ts
// (règle no-restricted-imports).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useHistory.ts      → journal de l'onglet Historique
//   - hooks/data/useEntityHistory.ts → historique d'une fiche (tri, livraison)

import { supabase } from "@/integrations/supabase/client"
import { ACTIVITY_LOG_LIMIT } from "@/features/stock/constants"
import type { ActivityLog, CategoryPriceHistory } from "@/features/stock/types/history.types"

export interface LogFetchParams {
    actionFilter: string
    entityFilter: string
    dateFrom:     string
    dateTo:       string
}

export async function fetchActivityLogs(
    params: LogFetchParams
): Promise<ActivityLog[]> {
    const { actionFilter, entityFilter, dateFrom, dateTo } = params

    // Borne explicite : `activity_log` est append-heavy et la pagination du
    // journal est faite côté client. Sans limite, chaque ouverture de l'onglet
    // rapatriait toute la table. Au-delà de la borne, l'UI l'annonce.
    let query = supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_LOG_LIMIT)

    if (actionFilter !== "all") query = query.eq("action", actionFilter)
    if (entityFilter !== "all") query = query.eq("entity_type", entityFilter)
    // Les deux bornes en heure LOCALE, converties en ISO : `dateFrom` partait
    // brut (« 2026-09-01 »), que Postgres lit comme minuit UTC, quand `dateTo`
    // était déjà une fin de journée locale — la période n'était pas la même
    // journée aux deux bouts.
    if (dateFrom) {
        const start = new Date(`${dateFrom}T00:00:00`)
        query = query.gte("created_at", start.toISOString())
    }
    if (dateTo) {
        const end = new Date(`${dateTo}T23:59:59`)
        query = query.lte("created_at", end.toISOString())
    }

    const { data, error } = await query
    if (error) throw error
    return (data ?? []) as ActivityLog[]
}

/**
 * Historique d'UNE entité (fiche de tri, livraison, carton…), du plus
 * récent au plus ancien. Sert aux fiches de détail : ce qui est arrivé à
 * cet objet précis, sans passer par l'onglet Historique.
 */
export async function fetchEntityLogs(entityType: string, entityIds: string[]): Promise<ActivityLog[]> {
    if (entityIds.length === 0) return []
    const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("entity_type", entityType)
        .in("entity_id", entityIds)
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_LOG_LIMIT)

    if (error) throw error
    return (data ?? []) as ActivityLog[]
}

export async function fetchPriceHistory(): Promise<CategoryPriceHistory[]> {
    const { data, error } = await supabase
        .from("category_price_history")
        .select("*")
        .order("created_at", { ascending: true })

    if (error) throw error
    return (data ?? []) as CategoryPriceHistory[]
}

/** Map user_id → full_name pour affichage des auteurs du journal. */
export async function fetchUserNameMap(): Promise<Map<string, string>> {
    const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")

    if (error) throw error
    const map = new Map<string, string>()
    for (const p of data ?? []) {
        if (p.user_id && p.full_name) map.set(p.user_id, p.full_name)
    }
    return map
}
