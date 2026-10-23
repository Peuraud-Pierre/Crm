// ── services/balleService.ts ──────────────────────────────────────────────────
// Couche service — toutes les opérations Supabase du domaine Balle
// (table `balles_gestion`). Déplacement mécanique depuis hooks/data/useBalle.ts
// (règle no-restricted-imports : accès Supabase réservé à services/).
// Ce fichier ne sait rien de React ni de l'affichage (pas de toast) —
// il lance une erreur en cas d'échec, le hook gère la suite.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useBalle.ts → seul consommateur de ce service

import { supabase } from "@/integrations/supabase/client"
import type { Balle, BalleFormInput } from "@/features/stock/types/stock.types"

const BALLE_SELECT = `*,
    fournisseur:fournisseur_gestion(name, siege_localisation),
    category:categories_gestion(name)
    `

// ─── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchBalles(): Promise<Balle[]> {
    const { data, error } = await supabase
        .from("balles_gestion")
        .select(`*,
            fournisseur:fournisseur_gestion(name, siege_localisation),
            category:categories_gestion!category_id(name)
            `)
        .order("created_at", { ascending: false })

    if (error) throw error
    return data as Balle[]
}

export async function fetchSingleBalle(id: string): Promise<Balle> {
    const { data, error } = await supabase
        .from("balles_gestion")
        .select(BALLE_SELECT)
        .eq("id", id)
        .single()

    if (error) throw error
    return data as Balle
}

export async function fetchBalleByBIN(bin: string): Promise<Balle> {
    const { data, error } = await supabase
        .from("balles_gestion")
        .select(BALLE_SELECT)
        .eq("bin", bin)
        .single()

    if (error) throw error
    return data as Balle
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export async function insertBalle(
    balleData: BalleFormInput,
    createdBy: string
): Promise<Balle> {
    const { data, error } = await supabase
        .from("balles_gestion")
        .insert([{ ...balleData, created_by: createdBy }])
        .select(BALLE_SELECT)
        .single()

    if (error) throw error
    return data as Balle
}

export async function insertMultipleBalles(
    ballesData: BalleFormInput[],
    createdBy: string
): Promise<Balle[]> {
    const payload = ballesData.map((balle) => ({
        ...balle,
        created_by: createdBy,
    }))

    const { data, error } = await supabase
        .from("balles_gestion")
        .insert(payload)
        .select(BALLE_SELECT)

    if (error) throw error
    return data as Balle[]
}

export async function patchBalle(
    id: string,
    balleData: Partial<Balle>
): Promise<void> {
    // Les champs de jointure ne sont pas des colonnes de `balles_gestion` :
    // on les retire avant l'UPDATE (sinon rejet du typage insert/update Supabase).
    const { fournisseur, category, historique, ...columns } = balleData
    void fournisseur
    void category
    void historique

    const { error } = await supabase
        .from("balles_gestion")
        .update(columns)
        .eq("id", id)
        .select(BALLE_SELECT)
        .single()

    if (error) throw error
}

export async function removeBalle(id: string): Promise<void> {
    const { error } = await supabase
        .from("balles_gestion")
        .delete()
        .eq("id", id)

    if (error) throw error
}

// ─── Realtime ──────────────────────────────────────────────────────────────────

/**
 * Abonnement realtime à tous les événements (INSERT, UPDATE, DELETE) sur
 * `balles_gestion`. Le debounce du rechargement reste côté hook.
 * Retourne la fonction de désabonnement (removeChannel).
 */
export function subscribeToBalles(
    userId: string,
    onEvent: () => void
): () => void {
    const channel = supabase
        .channel(`balles_realtime_${userId}`)
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "balles_gestion" },
            onEvent
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
