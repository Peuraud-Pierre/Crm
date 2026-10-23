import { useAuth } from "@/features/auth/hooks/useAuth"
import type { Database } from "@/integrations/supabase/types"
import * as clientService from "@/features/crm/services/clientService"
import { getClientColumnCounts } from "@/features/crm/services/statsService"
import { subscribeToTable } from "@/features/crm/services/realtimeService"
import { useCallback, useEffect, useRef, useState } from "react"
import {
    useInfiniteQuery,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query"
import {
    CLIENTS_KEY,
    belongsToScope,
    cachedScopes,
    findClientInCaches,
    parseClientRow,
    removeClientFromCaches,
    tableQueryOptions,
    upsertClientInCaches,
    useCachedClients,
} from "@/features/crm/hooks/data/useClientsCache"

// --- Types importés depuis le fichier de types partagés ---
export type {
    Vente,
    Recherche,
    FicheAppro,
    Search,
    Owner,
    Client,
} from "@/features/crm/types"
import type { Client, Owner, Search } from "@/features/crm/types"

type ClientCrmRow = Database["public"]["Tables"]["client_crm"]["Row"]

// ✅ Correction du Type de Payload pour la DB
type ClientUpdatePayload = Partial<
    Omit<
        Client,
        | "brief"
        | "customer"
        | "closers"
        | "adresse_facturation"
        | "adresse_livraison"
    >
> & {
    brief?: string | null
    customer?: string | null
    closers?: string | null
    updated_at?: string | null
    adresse_facturation?: string | null
    adresse_livraison?: string | null
}

// Commerciaux qui ont au moins un client (sélecteurs, filtres). Demandés par
// une dizaine de composants à chaque ouverture : une seule requête en cache.
const OWNERS_KEY = ["crm", "owners"] as const

async function fetchOwners(): Promise<Search[]> {
    const { data: activeData } = await clientService.fetchActiveOwnerRefs()
    const activeIds = new Set<string>()
    activeData?.forEach((item) => {
        if (item.customer) activeIds.add(item.customer)
        if (item.closers) activeIds.add(item.closers)
    })
    if (activeIds.size === 0) return []

    const { data, error } = await clientService.fetchProfilesByUserIds(
        Array.from(activeIds)
    )
    if (error) throw error
    return (data || []).map((u) => ({
        id: u.id,
        user_id: u.user_id || u.id,
        name: u.full_name || "Utilisateur sans nom",
    }))
}

// Compteurs par colonne Kanban, une entrée par filtre commercial (null = tous).
const countsKey = (userId: string | null) => ["crm", "client-counts", userId]

async function fetchCounts(userId: string | null): Promise<Record<number, number>> {
    const { data, error } = await getClientColumnCounts(userId)
    if (error) throw error
    const map: Record<number, number> = {}
    data?.forEach((row) => {
        map[row.collum] = Number(row.count) || 0
    })
    return map
}

const NO_SEARCH: Search[] = []
const NO_COUNTS: Record<number, number> = {}

export function useClient() {
    const { user } = useAuth()
    const queryClient = useQueryClient()
    // Union des listes clients en cache (Kanban, tableau, recherches,
    // sélecteurs) : le « stock » lu par la fiche, les devis, les tâches…
    const clients = useCachedClients()
    // Première page de « mes clients » dès l'entrée dans le CRM (ce que
    // faisait fetch_client au montage) : les écrans hors onglet Clients y
    // retrouvent les clients récents.
    useInfiniteQuery({
        ...tableQueryOptions(user?.user_id ?? null),
        enabled: !!user?.user_id,
    })
    // Pas de chargement automatique : rempli par fetch_research (fetchQuery),
    // qui ne refait la requête que si le cache est périmé.
    const { data: search = NO_SEARCH } = useQuery({
        queryKey: OWNERS_KEY,
        queryFn: fetchOwners,
        enabled: false,
    })
    // Compteurs par colonne Kanban (source DB via RPC, indépendant de la
    // pagination) : lus dans le cache pour le filtre demandé en dernier.
    const [countsUserId, setCountsUserId] = useState<string | null>(null)
    const { data: clientCountsByColumn = NO_COUNTS } = useQuery({
        queryKey: countsKey(countsUserId),
        queryFn: () => fetchCounts(countsUserId),
        enabled: false,
    })

    // 🔹 Helper : Récupérer un SEUL client complet
    const fetchOneClient = useCallback(async (clientId: string) => {
        const { data, error } = await clientService.fetchOneClientRow(clientId)
        if (error || !data) return null
        return parseClientRow(data as unknown as Parameters<typeof parseClientRow>[0])
    }, [])

    const fetchClientCounts = useCallback(
        async (userId?: string) => {
            const key = userId ?? null
            setCountsUserId(key)
            try {
                // staleTime 0 : les compteurs bougent à chaque déplacement de
                // carte, on recharge toujours. Une réponse tardive d'un autre
                // filtre va dans sa propre clé et n'écrase plus l'affichage.
                return await queryClient.fetchQuery({
                    queryKey: countsKey(key),
                    queryFn: () => fetchCounts(key),
                    staleTime: 0,
                })
            } catch (err) {
                // RPC absente (migration pas appliquée) ou RLS : on ne casse pas
                // l'UI, on laisse les badges fallback sur le compteur mémoire.
                if (process.env.NODE_ENV !== "production") {
                    console.warn(
                        "[CRM] get_client_column_counts indisponible :",
                        err
                    )
                }
                return {}
            }
        },
        [queryClient]
    )

    // 🔹 UPDATE
    const update_fiche_client = useCallback(
        async (changes: Partial<Client> & { id: string }) => {
            if (!changes.id) return

            const { id, ...dataToUpdate } = changes

            // Timestamp unique partagé par l'update optimiste ET le payload DB,
            // pour que la valeur en mémoire == valeur écrite == valeur reçue par
            // le webhook → la garde de version ci-dessous devient fiable.
            const writeTs = new Date().toISOString()

            // Mémoriser la version qu'on écrit nous-mêmes : le handler Realtime
            // ignorera tout écho dont updated_at <= writeTs (immunisé contre la
            // latence, contrairement à une fenêtre temporelle fixe).
            lastWriteVersionRef.current.set(id, writeTs)
            // Garde anti-fuite mémoire uniquement (délai long) : ne sert PAS à
            // réautoriser le realtime.
            setTimeout(() => lastWriteVersionRef.current.delete(id), 30000)

            // 1. Mise à jour optimiste (UI) : la carte change de colonne tout
            // de suite si `collum` bouge (upsert dans les listes en cache).
            const current = findClientInCaches(queryClient, id)
            if (current)
                upsertClientInCaches(queryClient, {
                    ...current,
                    ...dataToUpdate,
                    updated_at: writeTs,
                } as Client)

            // 2. Préparation du Payload DB
            const {
                customer,
                closers,
                brief,
                adresse_facturation,
                adresse_livraison,
                ...rest
            } = dataToUpdate

            const payload: ClientUpdatePayload = {
                ...rest,
                updated_at: writeTs,
            }

            // --- TRANSFORMATIONS POUR SUPABASE ---
            if (adresse_facturation !== undefined) {
                payload.adresse_facturation = Array.isArray(adresse_facturation)
                    ? JSON.stringify(adresse_facturation)
                    : (adresse_facturation as unknown as string | null)
            }

            if (adresse_livraison !== undefined) {
                payload.adresse_livraison = Array.isArray(adresse_livraison)
                    ? JSON.stringify(adresse_livraison)
                    : (adresse_livraison as unknown as string | null)
            }

            // customer/closers peuvent arriver en objet joint {id,user_id,...},
            // en UUID string, ou en null (désassignation). On extrait l'UUID pour
            // la DB ; null doit rester null (et non devenir `undefined`, sinon la
            // désassignation ne serait jamais persistée).
            if (customer !== undefined)
                payload.customer =
                    customer && typeof customer === "object"
                        ? (customer.user_id ?? null)
                        : (customer as string | null)

            if (closers !== undefined)
                payload.closers =
                    closers && typeof closers === "object"
                        ? (closers.user_id ?? null)
                        : (closers as string | null)

            if (brief !== undefined)
                payload.brief =
                    brief && typeof brief !== "string"
                        ? JSON.stringify(brief)
                        : (brief as string | null)

            try {
                const { error } = await clientService.updateClientRow(
                    id,
                    payload as Database["public"]["Tables"]["client_crm"]["Update"]
                )

                if (error) throw error

                // Fusion monotone (dans upsertClientInCaches) : ne pas régresser
                // si un webhook plus récent est arrivé entre .update() et ici.
                const freshData = await fetchOneClient(id)
                if (freshData) upsertClientInCaches(queryClient, freshData)
            } catch (error) {
                console.error("❌ Erreur update client:", error)
                // Retour arrière : la version serveur est plus ancienne que
                // l'optimiste, on retire d'abord pour forcer son retour.
                const oldData = await fetchOneClient(id)
                if (oldData) {
                    removeClientFromCaches(queryClient, id)
                    upsertClientInCaches(queryClient, oldData)
                }
            }
        },
        [fetchOneClient, queryClient]
    )

    // 🔹 CREATE
    const create_fiche_client = useCallback(
        async (client: Client) => {
            try {
                const payload = {
                    customer: user?.user_id,
                    nom: client.nom,
                    societe: client.societe,
                    telephone: client.telephone,
                    telephone_2: client.telephone_2 || null,
                    mail: client.mail,
                    mail_2: client.mail_2 || null,
                    localisation: client.localisation,
                    siret: client.siret,
                    insta: client.insta,
                    collum: client.collum || 0,
                    brief: client.brief ? JSON.stringify(client.brief) : null,
                    numero_TVA: client.numero_TVA || null,
                    adresse_facturation: client.adresse_facturation
                        ? JSON.stringify(client.adresse_facturation)
                        : null,
                }

                const { data, error } = await clientService.insertClientRow(
                    payload
                )

                if (error) throw error
                if (data) {
                    const fresh = await fetchOneClient(data.id)
                    if (fresh) upsertClientInCaches(queryClient, fresh)
                    return fresh
                }
                return null
            } catch (error) {
                console.error("❌ Erreur création:", error)
                return null
            }
        },
        [user?.user_id, fetchOneClient, queryClient]
    )

    // 🔹 DELETE (RGPD)
    const delete_fiche_client = useCallback(
        async (id: string) => {
            removeClientFromCaches(queryClient, id)
            try {
                // Anonymise les devis puis supprime les données liées et la fiche
                // (cascade RGPD déléguée à la couche service).
                await clientService.deleteClientCascade(id)
            } catch (error) {
                console.error("❌ Erreur suppression RGPD:", error)
                void queryClient.invalidateQueries({ queryKey: CLIENTS_KEY })
            }
        },
        [queryClient]
    )

    // 🔹 TAKE LEAD
    const take_lead = useCallback(
        async (id: string) => {
            if (!user?.user_id) return
            await update_fiche_client({
                id,
                customer: user.user_id as unknown as Owner,
            })
        },
        [user?.user_id, update_fiche_client]
    )

    // 🔹 FETCH RESEARCH
    const fetch_research = useCallback(async () => {
        try {
            return await queryClient.fetchQuery({
                queryKey: OWNERS_KEY,
                queryFn: fetchOwners,
            })
        } catch (e) {
            console.error(e)
            return []
        }
    }, [queryClient])

    // 🔹 REALTIME
    // Map id → dernier updated_at qu'on a écrit nous-mêmes via update_fiche_client
    // (qui appelle déjà fetchOneClient après le .update()). Le handler Realtime
    // ignore tout écho dont updated_at <= cette valeur. Versionné (et non basé
    // sur un timer), donc immunisé contre la latence d'une connexion lente.
    const lastWriteVersionRef = useRef<Map<string, string>>(new Map())

    useEffect(() => {
        if (!user?.user_id) return
        const userId = user.user_id

        // Nom de channel unique par utilisateur → pas de conflit multi-onglets
        const unsubscribe = subscribeToTable<ClientCrmRow>(
            `realtime-clients-${userId}`,
            "client_crm",
            undefined,
            async ({ eventType, newRow, oldRow }) => {
                if (eventType === "DELETE") {
                    if (oldRow.id) removeClientFromCaches(queryClient, oldRow.id)
                    return
                }

                if (!newRow.id) return
                const clientId: string = newRow.id

                // Ignorer notre propre écho : si l'updated_at de l'événement
                // n'est pas plus récent que la dernière version qu'on a écrite,
                // c'est notre update (déjà appliqué via fetchOneClient) ou plus
                // ancien → rien à faire, et on évite un fetchOneClient inutile.
                const lastWritten = lastWriteVersionRef.current.get(clientId)
                const eventUpdatedAt = newRow.updated_at
                if (lastWritten && eventUpdatedAt && eventUpdatedAt <= lastWritten) {
                    return
                }

                // Garde N+1 : pas de fetchOneClient (1 SELECT joint) pour un
                // client absent du cache qui n'entre dans aucune liste affichée
                // (périmètre calculé depuis les colonnes brutes, sans round-trip).
                const alreadyLoaded = !!findClientInCaches(queryClient, clientId)
                if (
                    !alreadyLoaded &&
                    !cachedScopes(queryClient).some((scope) =>
                        belongsToScope(newRow, scope)
                    )
                )
                    return

                const fresh = await fetchOneClient(clientId)
                // Range le client dans les bonnes listes (colonne, périmètre),
                // avec fusion monotone contre les réponses dans le désordre.
                if (fresh) upsertClientInCaches(queryClient, fresh)
            }
        )

        return unsubscribe
    }, [user?.user_id, fetchOneClient, queryClient])

    return {
        clients,
        search,
        fetch_research,
        create_fiche_client,
        fetchOneClient,
        fetchClientCounts,
        clientCountsByColumn,
        update_fiche_client,
        delete_fiche_client,
        take_lead,
    }
}
