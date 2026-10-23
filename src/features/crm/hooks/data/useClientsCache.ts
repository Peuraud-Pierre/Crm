import { useCallback, useRef, useSyncExternalStore } from "react"
import {
    infiniteQueryOptions,
    useQuery,
    useQueryClient,
    type InfiniteData,
    type QueryClient,
    type QueryKey,
} from "@tanstack/react-query"
import * as clientService from "@/features/crm/services/clientService"
import { capitalizeName } from "@/features/crm/utils/capitalizeName"
import { SHARED_COLUMNS, UNASSIGNED_POOL_COLUMN } from "@/shared/utils/CrmTab"
import type { Client, Owner } from "@/features/crm/types"

/**
 * Cache TanStack des listes de clients du CRM.
 *
 * Toutes les listes vivent sous `CLIENTS_KEY` :
 *   [..., "column", scope, col]  Kanban, une liste infinie par colonne
 *   [..., "table", scope]        vue tableau, liste infinie
 *   [..., "search", scope, term] recherche de l'onglet Clients
 *   [..., "picker", term, limit] sélecteurs (devis, RDV, tâches)
 *   [..., "one", id]             un client chargé par id
 *
 * `scope` = commercial dont on affiche les leads, null = tous.
 * L'union de ces entrées remplace l'ancien `clients[]` partagé
 * (useCachedClients) ; le realtime et les mutations les tiennent à jour via
 * upsertClientInCaches / removeClientFromCaches.
 */
export const CLIENTS_KEY = ["crm", "clients"] as const
export type ClientScope = string | null

export const columnKey = (scope: ClientScope, col: number) =>
    [...CLIENTS_KEY, "column", scope, col] as const
export const tableKey = (scope: ClientScope) =>
    [...CLIENTS_KEY, "table", scope] as const
export const searchKey = (scope: ClientScope, term: string) =>
    [...CLIENTS_KEY, "search", scope, term] as const

const COLUMN_PAGE = 50
const TABLE_PAGE = 100
const SEARCH_LIMIT = 500

type ClientRow = Record<string, unknown> & {
    nom?: string | null
    brief?: unknown
    customer?: Owner | string | null
    closers?: Owner | string | null
}

/** Ligne client_crm (jointures customer/closers) → Client de l'UI. */
export function parseClientRow(row: ClientRow): Client {
    return {
        ...row,
        nom: row.nom ? capitalizeName(row.nom) : row.nom,
        brief: typeof row.brief === "string" ? JSON.parse(row.brief) : row.brief,
        customer:
            row.customer && typeof row.customer === "object" ? row.customer : null,
        closers:
            row.closers && typeof row.closers === "object" ? row.closers : null,
    } as unknown as Client
}

/**
 * Version entrante pas plus ancienne que l'existante (updated_at ISO 8601,
 * comparaison lexicographique) : protège des snapshots qui arrivent dans le
 * désordre (realtime lent, fetchOneClient concurrents).
 */
export function isNotOlder(incoming?: string | null, existing?: string | null) {
    if (!existing) return true
    if (!incoming) return false
    return incoming >= existing
}

/** user_id d'un owner, qu'il soit joint ({user_id}) ou brut (UUID). */
const ownerId = (o: unknown): string | null =>
    typeof o === "string"
        ? o
        : o && typeof o === "object"
          ? ((o as { user_id?: string }).user_id ?? null)
          : null

/**
 * Un client fait-il partie des leads de `scope` ? Mes leads (customer ou
 * closer), les non-assignés du pool d'entrée « Nouveau lead », et les
 * colonnes partagées. Même règle que les filtres SQL ci-dessous.
 */
export function belongsToScope(
    client: { customer?: unknown; closers?: unknown; collum?: number | null },
    scope: ClientScope
): boolean {
    if (!scope) return true
    const col = client.collum ?? 0
    if (SHARED_COLUMNS.includes(col)) return true
    if (ownerId(client.customer) === scope || ownerId(client.closers) === scope)
        return true
    return client.customer == null && col === UNASSIGNED_POOL_COLUMN
}

/** Filtre PostgREST du périmètre, toutes colonnes confondues. */
function scopeFilter(scope: ClientScope): string[] {
    if (!scope) return []
    return [
        `customer.eq.${scope},closers.eq.${scope},and(customer.is.null,collum.eq.${UNASSIGNED_POOL_COLUMN}),collum.in.(${SHARED_COLUMNS.join(",")})`,
    ]
}

