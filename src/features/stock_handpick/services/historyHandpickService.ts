// ── services/historyHandpickService.ts ────────────────────────────────────────
// Couche service — journal d'activité du stock handpick
// (table `activity_log_handpick`, plus `profiles` pour les auteurs).
//
// Lecture SEULE : la RLS de `activity_log_handpick` n'accorde aucune policy
// d'écriture, les lignes sont produites exclusivement par les triggers de la
// migration 20260914145000. Toute tentative d'insert depuis le client est
// refusée — c'est voulu.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useHistoryHandpick.ts → seul consommateur

import { supabase } from "@/integrations/supabase/client"
import { ACTIVITY_LOG_LIMIT, HANDPICK_TABLES } from "@/features/stock_handpick/constants"
import type { HandpickActivityLog } from "@/features/stock_handpick/types/history.types"

export async function fetchActivityLog(
    limit: number = ACTIVITY_LOG_LIMIT,
): Promise<HandpickActivityLog[]> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.activityLog)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit)

    if (error || !data) throw error
    return data as HandpickActivityLog[]
}

/**
 * Map user_id → full_name pour l'affichage des auteurs.
 */
export async function fetchUserNameMap(): Promise<Map<string, string>> {
    const { data, error } = await supabase.from("profiles").select("user_id, full_name")

    if (error) throw error

    const map = new Map<string, string>()
    for (const profile of data ?? []) {
        if (profile.user_id && profile.full_name) map.set(profile.user_id, profile.full_name)
    }
    return map
}
