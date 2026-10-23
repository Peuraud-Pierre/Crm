// ── services/balleHandpickService.ts ──────────────────────────────────────────
// Couche service — domaine Balle du stock handpick (table `balles_handpick`).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useBalleHandpick.ts
//   - hooks/data/usePlanHandpick.ts (via `fetchPlacedBalles`)
//   - components/flux/LigneDraftRow.tsx (via `searchBalles`)

import { supabase } from "@/integrations/supabase/client"
import { HANDPICK_TABLES } from "@/features/stock_handpick/constants"
import { IN_FILTER_MAX, chunk } from "@/features/stock_handpick/utils/chunk"
import type {
    BalleHandpick,
    BalleHandpickFormInput,
} from "@/features/stock_handpick/types/balle.types"

/**
 * Jointures constantes. Elles ne sont JAMAIS réécrites : les colonnes
 * correspondantes sont retirées des payloads avant tout UPDATE (voir
 * `stripJoins`), sans quoi PostgREST refuserait la requête.
 */
const BALLE_SELECT = `
    *,
    fournisseur:fournisseurs_handpick(id, name, siege_localisation),
    category:categories_handpick(id, name),
    emplacement:emplacements_handpick(id, code, zone_id)
`

/** Colonnes réellement écrites en base. */
export type BalleWritable = BalleHandpickFormInput

function stripJoins(
    payload: Partial<BalleHandpick>,
): Omit<Partial<BalleHandpick>, "fournisseur" | "category" | "emplacement"> {
    const { fournisseur, category, emplacement, ...rest } = payload
    void fournisseur
    void category
    void emplacement
    return rest
}

// ─── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchBalles(limit: number): Promise<BalleHandpick[]> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.balles)
        .select(BALLE_SELECT)
        .order("created_at", { ascending: false })
        .limit(limit)

    if (error || !data) throw error
    return data as BalleHandpick[]
}

export async function fetchSingleBalle(id: string): Promise<BalleHandpick> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.balles)
        .select(BALLE_SELECT)
        .eq("id", id)
        .single()

    if (error) throw error
    return data as BalleHandpick
}

/**
 * Recherche par libellé, pour rattacher une balle à une ligne de colisage.
 *
 * L'inventaire n'est chargé que par paliers de `BALLE_INITIAL_LIMIT` : se
 * contenter du palier en mémoire rendrait toute balle plus ancienne
 * introuvable, sans que rien ne le signale. Cette requête va la chercher en
 * base.
 *
 * Recherche sur `raw_name` seul. Pas sur l'`id` : la colonne est de type
 * `uuid`, et Postgres n'a pas d'opérateur `ilike` pour ce type — la requête
 * échouerait à l'exécution sans que rien ne le signale au typage. Une balle
 * sans libellé se retrouve donc par son expédition, pas par ce champ.
 */
export async function searchBalles(query: string, limit: number): Promise<BalleHandpick[]> {
    const term = query.trim()
    if (!term) return []

    // `%` et `_` sont les jokers de `ilike`, `\` leur échappement : les
    // neutraliser évite qu'une saisie les contenant ne remonte tout
    // l'inventaire. `,` et `.` sont, eux, les séparateurs de la syntaxe
    // PostgREST — on les retire plutôt que de les échapper.
    const escaped = term
        .replace(/[\\%_]/g, (c) => `\\${c}`)
        .replace(/[,.()]/g, " ")

    const { data, error } = await supabase
        .from(HANDPICK_TABLES.balles)
        .select(BALLE_SELECT)
        .ilike("raw_name", `%${escaped}%`)
        // Une balle éclatée n'existe plus physiquement : on ne la rattache
        // plus à une expédition.
        .eq("is_eclatee", false)
        .order("created_at", { ascending: false })
        .limit(limit)

    if (error) throw error
    return (data ?? []) as BalleHandpick[]
}

/**
 * Toutes les balles rangées, pour l'onglet Plan. Le board d'inventaire ne
 * détient qu'un palier : le plan compterait faux s'il s'en servait.
 */
export async function fetchPlacedBalles(): Promise<BalleHandpick[]> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.balles)
        .select(BALLE_SELECT)
        .not("emplacement_id", "is", null)
        .order("placed_at", { ascending: false, nullsFirst: false })

    if (error) throw error
    return (data ?? []) as BalleHandpick[]
}

/** Nombre total de balles, pour distinguer « rien » de « rien de plus chargé ». */
export async function countBalles(): Promise<number> {
    const { count, error } = await supabase
        .from(HANDPICK_TABLES.balles)
        .select("id", { count: "exact", head: true })

    if (error) throw error
    return count ?? 0
}

// ─── Mutations — throw on error (géré par useOptimisticCrud) ──────────────────

export async function insertBalle(payload: BalleWritable): Promise<BalleHandpick> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.balles)
        .insert(payload)
        .select(BALLE_SELECT)
        .single()

    if (error) throw error
    return data as BalleHandpick
}

/**
 * Création en lot : UNE requête, donc un seul INSERT côté Postgres — si une
 * ligne est refusée (contrainte, RLS), aucune balle n'est créée.
 */
export async function insertBalles(payloads: BalleWritable[]): Promise<BalleHandpick[]> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.balles)
        .insert(payloads)
        .select(BALLE_SELECT)

    if (error) throw error
    return (data ?? []) as BalleHandpick[]
}

