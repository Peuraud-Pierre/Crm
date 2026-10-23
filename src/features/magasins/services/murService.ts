// ── services/murService.ts ────────────────────────────────────────────────────
// Couche service — table `murs_magasin` (migration 20261008150000).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/usePlanMagasin.ts

import { supabase } from "@/integrations/supabase/client"
import type { Json } from "@/integrations/supabase/types"
import { MAGASIN_TABLES } from "@/features/magasins/constants"
import type { Mur, MurPatch, Point } from "@/features/magasins/types/magasin.types"

export async function fetchMurs(magasinId: string): Promise<Mur[]> {
    const { data, error } = await supabase
        .from(MAGASIN_TABLES.murs)
        .select("*")
        .eq("magasin_id", magasinId)
        .order("created_at", { ascending: true })
    if (error || !data) throw error
    return data as unknown as Mur[]
}

export async function insertMur(magasinId: string, etageId: string, points: readonly Point[], epaisseur: number): Promise<Mur> {
    const { data, error } = await supabase
        .from(MAGASIN_TABLES.murs)
        .insert({ magasin_id: magasinId, etage_id: etageId, points: points as unknown as Json, epaisseur })
        .select()
        .single()
    if (error) throw error
    return data as unknown as Mur
}

export async function patchMur(id: string, patch: MurPatch): Promise<void> {
    const { points, ...rest } = patch
    const row = points === undefined ? rest : { ...rest, points: points as unknown as Json }
    const { error } = await supabase.from(MAGASIN_TABLES.murs).update(row).eq("id", id)
    if (error) throw error
}

export async function removeMur(id: string): Promise<void> {
    const { error } = await supabase.from(MAGASIN_TABLES.murs).delete().eq("id", id)
    if (error) throw error
}
