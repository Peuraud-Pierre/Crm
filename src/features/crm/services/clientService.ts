import { supabase } from "@/integrations/supabase/client"
import type { Database } from "@/integrations/supabase/types"

export type ClientCrmRow = Database["public"]["Tables"]["client_crm"]["Row"]
export type ClientCrmUpdate =
    Database["public"]["Tables"]["client_crm"]["Update"]

// Select complet (fiche client, realtime update, post-write refresh).
export const CLIENT_SELECT_WITH_RELATIONS =
    "*, customer(id, user_id, full_name), closers(id, user_id, full_name)"

// Select minimal pour la liste board/table : on ne projette que les colonnes
// affichées en card/ligne ou consommées par les filtres. Pas d'adresses,
// commandes, message, depense, insta, telephone_2, mail_2 — ces champs sont
// chargés à la volée par fetchOneClient quand l'utilisateur ouvre la fiche.
// numero_TVA et siret sont inclus pour l'auto-remplissage dans la création de bons.
const LIST_SELECT_BASE =
    "id, nom, societe, telephone, mail, collum, created_at, updated_at, prise_en_charge, brief, numero_TVA, siret"
const LIST_SELECT_RELATIONS =
    "customer(id, user_id, full_name), closers(id, user_id, full_name)"

export const CLIENT_LIST_SELECT = `${LIST_SELECT_BASE}, urgency, ${LIST_SELECT_RELATIONS}`
const CLIENT_LIST_SELECT_NO_URGENCY = `${LIST_SELECT_BASE}, ${LIST_SELECT_RELATIONS}`

/**
 * `urgency` est ajoutée par la migration 008 (cypher_go/migrations). Tant
 * qu'elle n'est pas appliquée sur un environnement, PostgREST rejette la
 * requête entière (42703) et le board se retrouve vide — le déploiement du
 * front et celui de la base ne sont pas simultanés.
 *
 * Au premier refus, on bascule le select pour le reste de la session : rejouer
 * systématiquement deux requêtes coûterait un aller-retour par page de scroll.
 * Ce repli peut disparaître une fois la migration passée sur tous les
 * environnements — avec lui, `CLIENT_LIST_SELECT_NO_URGENCY` et le wrapper.
 */
let listSelect = CLIENT_LIST_SELECT

async function withUrgencyFallback<R extends { error: { code: string } | null }>(
    run: (select: string) => PromiseLike<R>
): Promise<R> {
    const res = await run(listSelect)
    if (res.error?.code !== "42703" || listSelect === CLIENT_LIST_SELECT_NO_URGENCY) {
        return res
    }
    listSelect = CLIENT_LIST_SELECT_NO_URGENCY
    return run(listSelect)
}

/** Récupère UNE ligne client complète (avec relations jointes). */
export function fetchOneClientRow(clientId: string) {
    return supabase
        .from("client_crm")
        .select(CLIENT_SELECT_WITH_RELATIONS)
        .eq("id", clientId)
        .single()
}

/** Filtre PostgREST `.or(...)` de recherche texte : nom, téléphone, mail, société. */
export function clientSearchFilter(term: string): string {
    const s = term.trim()
    return `nom.ilike.%${s}%,telephone.ilike.%${s}%,mail.ilike.%${s}%,societe.ilike.%${s}%`
}

/**
 * Page de la liste clients (select léger + range côté DB), triée par
 * updated_at desc. Les filtres `.or(...)` (ownership, recherche) sont
 * construits par le hook appelant et passés en chaînes PostgREST opaques.
 * count:'exact' coûte un scan COUNT complet — ne le demander que sur la
 * page reset (voir use_client.tsx).
 */
export function fetchClientListPage(options: {
    withCount: boolean
    offset: number
    limit: number
    orFilters: string[]
}) {
    return withUrgencyFallback((select) => {
        let query = supabase
            .from("client_crm")
            .select(select, options.withCount ? { count: "exact" } : undefined)
            .order("updated_at", { ascending: false })
            .range(options.offset, options.offset + options.limit - 1)

        for (const orFilter of options.orFilters) {
            query = query.or(orFilter)
        }

        return query
    })
}

/**
 * Page suivante d'une colonne Kanban : curseur updated_at (clients plus
 * anciens que `olderThan`), filtre ownership optionnel (chaîne PostgREST).
 */
export function fetchClientColumnPage(options: {
    colIndex: number
    limit: number
    olderThan?: string
    orFilter?: string
}) {
    return withUrgencyFallback((select) => {
        let query = supabase
            .from("client_crm")
            .select(select)
            .eq("collum", options.colIndex)
            .order("updated_at", { ascending: false })
            .limit(options.limit)

        if (options.olderThan) {
            query = query.lt("updated_at", options.olderThan)
        }
        if (options.orFilter) {
            query = query.or(options.orFilter)
        }

        return query
    })
}

/**
 * Briefs des leads entrants (clients créés dans [start, end[), pour le
 * classement des produits recherchés. Même périmètre que le RPC
 * count_clients_filtered (KPI « Leads ») : bornes sur created_at et, si un
 * commercial est choisi, ses clients (customer/closers) + le pool partagé
 * (customer IS NULL). Paginé : PostgREST plafonne à 1 000 lignes par requête.
 */