/** Filtre PostgREST du périmètre pour une seule colonne. */
function columnScopeFilter(scope: ClientScope, col: number) {
    if (!scope || SHARED_COLUMNS.includes(col)) return undefined
    return col === UNASSIGNED_POOL_COLUMN
        ? `customer.eq.${scope},closers.eq.${scope},customer.is.null`
        : `customer.eq.${scope},closers.eq.${scope}`
}

const parseRows = (data: unknown) =>
    ((data ?? []) as ClientRow[]).map(parseClientRow)

/**
 * Colonne Kanban : pages par curseur updated_at (clients plus anciens que le
 * plus ancien déjà chargé), triées updated_at DESC comme groupAndSortBoard.
 */
export const columnQueryOptions = (scope: ClientScope, col: number) =>
    infiniteQueryOptions({
        queryKey: columnKey(scope, col),
        queryFn: async ({ pageParam }) => {
            const { data, error } = await clientService.fetchClientColumnPage({
                colIndex: col,
                limit: COLUMN_PAGE,
                olderThan: pageParam,
                orFilter: columnScopeFilter(scope, col),
            })
            if (error) throw error
            return parseRows(data)
        },
        initialPageParam: undefined as string | undefined,
        // Fin = page vide, et non « page incomplète » : retirer une carte en
        // local (déplacement) raccourcit la dernière page sans que la colonne
        // soit épuisée. Coût : une requête vide en bout de colonne.
        getNextPageParam: (last) =>
            last.length === 0
                ? undefined
                : (last[last.length - 1]?.updated_at ?? undefined),
    })

/** Vue tableau : pages par offset, tous les leads du périmètre. */
export const tableQueryOptions = (scope: ClientScope) =>
    infiniteQueryOptions({
        queryKey: tableKey(scope),
        queryFn: async ({ pageParam }) => {
            const { data, error } = await clientService.fetchClientListPage({
                withCount: false,
                offset: pageParam,
                limit: TABLE_PAGE,
                orFilters: scopeFilter(scope),
            })
            if (error) throw error
            return parseRows(data)
        },
        initialPageParam: 0,
        // Offset approché (les modifs locales le décalent) : l'affichage
        // dédoublonne par id (dedupeClients). Fin = page vide, cf. colonnes.
        getNextPageParam: (last, all) =>
            last.length === 0 ? undefined : all.flat().length,
    })

/** Recherche de l'onglet Clients, sur toute la table, dans le périmètre. */
export async function fetchClientSearch(scope: ClientScope, term: string) {
    const { data, error } = await clientService.fetchClientListPage({
        withCount: false,
        offset: 0,
        limit: SEARCH_LIMIT,
        orFilters: [...scopeFilter(scope), clientService.clientSearchFilter(term)],
    })
    if (error) throw error
    return parseRows(data)
}

/**
 * Charge le client `id` dans le stock commun (entrée [..., "one", id]) : les
 * écrans qui le cherchent dans `clients` (devis…) le trouvent même s'il n'est
 * dans aucune liste chargée. Ne renvoie rien : lire `clients`.
 */
export function useClientById(id: string | null | undefined) {
    useQuery({
        queryKey: [...CLIENTS_KEY, "one", id],
        queryFn: async () => {
            const { data, error } = await clientService.fetchOneClientRow(id as string)
            if (error) throw error
            return data ? [parseClientRow(data as unknown as ClientRow)] : []
        },
        enabled: !!id,
    })
}

// ─── Lecture de l'union ─────────────────────────────────────────────────────

/** Dédoublonne par id en gardant le premier rencontré. */
export function dedupeClients(list: Client[]): Client[] {
    const seen = new Set<string>()
    return list.filter((c) => !c.id || (seen.has(c.id) ? false : (seen.add(c.id), true)))
}

type ClientsData = Client[] | InfiniteData<Client[]> | undefined

const flatten = (data: ClientsData): Client[] =>
    !data ? [] : Array.isArray(data) ? data : data.pages.flat()

function unionOf(datas: ClientsData[]): Client[] {
    const byId = new Map<string, Client>()
    for (const data of datas) {
        for (const c of flatten(data)) {
            if (!c.id) continue
            const known = byId.get(c.id)
            if (!known || isNotOlder(c.updated_at, known.updated_at))
                byId.set(c.id, c)
        }
    }
    return Array.from(byId.values())
}

/**
 * Clients présents dans le cache sous `prefix`, dédupliqués par id (version la
 * plus récente). Se met à jour à chaque modification du cache ; la référence
 * ne change que si l'une des entrées a changé.
 */
