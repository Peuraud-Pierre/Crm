// ── services/triService.ts ────────────────────────────────────────────────────
// Couche service — salle de tri (tables `fiches_tri`, `fiches_tri_balles`,
// `fiches_tri_repartition`, `trieurs`, `tri_sorties`, vues `v_fiches_tri` et
// `v_fiches_tri_balles`, RPC `save_fiche_tri`).
//
// Une fiche ne s'écrit QUE par la RPC `save_fiche_tri` : en-tête, balles et
// répartition en une transaction, et une entrée de journal par
// enregistrement. La RLS n'ouvre en écriture directe que la suppression.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useTri.ts → seul consommateur

import type { SupabaseClient } from "@supabase/supabase-js"
import { supabase } from "@/integrations/supabase/client"
import { ReferentialConflictError } from "@/features/stock"
import type {
    FicheTri,
    FicheTriBalle,
    FicheTriBalleInput,
    FicheTriComplete,
    FicheTriInput,
    Trieur,
    TriRepartition,
    TriSortie,
} from "@/features/salle-de-tri/types/tri.types"

/**
 * Client non typé : les tables de tri ne sont pas encore dans
 * `integrations/supabase/types.ts`. Même contournement que `supabasePacking`,
 * à retirer après application de `20261001100000_stock_tri.sql` et
 * régénération des types.
 */
const supabaseTri = supabase as unknown as SupabaseClient

const TABLES = {
    fiches: "fiches_tri",
    repartition: "fiches_tri_repartition",
    vue: "v_fiches_tri",
    vueBalles: "v_fiches_tri_balles",
    trieurs: "trieurs",
    sorties: "tri_sorties",
} as const

/** Une RLS qui refuse un UPDATE/DELETE ne lève rien : elle n'affecte aucune ligne. */
const RLS_REFUSAL = "Action refusée : vous n'avez pas la permission nécessaire."

/**
 * Une URL PostgREST a une longueur bornée : les filtres `in` partent par lots.
 * Un UUID coûte ~39 caractères encodé : 150 par lot (~6 Ko de query string)
 * faisait rejeter la requête par la passerelle, sans en-têtes CORS — le
 * navigateur n'en montrait qu'un « Failed to fetch ». 50 tient en ~2 Ko.
 */
const BATCH = 50

// La base rend les `numeric` en chaîne : on les convertit une fois, ici.
const num = (v: unknown) => Number(v ?? 0)

const toFiche = (row: Record<string, unknown>): FicheTri => ({
    ...(row as unknown as FicheTri),
    poids_initial_kg: num(row.poids_initial_kg),
    poids_reparti_kg: num(row.poids_reparti_kg),
    ecart_kg: num(row.ecart_kg),
    nb_balles: num(row.nb_balles),
    nb_balles_ecart: num(row.nb_balles_ecart),
    qualite_moyenne: row.qualite_moyenne === null ? null : num(row.qualite_moyenne),
})

const toBalle = (row: Record<string, unknown>, repartition: TriRepartition[]): FicheTriBalle => ({
    ...(row as unknown as FicheTriBalle),
    poids_initial_kg: num(row.poids_initial_kg),
    poids_reparti_kg: num(row.poids_reparti_kg),
    ecart_kg: num(row.ecart_kg),
    repartition,
})

/** Lots lancés en parallèle : en découper plus ne doit pas rallonger le chargement. */
async function inBatches<T>(ids: string[], fetch: (chunk: string[]) => Promise<T[]>): Promise<T[]> {
    const chunks: string[][] = []
    for (let i = 0; i < ids.length; i += BATCH) chunks.push(ids.slice(i, i + BATCH))
    return (await Promise.all(chunks.map(fetch))).flat()
}

// ─── Fiches ──────────────────────────────────────────────────────────────────

/**
 * Fiches d'une période, avec leurs balles. Seule la période est filtrée côté
 * base ; les autres filtres (trieur, catégorie…) s'appliquent en mémoire
 * (`utils/triAnalytics.applyTriFilters`), ce qui garde la navigation
 * instantanée et nourrit les statistiques sans seconde requête.
 */
export async function fetchFichesComplete(range: { from: string; to: string }): Promise<FicheTriComplete[]> {
    let query = supabaseTri
        .from(TABLES.vue)
        .select("*")
        .order("date_tri", { ascending: false })
        .order("numero", { ascending: false })
    if (range.from) query = query.gte("date_tri", range.from)
    if (range.to) query = query.lte("date_tri", range.to)

    const { data, error } = await query
    if (error) throw error
    const fiches = (data ?? []).map(toFiche)
    if (fiches.length === 0) return []

    const balles = await fetchBalles(fiches.map((f) => f.id))
    const byFiche = new Map<string, FicheTriBalle[]>()
    for (const b of balles) byFiche.set(b.fiche_id, [...(byFiche.get(b.fiche_id) ?? []), b])
    return fiches.map((f) => ({ ...f, balles: byFiche.get(f.id) ?? [] }))
}

