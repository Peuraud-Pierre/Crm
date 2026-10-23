// ── services/commandeService.ts ───────────────────────────────────────────────
// Couche service — salle de commande (migration
// `20261001110000_stock_commandes.sql`) : boutiques, commandes (kg bruts
// par catégorie du stock), livraisons boutiques, palettes, cartons, et les
// RPC de transition (expédier, réceptionner, clôturer).
//
// Les statuts ne s'écrivent PAS ici en direct (hors annulation d'une
// livraison non partie) : un trigger les refuse, les RPC seules les font
// avancer.
//
// CE FICHIER EST IMPORTÉ PAR :
//   - hooks/data/useCommandes.ts → seul consommateur

import type { SupabaseClient } from "@supabase/supabase-js"
import { supabase } from "@/integrations/supabase/client"
import { ReferentialConflictError } from "@/features/stock"
import type { CartonRef } from "@/features/commandes/utils/commandeCode"
import type {
    AvancementLigne,
    Boutique,
    Carton,
    CartonEtat,
    CartonInput,
    CommandeBoutique,
    CommandeInput,
    CommandeLigne,
    CommandeLigneInput,
    LivraisonBoutique,
    LivraisonBoutiqueInput,
    Palette,
    ReceptionInput,
} from "@/features/commandes/types/commande.types"

/**
 * Client non typé : les tables de commande ne sont pas encore dans
 * `integrations/supabase/types.ts`. Même contournement que `supabasePacking`,
 * à retirer après application de `20261001110000_stock_commandes.sql` et
 * régénération des types.
 */
const supabaseCommande = supabase as unknown as SupabaseClient

const T = {
    boutiques: "boutiques",
    commandes: "commandes_boutique",
    lignes: "commande_lignes",
    livraisons: "livraisons_boutique",
    palettes: "palettes",
    cartons: "cartons",
    vCommandes: "v_commandes_boutique",
    vAvancement: "v_commande_avancement",
    vLivraisons: "v_livraisons_boutique",
    vCartons: "v_cartons",
} as const

const RLS_REFUSAL = "Action refusée : vous n'avez pas la permission nécessaire, ou l'élément n'est plus modifiable."

/**
 * La base rend les `numeric` (kilos, totaux des vues) en chaîne :
 * conversion unique ici, pour que l'écran ne calcule jamais sur du texte.
 */
function numbers<R>(row: Record<string, unknown>, keys: readonly string[]): R {
    const out: Record<string, unknown> = { ...row }
    for (const key of keys) {
        const value = out[key]
        if (value !== null && value !== undefined) out[key] = Number(value)
    }
    return out as R
}

const N_COMMANDE = ["kg_demande", "kg_prepare", "kg_expedie", "kg_recu", "kg_reste", "nb_lignes", "nb_livraisons"] as const
const N_AVANCEMENT = ["kg_demande", "kg_prepare", "kg_expedie", "kg_recu", "kg_manquant", "kg_reste"] as const
const N_LIVRAISON = ["nb_palettes", "nb_cartons", "nb_recus", "nb_ecarts", "kg_prevu", "kg_recu", "kg_ecart"] as const
const N_CARTON = ["poids_kg_prevu", "poids_kg_recu", "ecart_kg"] as const

async function selectAll<R>(table: string, order: string, keys: readonly string[] = [], ascending = true): Promise<R[]> {
    const { data, error } = await supabaseCommande.from(table).select("*").order(order, { ascending })
    if (error) throw error
    return (data ?? []).map((row) => numbers<R>(row, keys))
}

async function insertOne<R>(table: string, payload: object): Promise<R> {
    const { data, error } = await supabaseCommande.from(table).insert(payload).select("*").single()
    if (error) throw error
    return data as R
}

/** UPDATE contrôlé : zéro ligne = refus de la RLS, qui ne lève rien d'elle-même. */
async function updateOne<R>(table: string, id: string, payload: object): Promise<R> {
    const { data, error } = await supabaseCommande.from(table).update(payload).eq("id", id).select("*")
    if (error) throw error
    if (!data?.length) throw new ReferentialConflictError(RLS_REFUSAL)
    return data[0] as R
}

async function deleteOne(table: string, id: string): Promise<void> {
    const { data, error } = await supabaseCommande.from(table).delete().eq("id", id).select("id")
    if (error) throw error
    if (!data?.length) throw new ReferentialConflictError(RLS_REFUSAL)
}

