import { supabase } from "@/integrations/supabase/client"
import { HANDPICK_TABLES } from "@/features/stock_handpick/constants"
import type {
    FluxFormInput,
    FluxHandpick,
    FluxHandpickRow,
    MouvementDirection,
    MouvementHandpick,
} from "@/features/stock_handpick/types/flux.types"

/**
 * En-têtes de flux (arrivages / départs), lus et écrits sur `flux_handpick`.
 *
 * Les totaux de la liste de colisage ne sont pas stockés : ils sont calculés
 * ici à partir des lignes embarquées dans la même requête. Ils restent ainsi
 * dérivés, jamais saisis.
 */

type LigneTotaux = Pick<MouvementHandpick, "quantity" | "quantity_unit" | "total_value">

type FluxWithLignes = FluxHandpick & { lignes: LigneTotaux[] | null }

// Noms de tables en clair, sans interpolation : une chaîne littérale est
// analysée par le client typé, qui vérifie colonnes et jointures.
const SELECT = `
    *,
    fournisseur:fournisseurs_handpick(id, name),
    lignes:mouvements_handpick(quantity, quantity_unit, total_value)
`

/** Les quantités ne s'additionnent qu'à unité égale : kilos et pièces à part. */
function withTotals({ lignes, ...flux }: FluxWithLignes): FluxHandpickRow {
    const rows = lignes ?? []
    let total_weight_kg = 0
    let total_qty = 0
    let total_value = 0
    for (const ligne of rows) {
        const quantity = Number(ligne.quantity) || 0
        if (ligne.quantity_unit === "kg") total_weight_kg += quantity
        else if (ligne.quantity_unit === "pieces") total_qty += quantity
        total_value += Number(ligne.total_value) || 0
    }
    // Un poids saisi l'emporte : il couvre aussi les lignes comptées en pièces.
    if (flux.poids_kg != null) total_weight_kg = Number(flux.poids_kg)
    return { ...flux, lignes_count: rows.length, total_weight_kg, total_qty, total_value }
}

/**
 * L'écran trie sur la date de référence (`referenceFlux` : déchargement prévu,
 * à défaut départ), que PostgREST ne sait pas calculer. L'ordre de la requête
 * décide pourtant de ce qui entre dans le palier : trié sur le seul
 * déchargement, un départ — qui n'en a en général pas — passerait derrière
 * tous les arrivages datés. Chaque sens est donc chargé avec sa propre date
 * pilote, puis les deux paliers sont fusionnés ; le tri fin reste côté client.
 */
async function fetchFluxByDirection(
    direction: MouvementDirection,
    limit: number,
): Promise<FluxHandpickRow[]> {
    const [primary, secondary] =
        direction === "in"
            ? (["prev_dechargement_at", "departure_date"] as const)
            : (["departure_date", "prev_dechargement_at"] as const)

    const { data, error } = await supabase
        .from(HANDPICK_TABLES.flux)
        .select(SELECT)
        .eq("direction", direction)
        .order(primary, { ascending: false, nullsFirst: false })
        .order(secondary, { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(limit)

    if (error) throw error
    return ((data ?? []) as FluxWithLignes[]).map(withTotals)
}

export async function fetchFlux(limit: number): Promise<FluxHandpickRow[]> {
    const [arrivages, departs] = await Promise.all([
        fetchFluxByDirection("in", limit),
        fetchFluxByDirection("out", limit),
    ])
    return [...arrivages, ...departs]
}

export async function fetchFluxCount(): Promise<number> {
    const { count, error } = await supabase
        .from(HANDPICK_TABLES.flux)
        .select("id", { count: "exact", head: true })

    if (error) throw error
    return count ?? 0
}

export async function fetchFluxById(id: string): Promise<FluxHandpickRow | null> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.flux)
        .select(SELECT)
        .eq("id", id)
        .maybeSingle()

    if (error) throw error
    return data ? withTotals(data as FluxWithLignes) : null
}

export async function insertFlux(payload: FluxFormInput): Promise<FluxHandpickRow> {
    const { data, error } = await supabase
        .from(HANDPICK_TABLES.flux)
        .insert(payload)
        .select(SELECT)
        .single()

    if (error) throw error
    // Le statut renvoyé est celui posé par le trigger de transition temporelle.
    return withTotals(data as FluxWithLignes)
}

export async function patchFlux(
    id: string,
    payload: Partial<FluxFormInput>,
): Promise<void> {
    const { error } = await supabase
        .from(HANDPICK_TABLES.flux)
        .update(payload)
        .eq("id", id)

    if (error) throw error
}

/**
 * Supprime une expédition. Ses lignes de colisage partent avec elle
 * (`ON DELETE CASCADE`) : une ligne n'a aucun sens sans son expédition.
 */
export async function removeFlux(id: string): Promise<void> {
    const { error } = await supabase
        .from(HANDPICK_TABLES.flux)
        .delete()
        .eq("id", id)

    if (error) throw error
}

// ─── Realtime ──────────────────────────────────────────────────────────────────

/**
 * Abonnement aux expéditions ET à leurs lignes : les totaux affichés dans le
 * tableau viennent des lignes, une liste de colisage modifiée doit donc
 * rafraîchir l'en-tête. Le debounce reste côté hook — une liste de colisage
 * insérée en lot émet un événement par ligne.
 */
export function subscribeToFlux(userId: string, onEvent: () => void): () => void {
    const channel = supabase
        .channel(`flux_handpick_realtime_${userId}`)
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: HANDPICK_TABLES.flux },
            onEvent,
        )
        .on(
            "postgres_changes",
            { event: "*", schema: "public", table: HANDPICK_TABLES.mouvements },
            onEvent,
        )
        .subscribe()

    return () => {
        supabase.removeChannel(channel)
    }
}
