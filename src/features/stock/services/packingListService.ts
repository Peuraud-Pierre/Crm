// ── services/packingListService.ts ────────────────────────────────────────────
// Couche service — packing lists des arrivages manuels (tables `packing_list`,
// `packing_list_ligne`, vue `v_packing_list_summary`, RPC de cycle de vie).
//
// L'IMPORT n'est pas ici : il passe par le service Go, voir
// `packingImportService.ts`. Ce fichier ne fait que relire et corriger ce que
// l'import a écrit.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useArrivageManuel.ts → synthèses attachées aux arrivages
//   - hooks/data/usePackingList.ts    → lignes et vérification
//   - services/packingImportMock.ts   → écriture du brouillon simulé

import type { SupabaseClient } from "@supabase/supabase-js"
import { supabase } from "@/integrations/supabase/client"
import type {
    PackingListLigne,
    PackingListSummary,
} from "@/features/stock/types/packing-list.types"

/**
 * Client non typé : les tables de packing ne sont pas encore dans
 * `integrations/supabase/types.ts`. Même contournement que `supabaseArrivage`,
 * à retirer après régénération des types, une fois appliquées les migrations
 * `20260915100000_stock_packing_list.sql`,
 * `20260917100000_stock_packing_list_document_shape.sql` et
 * `20260917101000_stock_packing_label_dictionary.sql`.
 */
export const supabasePacking = supabase as unknown as SupabaseClient

export const PACKING_TABLES = {
    header: "packing_list",
    lignes: "packing_list_ligne",
    summary: "v_packing_list_summary",
    dictionary: "packing_label_category",
    // Journal des décisions humaines (migration 20260918100000). Lecture seule
    // partout : seuls des triggers SECURITY DEFINER y écrivent. Consommé par la
    // console de supervision (`features/packing-admin`).
    feedback: "packing_label_feedback",
} as const

const toNumberOrNull = (value: unknown): number | null =>
    value === null || value === undefined ? null : Number(value)

// Les agrégats de la vue arrivent en `numeric` : PostgREST les sérialise en
// chaîne. On les ramène en nombre ici plutôt que dans chaque consommateur.
function toSummary(row: Record<string, unknown>): PackingListSummary {
    return {
        ...(row as unknown as PackingListSummary),
        line_count: Number(row.line_count ?? 0),
        lines_unmatched: Number(row.lines_unmatched ?? 0),
        lines_from_dictionary: Number(row.lines_from_dictionary ?? 0),
        lines_from_model: Number(row.lines_from_model ?? 0),
        lines_reviewed: Number(row.lines_reviewed ?? 0),
        total_packages: Number(row.total_packages ?? 0),
        total_pieces: Number(row.total_pieces ?? 0),
        total_weight_kg: Number(row.total_weight_kg ?? 0),
        rows_failing_math: Number(row.rows_failing_math ?? 0),
        declared_package_count: toNumberOrNull(row.declared_package_count),
        // `null` = le fichier n'annonce aucun total. À ne pas confondre avec 0,
        // qui veut dire « il s'annonce juste ».
        package_count_gap: toNumberOrNull(row.package_count_gap),
    }
}

function toLigne(row: Record<string, unknown>): PackingListLigne {
    return {
        ...(row as unknown as PackingListLigne),
        package_count: toNumberOrNull(row.package_count),
        units_per_package: toNumberOrNull(row.units_per_package),
        declared_total: toNumberOrNull(row.declared_total),
        source_row: toNumberOrNull(row.source_row),
        match_confidence: toNumberOrNull(row.match_confidence),
        normalizer_version: Number(row.normalizer_version ?? 0),
    }
}

// ─── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Toutes les synthèses visibles. Sans `stock.packing.view`, la RLS renvoie un
 * résultat vide et non une erreur : les arrivages s'affichent alors sans
 * packing, ce qui est le comportement voulu.
 */
export async function fetchPackingSummaries(): Promise<PackingListSummary[]> {
    const { data, error } = await supabasePacking
        .from(PACKING_TABLES.summary)
        .select("*")

    if (error) throw error
    return (data ?? []).map(toSummary)
}

export async function fetchPackingSummary(id: string): Promise<PackingListSummary | null> {
    const { data, error } = await supabasePacking
        .from(PACKING_TABLES.summary)
        .select("*")
        .eq("id", id)
        .maybeSingle()

    if (error) throw error
    return data ? toSummary(data) : null
}

export async function fetchLignes(packingId: string): Promise<PackingListLigne[]> {
    const { data, error } = await supabasePacking
        .from(PACKING_TABLES.lignes)
        .select("*")
        .eq("packing_list_id", packingId)
        .order("position", { ascending: true })

    if (error) throw error
    return (data ?? []).map(toLigne)
}

// ─── Vérification — throw on error ─────────────────────────────────────────────

const now = () => new Date().toISOString()

/**
 * Attribue une catégorie à TOUT un groupe de libellés bruts. C'est le geste
 * principal de l'écran : corriger « PLO RalLrt » une fois corrige ses douze
 * lignes.
 *
 * `resolution: "human"` est la trace qui distingue cet arbitrage d'une
 * résolution par le dictionnaire — c'est lui qui, à la validation, enseignera
 * la correspondance pour les conteneurs suivants.
 */
export async function assignGroup(
    packingId: string,
    rawLabelKey: string,
    categoryId: string,
): Promise<void> {
    const { error } = await supabasePacking
        .from(PACKING_TABLES.lignes)
        .update({ category_id: categoryId, resolution: "human", reviewed_at: now() })
        .eq("packing_list_id", packingId)
        .eq("raw_label_key", rawLabelKey)

    if (error) throw error
}