export function useCachedClients(prefix: QueryKey = CLIENTS_KEY): Client[] {
    const queryClient = useQueryClient()
    const prefixHash = JSON.stringify(prefix)
    const memoRef = useRef<{ hash: string; datas: ClientsData[]; union: Client[] }>(
        { hash: "", datas: [], union: [] }
    )

    const getSnapshot = useCallback(() => {
        const datas = queryClient
            .getQueriesData<ClientsData>({ queryKey: prefix })
            .map(([, data]) => data)
        const prev = memoRef.current
        if (
            prev.hash === prefixHash &&
            prev.datas.length === datas.length &&
            prev.datas.every((d, i) => d === datas[i])
        )
            return prev.union
        memoRef.current = { hash: prefixHash, datas, union: unionOf(datas) }
        return memoRef.current.union
        // prefixHash couvre `prefix` (tableau recréé à chaque rendu).
    }, [queryClient, prefixHash])

    const subscribe = useCallback(
        (onChange: () => void) => queryClient.getQueryCache().subscribe(onChange),
        [queryClient]
    )
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/** Le client `id` tel qu'en cache (version la plus récente), sinon undefined. */
export function findClientInCaches(queryClient: QueryClient, id: string) {
    const datas = queryClient
        .getQueriesData<ClientsData>({ queryKey: CLIENTS_KEY })
        .map(([, data]) => data)
    return unionOf(datas).find((c) => c.id === id)
}

/** Périmètres des listes Kanban/tableau actuellement en cache. */
export function cachedScopes(queryClient: QueryClient): ClientScope[] {
    const scopes = new Set<ClientScope>()
    for (const query of queryClient.getQueryCache().findAll({ queryKey: CLIENTS_KEY })) {
        const [, , kind, scope] = query.queryKey as unknown[]
        if (kind === "column" || kind === "table") scopes.add(scope as ClientScope)
    }
    return Array.from(scopes)
}

// ─── Écritures ──────────────────────────────────────────────────────────────

function mapEntry(
    data: ClientsData,
    fn: (list: Client[], pageIndex: number) => Client[]
): ClientsData {
    if (!data) return data
    if (Array.isArray(data)) return fn(data, 0)
    return { ...data, pages: data.pages.map((page, i) => fn(page, i)) }
}

/**
 * Applique la version `client` à toutes les listes en cache :
 * - remplace l'existante si elle n'est pas plus récente (fusion monotone) ;
 * - colonnes Kanban : retire le client des autres colonnes et l'ajoute à celle
 *   de son `collum` si son périmètre l'inclut (déplacement de carte) ;
 * - tableau : l'ajoute ou le retire selon son périmètre ;
 * - recherches / sélecteurs : mise à jour sur place uniquement.
 */
export function upsertClientInCaches(queryClient: QueryClient, client: Client) {
    const id = client.id
    if (!id) return
    for (const query of queryClient.getQueryCache().findAll({ queryKey: CLIENTS_KEY })) {
        const data = query.state.data as ClientsData
        if (!data) continue
        const [, , kind, scope, col] = query.queryKey as unknown[]
        const existing = flatten(data).find((c) => c.id === id)
        if (existing && !isNotOlder(client.updated_at, existing.updated_at)) continue

        let wanted: boolean
        if (kind === "column")
            wanted =
                (client.collum ?? 0) === col &&
                belongsToScope(client, scope as ClientScope)
        else if (kind === "table") wanted = belongsToScope(client, scope as ClientScope)
        else wanted = !!existing

        if (!existing && !wanted) continue
        const next = mapEntry(data, (list, pageIndex) => {
            if (existing) {
                return wanted
                    ? list.map((c) => (c.id === id ? client : c))
                    : list.filter((c) => c.id !== id)
            }
            // Nouveau venu : en tête de la première page (l'affichage retrie).
            return pageIndex === 0 ? [client, ...list] : list
        })
        queryClient.setQueryData(query.queryKey, next)
    }
}

/** Retire le client `id` de toutes les listes en cache. */
export function removeClientFromCaches(queryClient: QueryClient, id: string) {
    for (const query of queryClient.getQueryCache().findAll({ queryKey: CLIENTS_KEY })) {
        const data = query.state.data as ClientsData
        if (!data || !flatten(data).some((c) => c.id === id)) continue
        queryClient.setQueryData(
            query.queryKey,
            mapEntry(data, (list) => list.filter((c) => c.id !== id))
        )
    }
}
