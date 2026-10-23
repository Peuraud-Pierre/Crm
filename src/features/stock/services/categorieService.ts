// ── services/categorieService.ts ──────────────────────────────────────────────
// Couche service — opérations Supabase du domaine Catégorie
// (table `categories_gestion`). Déplacement mécanique depuis
// hooks/data/useCategorie.ts (règle no-restricted-imports).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useCategorie.ts → seul consommateur de ce service

import { supabase } from "@/integrations/supabase/client"
import type { BalleCategory } from "@/features/stock/types/stock.types"
import {
    buildCategoryTag,
    categoryNameKey,
    normalizeCategoryName,
    normalizeCategoryTag,
} from "@/features/stock/utils/categoryNaming"
import { ReferentialConflictError } from "@/features/stock/utils/crudErrors"

// ─── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchCategories(): Promise<BalleCategory[]> {
    const { data, error } = await supabase
        .from("categories_gestion")
        .select("*")
        .order("created_at", { ascending: false })

    if (error || !data) throw error
    return data as BalleCategory[]
}

export async function fetchSingleCategory(id: string): Promise<BalleCategory> {
    const { data, error } = await supabase
        .from("categories_gestion")
        .select("*")
        .eq("id", id)
        .single()

    if (error) throw error
    return data as BalleCategory
}

// ─── Mise en forme ────────────────────────────────────────────────────────────

/**
 * Préflight : ce qui existe déjà, pour arbitrer le nom et le tag.
 *
 * Comparer en JS plutôt que filtrer en `ilike` est volontaire. D'une part
 * `categories_gestion` tient en quelques dizaines de lignes, donc le coût est
 * celui d'un aller-retour et non d'un balayage. D'autre part un nom saisi peut
 * contenir `%` ou `_` (« 100% coton ») : construire un motif à partir de la
 * saisie demanderait un échappement, et un échappement oublié transforme une
 * garde en passe-plat. Ici on compare des chaînes, il n'y a pas de motif.
 *
 * Le même appel sert aux deux besoins — doublon de nom ET tags déjà pris — pour
 * ne pas payer deux requêtes par création.
 */
async function fetchNamingIndex(): Promise<Pick<BalleCategory, "id" | "name" | "tag">[]> {
    const { data, error } = await supabase
        .from("categories_gestion")
        .select("id,name,tag")

    if (error) throw error
    return (data ?? []) as Pick<BalleCategory, "id" | "name" | "tag">[]
}

/**
 * Refuse un nom déjà porté par une autre catégorie, casse et espaces
 * surnuméraires mis à part.
 *
 * `categories_gestion` n'a AUCUNE contrainte d'unicité sur le nom (contrairement
 * à `categories_handpick`, qui porte `uq_categories_handpick_name`) : la garde
 * est donc applicative. Elle ne pourra devenir une contrainte que le jour où les
 * doublons de casse déjà en base auront été fusionnés à la main.
 */
function assertNameIsFree(
    name: string,
    index: Pick<BalleCategory, "id" | "name" | "tag">[],
    exceptId?: string,
): void {
    if (name === "") {
        throw new ReferentialConflictError("Le nom de la catégorie est vide.")
    }

    const key = categoryNameKey(name)
    const clash = index.find(
        (row) => row.id !== exceptId && categoryNameKey(row.name ?? "") === key,
    )

    if (clash) {
        throw new ReferentialConflictError(
            `La catégorie « ${clash.name} » existe déjà.`,
        )
    }
}

// ─── Mutations — throw on error (géré par useOptimisticCrud) ──────────────────

/**
 * Crée une catégorie sous sa forme canonique : nom en majuscules, tag à 4
 * caractères.
 *
 * Le tag est DÉDUIT quand l'appelant n'en fournit pas — la création immédiate
 * depuis une packing list ne demande que le nom. Sans ça la catégorie naît avec
 * un tag vide et le BIN de la première balle qui l'utilise sort tronqué, sans
 * que rien ne le signale (voir `categoryNaming.ts`). Un tag saisi à la main
 * n'est jamais réécrit, seulement mis en forme.
 */
export async function insertCategory(
    payload: Omit<BalleCategory, "id">
): Promise<BalleCategory> {
    const name = normalizeCategoryName(payload.name)
    const index = await fetchNamingIndex()
    assertNameIsFree(name, index)

    const typedTag = normalizeCategoryTag(payload.tag)
    const tag = typedTag !== ""
        ? typedTag
        : buildCategoryTag(name, index.map((row) => row.tag)) ?? ""

    const { data, error } = await supabase
        .from("categories_gestion")
        .insert({ ...payload, name, tag })
        .select()
        .single()

    if (error) throw error
    return data as BalleCategory
}

export async function patchCategory(
    id: string,
    payload: Partial<Omit<BalleCategory, "id">>
): Promise<void> {
    const patch = { ...payload }

    // Normalisation à l'édition aussi : sinon une catégorie créée en majuscules
    // pourrait être renommée en minuscules par l'autre porte.
    if (patch.name !== undefined) {
        patch.name = normalizeCategoryName(patch.name)
        assertNameIsFree(patch.name, await fetchNamingIndex(), id)
    }
    if (patch.tag !== undefined) patch.tag = normalizeCategoryTag(patch.tag)

    const { data, error } = await supabase
        .from("categories_gestion")
        .update(patch)
        .eq("id", id)
        .select("id")

    if (error) throw error

    // Une RLS qui refuse l'UPDATE ne renvoie pas d'erreur — juste zéro ligne
    // affectée. Sans ce garde-fou l'échec est silencieux : l'optimisme de
    // `useOptimisticCrud` n'est jamais annulé et l'écran affiche une
    // modification qui n'a pas eu lieu. Même précédent que
    // `newsletterService.updateSubscriberCrmStat`.
    if (!data || data.length === 0) {
        throw new ReferentialConflictError(
            "Modification refusée (droits insuffisants ou catégorie introuvable).",
        )
    }
}

export async function removeCategory(id: string): Promise<void> {
    const { error } = await supabase
        .from("categories_gestion")
        .delete()
        .eq("id", id)

    if (error) throw error
}