// ─── Boutiques ───────────────────────────────────────────────────────────────

export const fetchBoutiques = () => selectAll<Boutique>(T.boutiques, "nom")

export type BoutiquePayload = Pick<Boutique, "nom" | "code" | "adresse" | "actif">

export const insertBoutique = (p: BoutiquePayload) => insertOne<Boutique>(T.boutiques, p)
export const updateBoutique = (id: string, p: Partial<BoutiquePayload>) => updateOne<Boutique>(T.boutiques, id, p)
export const deleteBoutique = (id: string) => deleteOne(T.boutiques, id)

// ─── Commandes ───────────────────────────────────────────────────────────────

export const fetchCommandes = () =>
    selectAll<CommandeBoutique>(T.vCommandes, "numero", N_COMMANDE, false)

export async function fetchAvancement(commandeId: string): Promise<AvancementLigne[]> {
    const { data, error } = await supabaseCommande
        .from(T.vAvancement)
        .select("*")
        .eq("commande_id", commandeId)
        .order("category_nom")
    if (error) throw error
    return (data ?? []).map((row) => numbers<AvancementLigne>(row, N_AVANCEMENT))
}

/**
 * Lignes de plusieurs commandes d'un coup (historique d'une boutique, pour
 * les suggestions du formulaire). Peu d'identifiants à la fois : un `.in()`
 * d'UUID trop long est refusé par la passerelle (voir `triService`).
 */
export async function fetchLignesDeCommandes(commandeIds: readonly string[]): Promise<AvancementLigne[]> {
    if (commandeIds.length === 0) return []
    const { data, error } = await supabaseCommande
        .from(T.vAvancement)
        .select("*")
        .in("commande_id", commandeIds.slice(0, 50))
    if (error) throw error
    return (data ?? []).map((row) => numbers<AvancementLigne>(row, N_AVANCEMENT))
}

/**
 * Crée la commande puis ses lignes. Deux écritures : si les lignes échouent,
 * l'en-tête est retiré pour ne pas laisser une commande vide.
 */
export async function insertCommande(input: CommandeInput, lignes: CommandeLigneInput[]): Promise<string> {
    const commande = await insertOne<{ id: string }>(T.commandes, input)
    if (lignes.length === 0) return commande.id
    const { error } = await supabaseCommande
        .from(T.lignes)
        .insert(lignes.map((l) => ({ ...l, commande_id: commande.id })))
    if (error) {
        await supabaseCommande.from(T.commandes).delete().eq("id", commande.id)
        throw error
    }
    return commande.id
}

export const updateCommande = (id: string, p: Partial<CommandeInput>) => updateOne(T.commandes, id, p)

/**
 * Remplace les lignes d'une commande : met à jour les catégories conservées,
 * ajoute les nouvelles, retire les absentes. L'unicité (commande, catégorie)
 * permet l'upsert.
 */
export async function replaceCommandeLignes(commandeId: string, lignes: CommandeLigneInput[]): Promise<void> {
    const { data: existing, error: readError } = await supabaseCommande
        .from(T.lignes)
        .select("id, category_id")
        .eq("commande_id", commandeId)
    if (readError) throw readError

    if (lignes.length > 0) {
        const { error } = await supabaseCommande
            .from(T.lignes)
            .upsert(lignes.map((l) => ({ ...l, commande_id: commandeId })), { onConflict: "commande_id,category_id" })
        if (error) throw error
    }
    const kept = new Set(lignes.map((l) => l.category_id))
    const removed = ((existing ?? []) as Pick<CommandeLigne, "id" | "category_id">[])
        .filter((l) => !kept.has(l.category_id))
        .map((l) => l.id)
    if (removed.length > 0) {
        const { error } = await supabaseCommande.from(T.lignes).delete().in("id", removed)
        if (error) throw error
    }
}

export async function annulerCommande(id: string): Promise<void> {
    await updateOne(T.commandes, id, { statut: "annulee" })
}

export async function cloturerCommande(id: string, motif: string): Promise<void> {
    const { error } = await supabaseCommande.rpc("cloturer_commande", { p_id: id, p_motif: motif })
    if (error) throw error
}

// ─── Livraisons ──────────────────────────────────────────────────────────────

export const fetchLivraisons = () =>
    selectAll<LivraisonBoutique>(T.vLivraisons, "numero", N_LIVRAISON, false)

