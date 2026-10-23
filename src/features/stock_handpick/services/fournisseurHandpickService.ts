// ── services/fournisseurHandpickService.ts ────────────────────────────────────
// Couche service — domaine Fournisseur du stock handpick
// (tables `fournisseurs_handpick` et `fournisseurs_categories_handpick`).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useFournisseurHandpick.ts → seul consommateur

import { supabase } from "@/integrations/supabase/client"
import { HANDPICK_TABLES } from "@/features/stock_handpick/constants"
import type {
    FournisseurHandpick,
    FournisseurCategoryLink,
    CategoryOption,
    FournisseurWithCategories,
} from "@/features/stock_handpick/types/referential.types"

/** Colonnes de `fournisseurs_handpick` acceptées en écriture. */
export type FournisseurWritable = Omit<
    FournisseurHandpick,
    "id" | "created_at" | "updated_at" | "created_by"
>

// ─── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchFournisseurs(): Promise<FournisseurHandpick[]> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.fournisseurs)
        .select("*")
        .order("name", { ascending: true })

    if (error || !data) throw error
    return data as FournisseurHandpick[]
}

export async function fetchSingleFournisseur(id: string): Promise<FournisseurHandpick> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.fournisseurs)
        .select("*")
        .eq("id", id)
        .single()

    if (error) throw error
    return data as FournisseurHandpick
}

/**
 * Toutes les liaisons fournisseur ↔ catégorie, à plat.
 *
 * Le volume est celui d'un référentiel (quelques centaines de lignes au pire) :
 * on charge tout une fois et on recompose côté client, plutôt qu'une requête
 * par fournisseur à chaque ouverture de formulaire.
 */
export async function fetchFournisseurCategoryLinks(): Promise<FournisseurCategoryLink[]> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.fournisseursCategories)
        .select("fournisseur_id, category_id, created_at")

    if (error || !data) throw error
    return data as FournisseurCategoryLink[]
}

// ─── Mutations — throw on error (géré par useOptimisticCrud) ──────────────────

export async function insertFournisseur(
    payload: FournisseurWritable,
): Promise<FournisseurHandpick> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.fournisseurs)
        .insert(payload)
        .select()
        .single()

    if (error) throw error
    return data as FournisseurHandpick
}

export async function patchFournisseur(
    id: string,
    payload: Partial<FournisseurWritable>,
): Promise<void> {
    const { error } = await supabase
        .from(HANDPICK_TABLES.fournisseurs)
        .update(payload)
        .eq("id", id)

    if (error) throw error
}

export async function removeFournisseur(id: string): Promise<void> {
    const { error } = await supabase
        .from(HANDPICK_TABLES.fournisseurs)
        .delete()
        .eq("id", id)

    if (error) throw error
}

// ─── Liaison fournisseur ↔ catégorie ──────────────────────────────────────────

/**
 * Aligne les catégories d'un fournisseur sur `categoryIds` : n'écrit que le
 * delta. Un delete-all + insert-all aurait produit une avalanche d'entrées
 * dans le journal d'activité à chaque enregistrement, y compris quand rien ne
 * change réellement.
 *
 * Les deux écritures ne sont pas dans une transaction (PostgREST n'en expose
 * pas) : en cas d'échec de la seconde, la première reste appliquée. Le
 * rattachement de catégories est idempotent et rejouable, l'écran affiche
 * l'état réel après refetch — le coût d'une RPC dédiée ne se justifie pas ici.
 */
export async function syncFournisseurCategories(
    fournisseurId: string,
    categoryIds: string[],
    currentCategoryIds: string[],
): Promise<void> {
    const toAdd = categoryIds.filter((id) => !currentCategoryIds.includes(id))
    const toRemove = currentCategoryIds.filter((id) => !categoryIds.includes(id))

    if (toAdd.length > 0) {
        const { error } = await supabase
            .from(HANDPICK_TABLES.fournisseursCategories)
            .insert(toAdd.map((category_id) => ({ fournisseur_id: fournisseurId, category_id })))

        if (error) throw error
    }

    if (toRemove.length > 0) {
        const { error } = await supabase
            .from(HANDPICK_TABLES.fournisseursCategories)
            .delete()
            .eq("fournisseur_id", fournisseurId)
            .in("category_id", toRemove)

        if (error) throw error
    }
}

// ─── Recomposition ─────────────────────────────────────────────────────────────

/**
 * Fonction pure : croise fournisseurs, catégories et liaisons pour produire la
 * forme que consomment les formulaires (choisir un fournisseur restreint les
 * catégories proposées).
 *
 * Les catégories inactives sont conservées : une balle historique peut y
 * référer, et les masquer ferait disparaître l'information de la fiche
 * fournisseur. Le filtrage à la saisie est du ressort de l'appelant.
 */
export function buildFournisseursWithCategories(
    fournisseurs: FournisseurHandpick[],
    categories: CategoryOption[],
    links: FournisseurCategoryLink[],
): FournisseurWithCategories[] {
    const byId = new Map(categories.map((category) => [category.id, category]))

    const idsByFournisseur = new Map<string, string[]>()
    for (const link of links) {
        const list = idsByFournisseur.get(link.fournisseur_id)
        if (list) list.push(link.category_id)
        else idsByFournisseur.set(link.fournisseur_id, [link.category_id])
    }

    return fournisseurs.map((fournisseur) => ({
        ...fournisseur,
        categories: (idsByFournisseur.get(fournisseur.id) ?? [])
            .map((id) => byId.get(id))
            .filter((category): category is CategoryOption => category !== undefined)
            .sort((a, b) => a.name.localeCompare(b.name, "fr")),
    }))
}