export async function patchBalle(
    id: string,
    payload: Partial<BalleHandpick>,
): Promise<void> {
    const { error } = await supabase
        .from(HANDPICK_TABLES.balles)
        .update(stripJoins(payload))
        .eq("id", id)

    if (error) throw error
}

export async function removeBalle(id: string): Promise<void> {
    const { error } = await supabase
        .from(HANDPICK_TABLES.balles)
        .delete()
        .eq("id", id)

    if (error) throw error
}

/**
 * Assigne (ou retire) l'emplacement d'une balle.
 *
 * C'est ici que vit l'invariant documenté sur `balles_handpick.location` :
 * une balle adressée est en entrepôt. La base ne le contraint pas — un CHECK
 * croisé forcerait tous les formulaires à écrire les deux colonnes ensemble —
 * donc il est posé au seul endroit qui écrit `emplacement_id`.
 */
export async function setEmplacement(
    id: string,
    emplacementId: string | null,
): Promise<void> {
    const { error } = await supabase
        .from(HANDPICK_TABLES.balles)
        .update(
            emplacementId
                ? { emplacement_id: emplacementId, placed_at: new Date().toISOString(), location: "warehouse" }
                : { emplacement_id: null, placed_at: null },
        )
        .eq("id", id)

    if (error) throw error
}

/**
 * Déplace plusieurs balles vers le même emplacement (ou les retire de leur
 * emplacement avec `null`). Même invariant que `setEmplacement` : une balle
 * adressée est en entrepôt. Les balles empruntées ou éclatées sont exclues
 * côté base : on ne les déplace pas par ce chemin.
 *
 * Écrit par paquets de `IN_FILTER_MAX` ids (limite d'URL du proxy). Retourne
 * le nombre de balles effectivement déplacées.
 */
export async function moveBalles(ids: readonly string[], emplacementId: string | null): Promise<number> {
    const patch = emplacementId
        ? { emplacement_id: emplacementId, placed_at: new Date().toISOString(), location: "warehouse" }
        : { emplacement_id: null, placed_at: null }

    let moved = 0
    for (const part of chunk(ids, IN_FILTER_MAX)) {
        const { data, error } = await supabase
            .from(HANDPICK_TABLES.balles)
            .update(patch)
            .in("id", part)
            .is("borrowed_by", null)
            .eq("is_eclatee", false)
            .select("id")

        if (error) throw error
        moved += (data ?? []).length
    }
    return moved
}

/**
 * Emprunte une balle : elle quitte son emplacement et passe au handpick. Le
 * trigger d'historique garde l'emplacement quitté, c'est là qu'on la rendra
 * par défaut.
 *
 * Le filtre `borrowed_by IS NULL` rend l'emprunt atomique : deux personnes
 * qui empruntent en même temps, seule la première l'obtient.
 */
export async function borrowBalle(id: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.balles)
        .update({
            borrowed_by: userId,
            borrowed_at: new Date().toISOString(),
            emplacement_id: null,
            placed_at: null,
            location: "handpick",
        })
        .eq("id", id)
        .is("borrowed_by", null)
        .select("id")

    if (error) throw error
    return (data ?? []).length > 0
}

/**
 * Rend une balle empruntée en la rangeant dans `emplacementId`.
 *
 * Les filtres `borrowed_by IS NOT NULL` et `is_eclatee = false` rendent le
 * retour atomique : une balle éclatée ou déjà rendue entre-temps (fiche pas
 * encore rafraîchie) n'est pas remise en rayon. Faux dans ce cas.
 */
export async function returnBalle(id: string, emplacementId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.balles)
        .update({
            borrowed_by: null,
            borrowed_at: null,
            emplacement_id: emplacementId,
            placed_at: new Date().toISOString(),
            location: "warehouse",
        })
        .eq("id", id)
        .not("borrowed_by", "is", null)
        .eq("is_eclatee", false)
        .select("id")

    if (error) throw error
    return (data ?? []).length > 0
}

/**
 * Éclate une balle : elle sort définitivement du stock (statut `eclatee`),
 * quitte son emplacement et, si elle l'était, son emprunt. `location` est
 * conservée. La ligne reste en base pour les statistiques.
 *
 * Le filtre `is_eclatee = false` rend l'opération atomique : une balle ne
 * s'éclate qu'une fois. Faux si elle l'était déjà.
 */
export async function eclaterBalle(id: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.balles)
        .update({
            is_eclatee: true,
            status: "eclatee",
            eclatee_at: new Date().toISOString(),
            eclatee_by: userId,
            emplacement_id: null,
            placed_at: null,
            borrowed_by: null,
            borrowed_at: null,
        })
        .eq("id", id)
        .eq("is_eclatee", false)
        .select("id")

    if (error) throw error
    return (data ?? []).length > 0
}

// ─── Realtime ──────────────────────────────────────────────────────────────────

/**
 * Abonnement à tous les événements de `balles_handpick`. Le debounce du
 * rechargement reste côté hook : une écriture groupée émet N événements.
 * Retourne la fonction de désabonnement.
 */
export function subscribeToBalles(userId: string, onEvent: () => void): () => void {
    const channel = supabase
        .channel(`balles_handpick_realtime_${userId}`)
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: HANDPICK_TABLES.balles },
            onEvent,
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