export async function insertLivraison(input: LivraisonBoutiqueInput): Promise<string> {
    return (await insertOne<{ id: string }>(T.livraisons, input)).id
}

export const updateLivraison = (id: string, p: Partial<Omit<LivraisonBoutiqueInput, "boutique_id">>) =>
    updateOne(T.livraisons, id, p)

/** Annulation : seul changement de statut direct admis, et seulement avant le départ. */
export const annulerLivraison = (id: string) => updateOne(T.livraisons, id, { statut: "annulee" })
export const deleteLivraison = (id: string) => deleteOne(T.livraisons, id)

export async function expedierLivraison(id: string): Promise<void> {
    const { error } = await supabaseCommande.rpc("expedier_livraison", { p_id: id })
    if (error) throw error
}

/** Déclare manquants les cartons jamais scannés et clôt la réception. */
export async function cloturerLivraison(id: string): Promise<void> {
    const { error } = await supabaseCommande.rpc("cloturer_livraison", { p_id: id })
    if (error) throw error
}

// ─── Palettes et cartons ─────────────────────────────────────────────────────

export async function fetchPalettes(livraisonId: string): Promise<Palette[]> {
    const { data, error } = await supabaseCommande
        .from(T.palettes)
        .select("*")
        .eq("livraison_id", livraisonId)
        .order("numero")
    if (error) throw error
    return (data ?? []) as Palette[]
}

/** Le numéro est attribué par la base (trigger) : 1, 2, 3… par livraison. */
export const insertPalette = (livraisonId: string) => insertOne<Palette>(T.palettes, { livraison_id: livraisonId })
export const deletePalette = (id: string) => deleteOne(T.palettes, id)

export async function fetchCartons(livraisonId: string): Promise<Carton[]> {
    const { data, error } = await supabaseCommande
        .from(T.vCartons)
        .select("*")
        .eq("livraison_id", livraisonId)
        .order("numero")
    if (error) throw error
    return (data ?? []).map((row) => numbers<Carton>(row, N_CARTON))
}

/**
 * Plusieurs cartons d'un coup (« + 3 cartons identiques »). Insérés UN PAR
 * UN : leur numéro vient d'un trigger qui lit le maximum courant, un INSERT
 * multiple les numéroterait tous pareil.
 */
export async function insertCartons(cartons: CartonInput[]): Promise<void> {
    for (const carton of cartons) {
        const { error } = await supabaseCommande.from(T.cartons).insert(carton)
        if (error) throw error
    }
}

export const updateCarton = (id: string, p: Partial<Omit<CartonInput, "livraison_id">>) => updateOne(T.cartons, id, p)
export const deleteCarton = (id: string) => deleteOne(T.cartons, id)

/** Carton désigné par un code lu (« LIV-0042-C07 »), ou `null`. */
export async function findCartonByCode(ref: CartonRef): Promise<Carton | null> {
    const { data, error } = await supabaseCommande
        .from(T.vCartons)
        .select("*")
        .eq("livraison_numero", ref.livraisonNumero)
        .eq("numero", ref.cartonNumero)
        .maybeSingle()
    if (error) throw error
    return data ? numbers<Carton>(data, N_CARTON) : null
}

/** Réceptionne un carton ; renvoie le verdict retenu par la base. */
export async function receptionnerCarton(cartonId: string, input: ReceptionInput): Promise<CartonEtat> {
    const { data, error } = await supabaseCommande.rpc("receptionner_carton", {
        p_carton_id: cartonId,
        p_poids_recu: input.poidsRecu,
        p_endommage: input.endommage,
        p_mauvaise_categorie: input.mauvaiseCategorie,
        p_note: input.note,
    })
    if (error) throw error
    return data as CartonEtat
}

// ─── Realtime ────────────────────────────────────────────────────────────────

/**
 * Un canal pour toute la page. La boutique scanne pendant que l'entrepôt
 * supervise : tout événement relance les lectures, les vues recalculant
 * totaux et avancement.
 */
export function subscribeCommandes(onChange: () => void): () => void {
    const channel = supabase.channel(`stock_commandes_${crypto.randomUUID()}`)
    for (const table of [T.commandes, T.lignes, T.livraisons, T.palettes, T.cartons, T.boutiques]) {
        channel.on("postgres_changes", { event: "*", schema: "public", table }, onChange)
    }
    channel.subscribe()
    return () => {
        void supabase.removeChannel(channel)
    }
}
