// ── services/livraisonService.ts ──────────────────────────────────────────────
// Couche service — opérations Supabase du domaine Livraison
// (table `deliveries_gestion`). Déplacement mécanique depuis
// hooks/data/useLivraison.ts (règle no-restricted-imports).
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useLivraison.ts → seul consommateur de ce service

import { supabase } from "@/integrations/supabase/client"
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js"
import type { Delivery, DeliveryFormInput } from "@/features/stock/types/stock.types"

const DELIVERY_SELECT = `*,
    fournisseur:fournisseur_gestion(name, siege_localisation)
    `

// ─── Fetch ─────────────────────────────────────────────────────────────────────

export async function fetchDeliveryByDIN(din: string): Promise<Delivery | null> {
    const { data, error } = await supabase
        .from("deliveries_gestion")
        .select(DELIVERY_SELECT)
        .eq("din", din)
        .maybeSingle()

    if (error) throw error
    if (!data) return null
    return data as Delivery
}

export async function fetchSingleDelivery(id: string): Promise<Delivery> {
    const { data, error } = await supabase
        .from("deliveries_gestion")
        .select(DELIVERY_SELECT)
        .eq("id", id)
        .single()

    if (error) throw error
    return data as Delivery
}

export async function fetchDeliveries(): Promise<Delivery[]> {
    const { data, error } = await supabase
        .from("deliveries_gestion")
        .select(DELIVERY_SELECT)
        .order("created_at", { ascending: false })

    if (error || !data) throw error
    return data as Delivery[]
}

// ─── Mutations ─────────────────────────────────────────────────────────────────

export async function insertDelivery(
    delivery: DeliveryFormInput,
    createdBy: string
): Promise<Delivery> {
    const { data, error } = await supabase
        .from("deliveries_gestion")
        .insert([{ ...delivery, created_by: createdBy }])
        .select(DELIVERY_SELECT)
        .single()

    if (error) throw error
    return data as Delivery
}

export async function patchDelivery(
    id: string,
    delivery: Partial<Delivery>
): Promise<void> {
    // Le champ de jointure `fournisseur` n'est pas une colonne de
    // `deliveries_gestion` : on le retire avant l'UPDATE (sinon rejet
    // du typage insert/update Supabase).
    const { fournisseur, ...columns } = delivery
    void fournisseur

    const { error } = await supabase
        .from("deliveries_gestion")
        .update(columns)
        .eq("id", id)
        .select(DELIVERY_SELECT)
        .single()

    if (error) throw error
}

export async function removeDelivery(id: string): Promise<void> {
    const { error } = await supabase
        .from("deliveries_gestion")
        .delete()
        .eq("id", id)

    if (error) throw error
}

// ─── Realtime ──────────────────────────────────────────────────────────────────

/**
 * Abonnement realtime à tous les événements (INSERT, UPDATE, DELETE) sur
 * `deliveries_gestion`. Le traitement du payload reste côté hook.
 * Retourne la fonction de désabonnement (removeChannel).
 */
export function subscribeToDeliveries(
    userId: string,
    onEvent: (
        payload: RealtimePostgresChangesPayload<Record<string, unknown>>
    ) => void | Promise<void>
): () => void {
    const channel = supabase
        .channel(`deliveries_realtime_${userId}`)
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "deliveries_gestion" },
            onEvent
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
