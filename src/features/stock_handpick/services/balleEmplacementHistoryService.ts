// ── services/balleEmplacementHistoryService.ts ────────────────────────────────
// Couche service — historique d'emplacement d'une balle
// (table `balles_emplacements_handpick`, plus `profiles` pour les auteurs).
//
// Lecture SEULE : la table n'a aucune policy d'écriture, ses lignes sont
// produites par le trigger `log_balle_emplacement_handpick`.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useBalleEmplacementHistory.ts

import { supabase } from "@/integrations/supabase/client"
import { HANDPICK_TABLES } from "@/features/stock_handpick/constants"
import type { BalleEmplacementEvent } from "@/features/stock_handpick/types/balle.types"

export async function fetchEmplacementHistory(balleId: string): Promise<BalleEmplacementEvent[]> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.balleEmplacements)
        .select("*")
        .eq("balle_id", balleId)
        .order("created_at", { ascending: false })

    if (error) throw error
    return (data ?? []) as BalleEmplacementEvent[]
}

/**
 * Noms des seuls utilisateurs cités — une fiche en cite quelques-uns, charger
 * tous les profils serait payé pour rien.
 */
export async function fetchUserNames(userIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    if (userIds.length === 0) return map

    const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds)

    if (error) throw error
    for (const profile of data ?? []) {
        if (profile.user_id && profile.full_name) map.set(profile.user_id, profile.full_name)
    }
    return map
}
