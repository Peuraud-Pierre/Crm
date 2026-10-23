// ── services/categorieHandpickService.ts ──────────────────────────────────────
// Couche service — domaine Catégorie du stock handpick
// (table `categories_handpick`).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useCategorieHandpick.ts → seul consommateur

import { supabase } from "@/integrations/supabase/client"
import { HANDPICK_TABLES } from "@/features/stock_handpick/constants"
import type { CategoryHandpick } from "@/features/stock_handpick/types/referential.types"

/** Colonnes de `categories_handpick` acceptées en écriture. */
export type CategoryWritable = Omit<
    CategoryHandpick,
    "id" | "created_at" | "updated_at" | "created_by"
>

// ─── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchCategories(): Promise<CategoryHandpick[]> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.categories)
        .select("*")
        .order("name", { ascending: true })

    if (error || !data) throw error
    return data as CategoryHandpick[]
}

export async function fetchSingleCategory(id: string): Promise<CategoryHandpick> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.categories)
        .select("*")
        .eq("id", id)
        .single()

    if (error) throw error
    return data as CategoryHandpick
}

// ─── Mutations — throw on error (géré par useOptimisticCrud) ──────────────────

export async function insertCategory(payload: CategoryWritable): Promise<CategoryHandpick> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.categories)
        .insert(payload)
        .select()
        .single()

    if (error) throw error
    return data as CategoryHandpick
}

export async function patchCategory(
    id: string,
    payload: Partial<CategoryWritable>,
): Promise<void> {
    const { error } = await supabase
        .from(HANDPICK_TABLES.categories)
        .update(payload)
        .eq("id", id)

    if (error) throw error
}

export async function removeCategory(id: string): Promise<void> {
    const { error } = await supabase
        .from(HANDPICK_TABLES.categories)
        .delete()
        .eq("id", id)

    if (error) throw error
}

// ─── Comptages d'usage ─────────────────────────────────────────────────────────

/**
 * Nombre de balles par catégorie. Sert à l'écran Paramètres pour expliquer
 * pourquoi une suppression est refusée (les FK de `balles_handpick` sont en
 * ON DELETE RESTRICT) avant même de tenter l'appel.
 *
 * `head: true` + `count: "exact"` : on ne rapatrie aucune ligne, juste le
 * compte — une catégorie peut porter des milliers de balles.
 */
export async function countBallesForCategory(categoryId: string): Promise<number> {
    const { count, error } = await supabase
        .from(HANDPICK_TABLES.balles)
        .select("id", { count: "exact", head: true })
        .eq("category_id", categoryId)

    if (error) throw error
    return count ?? 0
}

/**
 * Balles qui empêchent de supprimer l'usine. Les éclatées ne comptent pas :
 * la base les en détache à la suppression, en gardant son nom
 * (migration 20260923120000).
 */
export async function countBallesForFournisseur(fournisseurId: string): Promise<number> {
    const { count, error } = await supabase
        .from(HANDPICK_TABLES.balles)
        .select("id", { count: "exact", head: true })
        .eq("fournisseur_id", fournisseurId)
        .eq("is_eclatee", false)

    if (error) throw error
    return count ?? 0
}
