// ── services/mouvementHandpickService.ts ──────────────────────────────────────
// Couche service — lignes de colisage d'une expédition (`mouvements_handpick`).
//
// Une ligne appartient toujours à un flux (`flux_id`, NOT NULL). Le tableau de
// l'onglet Flux liste les en-têtes, pas les lignes — voir `fluxHandpickService`.
//
// Lecture : `fetchLignes(fluxId)` → le colisage d'une expédition.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useMouvementHandpick.ts

import { supabase } from "@/integrations/supabase/client"
import { HANDPICK_TABLES } from "@/features/stock_handpick/constants"
import type {
    MouvementFormInput,
    MouvementHandpick,
} from "@/features/stock_handpick/types/flux.types"

const MOUVEMENT_SELECT = `
    *,
    category:categories_handpick(id, name)
`


function stripJoins(
    payload: Partial<MouvementHandpick>,
): Omit<Partial<MouvementHandpick>, "category" | "total_value"> {
    // `total_value` est une colonne générée en base : la renvoyer en écriture
    // ferait échouer la requête.
    const { category, total_value, ...rest } = payload
    void category
    void total_value
    return rest
}

// ─── Fetch ─────────────────────────────────────────────────────────────────────

/** Liste de colisage d'une expédition, dans l'ordre de saisie. */
export async function fetchLignes(fluxId: string): Promise<MouvementHandpick[]> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.mouvements)
        .select(MOUVEMENT_SELECT)
        .eq("flux_id", fluxId)
        .order("created_at", { ascending: true })

    if (error) throw error
    return (data ?? []) as MouvementHandpick[]
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export async function insertLigne(payload: MouvementFormInput): Promise<MouvementHandpick> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.mouvements)
        .insert(payload)
        .select(MOUVEMENT_SELECT)
        .single()

    if (error) throw error
    return data as MouvementHandpick
}

/**
 * Insère plusieurs lignes d'un coup — le cas normal d'une liste de colisage
 * saisie ou importée en une fois. Un seul aller-retour, et un seul échec
 * possible : PostgREST rejette le lot entier si une ligne est invalide.
 */
export async function insertLignes(
    payloads: MouvementFormInput[],
): Promise<MouvementHandpick[]> {
    if (payloads.length === 0) return []

    const { data, error } = await supabase
        .from(HANDPICK_TABLES.mouvements)
        .insert(payloads)
        .select(MOUVEMENT_SELECT)

    if (error) throw error
    return (data ?? []) as MouvementHandpick[]
}

export async function patchLigne(
    id: string,
    payload: Partial<MouvementHandpick>,
): Promise<void> {
    const { error } = await supabase
        .from(HANDPICK_TABLES.mouvements)
        .update(stripJoins(payload))
        .eq("id", id)

    if (error) throw error
}

export async function removeLigne(id: string): Promise<void> {
    const { error } = await supabase
        .from(HANDPICK_TABLES.mouvements)
        .delete()
        .eq("id", id)

    if (error) throw error
}
