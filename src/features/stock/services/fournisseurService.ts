// ── services/fournisseurService.ts ────────────────────────────────────────────
// Couche service — opérations Supabase du domaine Fournisseur
// (table `fournisseur_gestion`). Déplacement mécanique depuis
// hooks/data/useFournisseur.ts (règle no-restricted-imports).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useFournisseur.ts → seul consommateur de ce service

import { supabase } from "@/integrations/supabase/client"
import type { Fournisseur } from "@/features/stock/types/stock.types"

// ─── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchFournisseurs(): Promise<Fournisseur[]> {
    const { data, error } = await supabase
        .from("fournisseur_gestion")
        .select("*")
        .order("created_at", { ascending: false })

    if (error || !data) throw error
    return data as Fournisseur[]
}

export async function fetchSingleFournisseur(id: string): Promise<Fournisseur> {
    const { data, error } = await supabase
        .from("fournisseur_gestion")
        .select("*")
        .eq("id", id)
        .single()

    if (error) throw error
    return data as Fournisseur
}

// ─── Mutations — throw on error (géré par useOptimisticCrud) ──────────────────

export async function insertFournisseur(
    payload: Omit<Fournisseur, "id" | "created_at">
): Promise<Fournisseur> {
    const { data, error } = await supabase
        .from("fournisseur_gestion")
        .insert(payload)
        .select()
        .single()

    if (error) throw error
    return data as Fournisseur
}

export async function patchFournisseur(
    id: string,
    payload: Partial<Omit<Fournisseur, "id" | "created_at">>
): Promise<void> {
    const { error } = await supabase
        .from("fournisseur_gestion")
        .update(payload)
        .eq("id", id)

    if (error) throw error
}

export async function removeFournisseur(id: string): Promise<void> {
    const { error } = await supabase
        .from("fournisseur_gestion")
        .delete()
        .eq("id", id)

    if (error) throw error
}
