// ── services/planLayoutService.ts ─────────────────────────────────────────────
// Couche service — disposition du plan de l'entrepôt
// (table `plan_layout_handpick`, ligne unique `default`).
//
// Le JSON n'est PAS validé ici : `normalizeLayout` (utils/floorPlanEdit.ts)
// s'en charge côté hook, pour qu'une donnée ancienne ou partielle retombe sur
// la disposition par défaut au lieu de casser l'écran.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/usePlanLayout.ts

import { supabase } from "@/integrations/supabase/client"
import type { Json } from "@/integrations/supabase/types"
import { HANDPICK_TABLES } from "@/features/stock_handpick/constants"
import type { FloorLayout } from "@/features/stock_handpick/utils/floorPlan"

const LAYOUT_ID = "default"

export interface StoredPlanLayout {
    layout: unknown
    updated_at: string
    updated_by: string | null
}

/** `null` tant qu'aucune disposition n'a été enregistrée. */
export async function fetchPlanLayout(): Promise<StoredPlanLayout | null> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.planLayout)
        .select("layout, updated_at, updated_by")
        .eq("id", LAYOUT_ID)
        .maybeSingle()

    if (error) throw error
    return (data as StoredPlanLayout | null) ?? null
}

/** Enregistre la disposition ; auteur et date sont posés par la base. */
export async function savePlanLayout(layout: FloorLayout): Promise<void> {
    const { error } = await supabase
        .from(HANDPICK_TABLES.planLayout)
        // FloorLayout est un objet JSON pur (sans Date ni fonction), mais
        // TypeScript ne sait pas le prouver face au type récursif `Json`.
        .upsert({ id: LAYOUT_ID, layout: layout as unknown as Json })

    if (error) throw error
}

export function subscribeToPlanLayout(userId: string, onEvent: () => void): () => void {
    const channel = supabase
        .channel(`plan_layout_handpick_realtime_${userId}`)
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: HANDPICK_TABLES.planLayout },
            onEvent,
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