/**
 * Confirme la proposition pour les seules lignes ENCORE SANS catégorie d'un
 * groupe. C'est le geste derrière « Confirmer » et derrière « Tout confirmer ».
 *
 * La restriction aux lignes vides est ce qui rend le geste sans risque : un
 * libellé dont l'utilisateur a déjà réattribué une ligne à la main garde son
 * arbitrage, au lieu de se faire écraser par la proposition.
 */
export async function assignGroupUnmatched(
    packingId: string,
    rawLabelKey: string,
    categoryId: string,
): Promise<void> {
    const { error } = await supabasePacking
        .from(PACKING_TABLES.lignes)
        .update({ category_id: categoryId, resolution: "human", reviewed_at: now() })
        .eq("packing_list_id", packingId)
        .eq("raw_label_key", rawLabelKey)
        .is("category_id", null)

    if (error) throw error
}

/**
 * Confirme d'un coup les propositions de plusieurs groupes. Une requête par
 * catégorie distincte plutôt qu'une par groupe : confirmer 50 libellés ne doit
 * pas coûter 50 allers-retours.
 */
export async function assignManyUnmatched(
    packingId: string,
    assignments: ReadonlyArray<{ rawLabelKey: string; categoryId: string }>,
): Promise<void> {
    const byCategory = new Map<string, string[]>()
    for (const { rawLabelKey, categoryId } of assignments) {
        const bucket = byCategory.get(categoryId)
        if (bucket) bucket.push(rawLabelKey)
        else byCategory.set(categoryId, [rawLabelKey])
    }

    for (const [categoryId, keys] of byCategory) {
        const { error } = await supabasePacking
            .from(PACKING_TABLES.lignes)
            .update({ category_id: categoryId, resolution: "human", reviewed_at: now() })
            .eq("packing_list_id", packingId)
            .in("raw_label_key", keys)
            .is("category_id", null)

        if (error) throw error
    }
}

/** Réattribue UNE ligne — le cas d'un libellé qui regroupe deux marchandises. */
export async function assignLigne(id: string, categoryId: string): Promise<void> {
    const { error } = await supabasePacking
        .from(PACKING_TABLES.lignes)
        .update({ category_id: categoryId, resolution: "human", reviewed_at: now() })
        .eq("id", id)

    if (error) throw error
}

/**
 * État d'UNE ligne avant un geste, tel que l'annulation doit le rétablir.
 *
 * `category_id` à `null` est la valeur qui compte : c'est elle qui fait
 * SUPPRIMER par trigger la ligne de `packing_label_feedback` écrite par la
 * décision. L'annulation défait alors le geste jusque dans ce que le modèle en
 * a appris — ce qui n'est vrai que dans ce sens-là, d'où la restriction posée
 * dans `usePackingList`.
 */
export interface PackingLigneState {
    id: string
    category_id: string | null
    resolution: PackingListLigne["resolution"]
    reviewed_at: string | null
}

/**
 * Rétablit l'état antérieur de plusieurs lignes. Regroupées par état identique
 * — les lignes d'un même geste en partagent un — pour qu'annuler une
 * attribution de masse coûte une requête et non cinquante.
 */
export async function restoreLignes(
    packingId: string,
    entries: readonly PackingLigneState[],
): Promise<void> {
    const byState = new Map<string, { state: PackingLigneState; ids: string[] }>()
    for (const entry of entries) {
        const key = `${entry.category_id ?? ""}|${entry.resolution ?? ""}|${entry.reviewed_at ?? ""}`
        const bucket = byState.get(key)
        if (bucket) bucket.ids.push(entry.id)
        else byState.set(key, { state: entry, ids: [entry.id] })
    }

    for (const { state, ids } of byState.values()) {
        const { error } = await supabasePacking
            .from(PACKING_TABLES.lignes)
            .update({
                category_id: state.category_id,
                resolution: state.resolution,
                reviewed_at: state.reviewed_at,
            })
            .eq("packing_list_id", packingId)
            .in("id", ids)

        if (error) throw error
    }
}

// ─── Cycle de vie — throw on error ─────────────────────────────────────────────

/** Refusée par la base s'il reste une ligne sans catégorie. */
export async function validatePackingList(id: string): Promise<void> {
    const { error } = await supabasePacking.rpc("validate_packing_list", { p_id: id })
    if (error) throw error
}

export async function reopenPackingList(id: string): Promise<void> {
    const { error } = await supabasePacking.rpc("reopen_packing_list", { p_id: id })
    if (error) throw error
}

/** Emporte les lignes (`ON DELETE CASCADE`). L'arrivage, lui, reste. */
export async function deletePackingList(id: string): Promise<void> {
    const { error } = await supabasePacking
        .from(PACKING_TABLES.header)
        .delete()
        .eq("id", id)

    if (error) throw error
}

// ─── Realtime ──────────────────────────────────────────────────────────────────

/**
 * Changements de l'en-tête d'UNE packing list : c'est ainsi qu'un import
 * traité en asynchrone par Go (`en_traitement` → `a_verifier`) apparaît dans
 * la sheet ouverte. Les lignes ne sont pas suivies — seul l'utilisateur de la
 * sheet les modifie pendant la vérification.
 */
export function subscribeToPackingList(id: string, onEvent: () => void): () => void {
    const channel = supabasePacking
        .channel(`packing_list_${id}`)
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: PACKING_TABLES.header, filter: `id=eq.${id}` },
            onEvent,
        )
        .subscribe()

    return () => {
        supabasePacking.removeChannel(channel)
    }
}
