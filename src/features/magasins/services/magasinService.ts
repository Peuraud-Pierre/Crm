// ── services/magasinService.ts ────────────────────────────────────────────────
// Couche service — table `magasins` (migration 20261007100000_magasins).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useMagasins.ts

import { supabase } from "@/integrations/supabase/client"
import { MAGASIN_TABLES } from "@/features/magasins/constants"
import type { Magasin, MagasinFormInput, MagasinPatch } from "@/features/magasins/types/magasin.types"

export async function fetchMagasins(): Promise<Magasin[]> {
    const { data, error } = await supabase
        .from(MAGASIN_TABLES.magasins)
        .select("*")
        .order("nom", { ascending: true })

    if (error || !data) throw error
    return data as Magasin[]
}

export async function insertMagasin(input: MagasinFormInput): Promise<Magasin> {
    const { data, error } = await supabase
        .from(MAGASIN_TABLES.magasins)
        .insert(input)
        .select()
        .single()

    if (error) throw error
    return data as Magasin
}

export async function patchMagasin(id: string, input: MagasinPatch): Promise<void> {
    const { error } = await supabase.from(MAGASIN_TABLES.magasins).update(input).eq("id", id)
    if (error) throw error
}

/** Emporte zones et emplacements du magasin (cascade en base). */
export async function removeMagasin(id: string): Promise<void> {
    const { error } = await supabase.from(MAGASIN_TABLES.magasins).delete().eq("id", id)
    if (error) throw error
}