/** Balles de plusieurs fiches (vue : totaux dérivés), avec leur répartition. */
async function fetchBalles(ficheIds: string[]): Promise<FicheTriBalle[]> {
    const rows = await inBatches(ficheIds, async (chunk) => {
        const { data, error } = await supabaseTri
            .from(TABLES.vueBalles)
            .select("*")
            .in("fiche_id", chunk)
            .order("ordre", { ascending: true })
        if (error) throw error
        return (data ?? []) as Record<string, unknown>[]
    })
    if (rows.length === 0) return []

    const parts = await inBatches(rows.map((r) => String(r.id)), async (chunk) => {
        const { data, error } = await supabaseTri
            .from(TABLES.repartition)
            .select("balle_id, sortie_id, poids_kg")
            .in("balle_id", chunk)
        if (error) throw error
        return (data ?? []) as { balle_id: string; sortie_id: string; poids_kg: unknown }[]
    })
    const byBalle = new Map<string, TriRepartition[]>()
    for (const p of parts) {
        byBalle.set(p.balle_id, [...(byBalle.get(p.balle_id) ?? []), { sortie_id: p.sortie_id, poids_kg: num(p.poids_kg) }])
    }
    return rows.map((r) => toBalle(r, byBalle.get(String(r.id)) ?? []))
}

/** Une fiche et ses balles, hors période chargée (lien profond, notification). */
export async function fetchFicheComplete(id: string): Promise<FicheTriComplete | null> {
    const { data, error } = await supabaseTri.from(TABLES.vue).select("*").eq("id", id).maybeSingle()
    if (error) throw error
    if (!data) return null
    return { ...toFiche(data), balles: await fetchBalles([id]) }
}

/** Crée (sans `id`) ou remplace une fiche et toutes ses balles. Renvoie l'id. */
export async function saveFiche(fiche: FicheTriInput, balles: FicheTriBalleInput[]): Promise<string> {
    const { data, error } = await supabaseTri.rpc("save_fiche_tri", { p_fiche: fiche, p_balles: balles })
    if (error) throw error
    return data as string
}

export async function deleteFiche(id: string): Promise<void> {
    const { data, error } = await supabaseTri.from(TABLES.fiches).delete().eq("id", id).select("id")
    if (error) throw error
    if (!data?.length) throw new ReferentialConflictError(RLS_REFUSAL)
}

// ─── Référentiels ────────────────────────────────────────────────────────────

export async function fetchTrieurs(): Promise<Trieur[]> {
    const { data, error } = await supabaseTri.from(TABLES.trieurs).select("*").order("nom")
    if (error) throw error
    return (data ?? []) as Trieur[]
}

export async function fetchSorties(): Promise<TriSortie[]> {
    const { data, error } = await supabaseTri
        .from(TABLES.sorties)
        .select("*")
        .order("ordre")
        .order("code")
    if (error) throw error
    return (data ?? []) as TriSortie[]
}

type Referential = typeof TABLES.trieurs | typeof TABLES.sorties

async function insertRow<T>(table: Referential, payload: object): Promise<T> {
    const { data, error } = await supabaseTri.from(table).insert(payload).select("*").single()
    if (error) throw error
    return data as T
}

async function updateRow<T>(table: Referential, id: string, payload: object): Promise<T> {
    const { data, error } = await supabaseTri.from(table).update(payload).eq("id", id).select("*")
    if (error) throw error
    if (!data?.length) throw new ReferentialConflictError(RLS_REFUSAL)
    return data[0] as T
}

async function deleteRow(table: Referential, id: string): Promise<void> {
    const { data, error } = await supabaseTri.from(table).delete().eq("id", id).select("id")
    if (error) throw error
    if (!data?.length) throw new ReferentialConflictError(RLS_REFUSAL)
}

export const insertTrieur = (payload: Pick<Trieur, "nom" | "actif">) =>
    insertRow<Trieur>(TABLES.trieurs, { nom: payload.nom.trim(), actif: payload.actif })
export const updateTrieur = (id: string, payload: Partial<Pick<Trieur, "nom" | "actif">>) =>
    updateRow<Trieur>(TABLES.trieurs, id, payload)
export const deleteTrieur = (id: string) => deleteRow(TABLES.trieurs, id)

export const insertSortie = (payload: Pick<TriSortie, "code" | "libelle" | "ordre" | "actif">) =>
    insertRow<TriSortie>(TABLES.sorties, { ...payload, code: payload.code.trim().toUpperCase() })
export const updateSortie = (id: string, payload: Partial<Pick<TriSortie, "code" | "libelle" | "ordre" | "actif">>) =>
    updateRow<TriSortie>(TABLES.sorties, id, payload.code ? { ...payload, code: payload.code.trim().toUpperCase() } : payload)
export const deleteSortie = (id: string) => deleteRow(TABLES.sorties, id)

// ─── Realtime ────────────────────────────────────────────────────────────────

/**
 * Un seul canal pour l'onglet : fiches, trieurs et types de sortie. Le
 * payload n'est pas exploité — tout événement relance le chargement, la vue
 * recalculant les totaux de toute façon.
 */
export function subscribeTri(onChange: () => void): () => void {
    const channel = supabase.channel(`stock_tri_${crypto.randomUUID()}`)
    for (const table of [TABLES.fiches, TABLES.trieurs, TABLES.sorties]) {
        channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange)
    }
    channel.subscribe()
    return () => {
        void supabase.removeChannel(channel)
    }
}