export async function fetchClientBriefsCreatedBetween(
    start: string,
    end: string,
    userId: string | null
): Promise<{ id: string; brief: ClientCrmRow["brief"] }[]> {
    const PAGE = 1000
    const rows: { id: string; brief: ClientCrmRow["brief"] }[] = []
    for (let from = 0; ; from += PAGE) {
        let query = supabase
            .from("client_crm")
            .select("id, brief")
            .gte("created_at", start)
            .lt("created_at", end)
        if (userId) {
            query = query.or(
                `customer.eq.${userId},closers.eq.${userId},customer.is.null`
            )
        }
        const { data, error } = await query
            .order("id", { ascending: true })
            .range(from, from + PAGE - 1)
        if (error) throw error
        rows.push(...(data ?? []))
        if (!data || data.length < PAGE) break
    }
    return rows
}

/**
 * Tous les clients, réduits aux champs lus par l'Analytics : période
 * (created_at), commercial (customer/closers), colonne (repli du tunnel) et
 * brief (provenance). Pages de 1000 (plafond PostgREST), même modèle que
 * fetchClientBriefsCreatedBetween.
 */
export async function fetchClientsForAnalytics() {
    const PAGE = 1000
    const rows: Pick<
        ClientCrmRow,
        "id" | "created_at" | "collum" | "customer" | "closers" | "brief"
    >[] = []
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
            .from("client_crm")
            .select("id, created_at, collum, customer, closers, brief")
            .order("id", { ascending: true })
            .range(from, from + PAGE - 1)
        if (error) throw error
        rows.push(...(data ?? []))
        if (!data || data.length < PAGE) break
    }
    return rows
}

/**
 * Toute la table client_crm (colonnes complètes + gestionnaire/closer joints)
 * pour l'export Excel. Paginé par 1000 : PostgREST plafonne une réponse à
 * 1000 lignes. Le périmètre reste celui des RLS de l'utilisateur connecté.
 */
export async function fetchAllClientsForExport() {
    const PAGE = 1000
    const rows: ClientExportRow[] = []
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
            .from("client_crm")
            .select(CLIENT_SELECT_WITH_RELATIONS)
            .order("id", { ascending: true })
            .range(from, from + PAGE - 1)
        if (error) throw error
        rows.push(...((data ?? []) as ClientExportRow[]))
        if (!data || data.length < PAGE) break
    }
    return rows
}

type ProfileRef = { id: string; user_id: string; full_name: string | null }
export type ClientExportRow = Omit<ClientCrmRow, "customer" | "closers"> & {
    customer: ProfileRef | null
    closers: ProfileRef | null
}

/** Met à jour une fiche client. */
export function updateClientRow(id: string, payload: ClientCrmUpdate) {
    return supabase.from("client_crm").update(payload).eq("id", id)
}

/**
 * Bascule l'opt-in newsletter d'un client et horodate le consentement.
 * `newsletter` / `newsletter_updated_at` (migration 20261014120000) ne sont
 * pas encore dans les types générés : cast ponctuel. Une RLS qui bloque
 * l'UPDATE ne renvoie pas d'erreur, juste 0 ligne — traité comme un échec
 * (même garde-fou que updateSubscriberCrmStat).
 */
export async function updateClientNewsletter(
    id: string,
    value: boolean
): Promise<string> {
    const now = new Date().toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from("client_crm")
        .update({ newsletter: value, newsletter_updated_at: now })
        .eq("id", id)
        .select("id, newsletter_updated_at")
    if (error) throw new Error("Erreur lors de la mise à jour de l'abonnement.")
    if (!data || data.length === 0)
        throw new Error(
            "Mise à jour refusée (droits insuffisants ou client introuvable)."
        )
    return (data[0].newsletter_updated_at as string | null) ?? now
}

/** Crée une fiche client et retourne la ligne avec relations jointes. */
export function insertClientRow(
    payload: Database["public"]["Tables"]["client_crm"]["Insert"]
) {
    return supabase
        .from("client_crm")
        .insert([payload])
        .select(CLIENT_SELECT_WITH_RELATIONS)
        .single()
}

/**
 * Suppression RGPD : anonymise les devis (données comptables conservées,
 * lien client supprimé), supprime les données liées puis la fiche.
 * Lève une erreur au premier échec (rollback UI côté hook).
 */
export async function deleteClientCascade(id: string): Promise<void> {
    const { error: devisError } = await supabase
        .from("Devis")
        .update({ client: null })
        .eq("client", id)
    if (devisError) throw devisError

    const deletions = [
        supabase.from("Client_activite").delete().eq("client", id),
        supabase.from("Tache_crm").delete().eq("client", id),
        supabase.from("activity_log").delete().eq("entity_id", id),
        supabase.from("Event_calendar").delete().eq("id_client", id),
    ]
    const results = await Promise.all(deletions)
    for (const { error } of results) {
        if (error) throw error
    }

    const { error: clientError } = await supabase
        .from("client_crm")
        .delete()
        .eq("id", id)
    if (clientError) throw clientError
}

/** Références customer/closers de toutes les fiches (pour le filtre "users actifs"). */
export function fetchActiveOwnerRefs() {
    return supabase.from("client_crm").select("customer, closers")
}

/** Cherche la fiche client dont l'email ou le téléphone correspond (utilisé pour relier un lead à son client CRM). */
export function findClientByContact(email: string, phone: string | null) {
    const orFilters = [`mail.eq.${email}`, `mail_2.eq.${email}`]
    if (phone) {
        orFilters.push(`telephone.eq.${phone}`, `telephone_2.eq.${phone}`)
    }

    return supabase
        .from("client_crm")
        .select("id")
        .or(orFilters.join(","))
        .limit(1)
        .maybeSingle()
}

/** Profils (id, user_id, full_name) pour une liste de user_id. */
export function fetchProfilesByUserIds(userIds: string[]) {
    return supabase
        .from("profiles")
        .select("id, user_id, full_name")
        .in("user_id", userIds)
}
