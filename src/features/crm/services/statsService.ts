import { supabase } from "@/integrations/supabase/client"
import type { Database } from "@/integrations/supabase/types"

export type CrmEventStatRow =
    Database["public"]["Functions"]["get_crm_event_stats"]["Returns"][number]
export type EventCalendarRow =
    Database["public"]["Tables"]["Event_calendar"]["Row"]

/** Tentative RPC SECURITY DEFINER (bypass RLS) — voir use_stats.tsx pour le fallback. */
export async function fetchEventStatsRpc(
    effectiveStart: string,
    rangeEnd: string
) {
    return supabase.rpc("get_crm_event_stats", {
        p_range_start: effectiveStart,
        p_range_end: rangeEnd,
    })
}

/** Fallback select direct si le RPC get_crm_event_stats n'existe pas encore en DB. */
export async function fetchEventStatsFallback(
    effectiveStart: string,
    rangeEnd: string,
    userId: string | null
) {
    let query = supabase
        .from("Event_calendar")
        .select("*")
        .gte("created_at", effectiveStart)
        .lt("created_at", rangeEnd)
        // .filter() (non typé par colonne) : la colonne `source` existe en DB
        // mais manque dans les types Supabase générés — même requête que .eq().
        .filter("source", "eq", "crm")
        .not("customer", "is", null)

    if (userId) {
        // Filtre sur le setter assigné (`customer`), pas le créateur : la
        // création passe presque toujours par un compte central (cf.
        // AnalyticsContext.getEventSetterId), `creator_id` ne représente donc
        // pas le commercial réel.
        query = query.eq("customer", userId)
    }

    return query
        .order("creator_id", { ascending: true })
        .order("id_client", { ascending: true })
        .order("debut", { ascending: true })
        .order("created_at", { ascending: true })
        .limit(10000)
}

/**
 * Fallback select direct pour EventsPalier.tsx : mêmes RPC/fallback que
 * fetchEventStatsRpc, mais filtré par une liste fixe de creator_id plutôt que
 * par l'utilisateur courant (widget "paliers" toujours cumulé sur 3 commerciaux
 * ciblés). Filtres source/dédoublonnage appliqués côté appelant, comme pour
 * fetchEventStatsFallback.
 */
export async function fetchEventStatsFallbackByCreators(
    start: string,
    end: string,
    creatorIds: string[]
) {
    return supabase
        .from("Event_calendar")
        .select("*")
        .gte("created_at", start)
        .lt("created_at", end)
        .in("creator_id", creatorIds)
        .limit(10000)
}

export function countClientsFiltered(
    userId: string | null,
    start: string | null,
    end: string | null
) {
    return supabase.rpc("count_clients_filtered", {
        p_user_id: userId,
        p_start: start,
        p_end: end,
    })
}

export function getClientColumnCounts(userId: string | null) {
    return supabase.rpc("get_client_column_counts", { p_user_id: userId })
}
