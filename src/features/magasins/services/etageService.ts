// ── services/etageService.ts ──────────────────────────────────────────────────
// Couche service — table `etages_magasin` (migration 20261008110000). Un
// magasin naît avec son RDC (trigger en base) ; supprimer un étage emporte ses
// zones, emplacements et équipements (cascade).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useEtages.ts

import { supabase } from "@/integrations/supabase/client"
import type { Json } from "@/integrations/supabase/types"
import { MAGASIN_TABLES } from "@/features/magasins/constants"
import type { Etage, EtageFormInput, EtagePatch } from "@/features/magasins/types/magasin.types"

export async function fetchEtages(magasinId: string): Promise<Etage[]> {
    const { data, error } = await supabase
        .from(MAGASIN_TABLES.etages)
        .select("*")
        .eq("magasin_id", magasinId)
        .order("niveau", { ascending: true })
    if (error || !data) throw error
    return data as unknown as Etage[]
}

export async function insertEtage(magasinId: string, input: EtageFormInput): Promise<Etage> {
    const { data, error } = await supabase
        .from(MAGASIN_TABLES.etages)
        .insert({ ...input, magasin_id: magasinId })
        .select()
        .single()
    if (error) throw error
    return data as unknown as Etage
}

export async function patchEtage(id: string, patch: EtagePatch): Promise<void> {
    const { contour, ...rest } = patch
    const row = contour === undefined ? rest : { ...rest, contour: contour as unknown as Json }
    const { error } = await supabase.from(MAGASIN_TABLES.etages).update(row).eq("id", id)
    if (error) throw error
}

export async function removeEtage(id: string): Promise<void> {
    const { error } = await supabase.from(MAGASIN_TABLES.etages).delete().eq("id", id)
    if (error) throw error
}
