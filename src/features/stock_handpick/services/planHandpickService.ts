// ── services/planHandpickService.ts ───────────────────────────────────────────
// Couche service — plan de l'entrepôt handpick
// (tables `zones_handpick` et `emplacements_handpick`).
//
// Aucune UI de plan n'existe en V1 : seul le select d'emplacement de
// l'Inventaire consomme ces données. Le service est néanmoins complet en
// lecture (arbre entier) pour que le futur éditeur 2D n'ait rien à réécrire.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useEmplacementHandpick.ts (lecture)
//   - hooks/data/usePlanStructureSync.ts (création des emplacements du plan)

import { supabase } from "@/integrations/supabase/client"
import { HANDPICK_TABLES } from "@/features/stock_handpick/constants"
import type { Emplacement, ZoneNode } from "@/features/stock_handpick/types/location.types"

// ─── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * L'arbre est chargé à plat puis recomposé côté client (voir
 * `utils/planHelpers.ts`). Un plan d'entrepôt tient en mémoire ; un
 * `WITH RECURSIVE` par écran serait payé pour rien.
 */
export async function fetchZones(): Promise<ZoneNode[]> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.zones)
        .select("*")
        .order("sort_order", { ascending: true })
        .order("code", { ascending: true })

    if (error || !data) throw error
    return data as ZoneNode[]
}

export async function fetchEmplacements(): Promise<Emplacement[]> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.emplacements)
        .select("*")
        .order("code", { ascending: true })

    if (error || !data) throw error
    return data as Emplacement[]
}

// ─── Mutations — throw on error ───────────────────────────────────────────────

export async function insertZone(
    payload: Partial<ZoneNode> & Pick<ZoneNode, "kind" | "code">,
): Promise<ZoneNode> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.zones)
        .insert(payload)
        .select()
        .single()

    if (error) throw error
    return data as ZoneNode
}

export async function patchZone(id: string, payload: Partial<ZoneNode>): Promise<void> {
    const { error } = await supabase
        .from(HANDPICK_TABLES.zones)
        .update(payload)
        .eq("id", id)

    if (error) throw error
}

/**
 * `emplacements_handpick.zone_id` est en ON DELETE RESTRICT : supprimer une
 * zone échoue tant qu'un emplacement descendant subsiste, et l'erreur pointe
 * alors la table des emplacements plutôt que la zone cliquée. On compte avant
 * pour pouvoir refuser côté UI avec un message qui nomme la vraie cause.
 */
export async function countEmplacementsInZones(zoneIds: string[]): Promise<number> {
    if (zoneIds.length === 0) return 0

    const { count, error } = await supabase
        .from(HANDPICK_TABLES.emplacements)
        .select("id", { count: "exact", head: true })
        .in("zone_id", zoneIds)

    if (error) throw error
    return count ?? 0
}

export async function removeZone(id: string): Promise<void> {
    const { error } = await supabase
        .from(HANDPICK_TABLES.zones)
        .delete()
        .eq("id", id)

    if (error) throw error
}

export async function insertEmplacement(
    payload: Partial<Emplacement> & Pick<Emplacement, "zone_id" | "code">,
): Promise<Emplacement> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.emplacements)
        .insert(payload)
        .select()
        .single()

    if (error) throw error
    return data as Emplacement
}

export async function patchEmplacement(
    id: string,
    payload: Partial<Emplacement>,
): Promise<void> {
    const { error } = await supabase
        .from(HANDPICK_TABLES.emplacements)
        .update(payload)
        .eq("id", id)

    if (error) throw error
}

export async function removeEmplacement(id: string): Promise<void> {
    const { error } = await supabase
        .from(HANDPICK_TABLES.emplacements)
        .delete()
        .eq("id", id)

    if (error) throw error
}
