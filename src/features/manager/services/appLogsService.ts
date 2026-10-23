// Couche service de la feature manager — ressource app_logs
// (docs/Architecture_Feature.pdf §5). Wrappers nommés, strictement
// mécaniques, autour des appels Supabase de la table `app_logs`.
import { supabase } from "@/integrations/supabase/client"

export interface AppLogsQueryFilters {
    level?: string
    search?: string
    userId?: string
    from?: string
    to?: string
}

/**
 * Lecture paginée des logs applicatifs.
 *
 * count:"planned" (estimation du query planner) et NON "exact" :
 * un COUNT(*) exact scannait toute la table `app_logs` (fort volume)
 * à chaque chargement → statement timeout 57014 → HTTP 500. Voir le
 * même correctif dans logsCRMService. Le total affiché devient une
 * estimation, acceptable pour un viewer de logs.
 */
export function fetchAppLogs(filters: AppLogsQueryFilters, limit: number) {
    let query = supabase
        .from("app_logs")
        .select("*", { count: "planned" })
        .order("created_at", { ascending: false })
        .limit(limit)

    if (filters.level && filters.level !== "all") {
        query = query.eq("level", filters.level)
    }
    if (filters.userId) {
        query = query.eq("user_id", filters.userId)
    }
    if (filters.search) {
        query = query.or(
            `message.ilike.%${filters.search}%,url.ilike.%${filters.search}%,user_email.ilike.%${filters.search}%`
        )
    }
    if (filters.from) {
        query = query.gte("created_at", filters.from)
    }
    if (filters.to) {
        query = query.lte("created_at", filters.to)
    }

    return query
}

/** Suppression ciblée (ids) ou totale (`neq id 0`) des logs applicatifs. */
export function deleteAppLogs(ids?: number[]) {
    let query = supabase.from("app_logs").delete()

    if (ids && ids.length > 0) {
        query = query.in("id", ids)
    } else {
        query = query.neq("id", 0)
    }

    return query
}
