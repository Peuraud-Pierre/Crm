import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import { subscribeToTable } from "@/features/crm/services/realtimeService"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as tacheService from "@/features/crm/services/tacheService"

// --- Types re-exportés depuis le fichier de types partagés ---
export type {
    ClientType,
    Tache,
    TacheInsert,
} from "@/features/crm/types"
import type { Tache, TacheInsert } from "@/features/crm/types"

type UseTacheReturn = {
    /** MES tâches (owner = utilisateur courant). */
    Tache: Tache[]
    /** Tâches que J'AI créées et assignées à quelqu'un d'autre (creator_id = moi, owner ≠ moi). */
    TacheDelegated: Tache[]
    /**
     * Tâches de TOUT LE MONDE en version LÉGÈRE (id, client, date). Sert aux
     * pastilles de statut du board (buildClientTaskMap), visibles par tous
     * (superviseur / setters / closers). Ne contient PAS le détail des tâches.
     */
    AllTache: Tache[]
    /** Tâches COMPLÈTES du seul client ouvert dans la fiche. */
    clientTaches: Tache[]
    create_Tache: (newTache: Partial<Tache>) => Promise<void>
    fetch_Tache: () => Promise<Tache[] | undefined>
    fetch_Tache_delegated: () => Promise<void>
    update_Tache: (id: string, updates: Partial<Tache>) => Promise<void>
    delete_Tache: (id: string) => Promise<void>
    /** Charge la liste LÉGÈRE de toutes les tâches (board). */
    fetch_Tache_alltask: () => Promise<void>
    /** Charge les tâches complètes d'un client (fiche). */
    fetch_client_taches: (clientId: string) => Promise<void>
}

export function useTache(): UseTacheReturn {
    const { user } = useAuth()
    const [tachesUser, setTachesUser] = useState<Tache[]>([]) // Tâches de l'utilisateur connecté
    const [tachesDelegated, setTachesDelegated] = useState<Tache[]>([]) // Tâches que j'ai assignées à d'autres
    const [allTaches, setAllTaches] = useState<Tache[]>([]) // Toutes les tâches, version légère (board)
    const [clientTaches, setClientTaches] = useState<Tache[]>([]) // Tâches complètes du client ouvert

    // Client dont la fiche est ouverte → garde-fou realtime pour clientTaches.
    const openClientIdRef = useRef<string | null>(null)

    // 🛠️ Helper : Récupérer une tâche unique AVEC ses relations (pour le Realtime)
    const fetchOneTaskWithRelations = useCallback(
        tacheService.fetchOneTaskWithRelations,
        []
    )

    // 🔹 Création
    const create_Tache = useCallback(
        async (newTache: Partial<Tache>) => {
            if (!user?.user_id) return
            if (!newTache.type) {
                console.warn("❌ Type de tâche manquant")
                return
            }

            try {
                // Préparation du payload : on s'assure que client est un UUID string (ou null — non obligatoire).
                const clientId =
                    typeof newTache.client === "object" && newTache.client
                        ? newTache.client.id
                        : newTache.client

                const payload: TacheInsert & {
                    owner: string
                    creator_id: string
                } = {
                    type: newTache.type,
                    content: newTache.content ?? null,
                    date: newTache.date ?? null,
                    valide: newTache.valide ?? null,
                    placement: newTache.placement ?? null,
                    categorie: newTache.categorie ?? null,
                    // Owner explicite (affectation à un autre membre) ou, à
                    // défaut, l'utilisateur courant.
                    owner: newTache.owner || user.user_id,
                    // Créateur = toujours l'utilisateur courant, jamais
                    // réassignable (contrairement à owner).
                    creator_id: user.user_id,
                    client: clientId || null,
                }

                // On demande le retour des données avec le select pour avoir l'ID généré
                // Note: Le select ne renvoie pas le JOIN immédiatement sur un insert complexe parfois,
                // mais c'est suffisant pour l'affichage local rapide.
                const data = await tacheService.createTache(payload)

                // Mise à jour locale seulement si la tâche revient à
                // l'utilisateur courant (sinon elle appartient à un autre
                // membre et ne doit pas apparaître dans sa liste).
                if (payload.owner === user.user_id) {
                    setTachesUser((prev) => [data, ...prev])
                } else {
                    setTachesDelegated((prev) => [data, ...prev])
                }
            } catch (error) {
                console.error("❌ Erreur création tâche:", error)
            }
        },
        [user?.user_id]
    )

    // 🔹 Récupération (User)
    const fetch_Tache: UseTacheReturn["fetch_Tache"] = useCallback(async () => {
        if (!user?.user_id) return undefined
        try {
            const data = await tacheService.fetchTachesByOwner(user.user_id)
            setTachesUser(data)
            return data
        } catch (error) {
            console.error("❌ Erreur fetch tâches user:", error)
            return undefined
        }
    }, [user?.user_id])

    // 🔹 Récupération des tâches que j'ai assignées à d'autres
    const fetch_Tache_delegated = useCallback(async () => {
        if (!user?.user_id) return
        try {
            setTachesDelegated(
                await tacheService.fetchTachesDelegatedBy(user.user_id)
            )
        } catch (error) {
            console.error("❌ Erreur fetch tâches assignées:", error)
        }
    }, [user?.user_id])

    // 🔹 Récupération LÉGÈRE de TOUTES les tâches (board, visibles par tous)
    // UNE seule requête, colonnes minimales (id, client, date) : seul nécessaire
    // à buildClientTaskMap. Le gain mémoire vient du tri des colonnes (vs lignes
    // complètes + relations), pas d'un filtrage par ids (qui produisait soit une
    // URL géante, soit une rafale → 429).
    const fetch_Tache_alltask = useCallback(async () => {
        try {
            setAllTaches(await tacheService.fetchAllTachesLight())
        } catch (error) {
            console.error("❌ Erreur fetch tâches (board):", error)
        }
    }, [])

    // 🔹 Récupération COMPLÈTE des tâches d'un seul client (fiche)
    const fetch_client_taches = useCallback(async (clientId: string) => {
        openClientIdRef.current = clientId
        try {
            setClientTaches(await tacheService.fetchTachesByClient(clientId))
        } catch (error) {
            console.error("❌ Erreur fetch tâches client:", error)
        }
    }, [])

    // 🔹 Mise à jour
    const update_Tache = useCallback(
        async (id: string, updates: Partial<Tache>) => {
            try {
                // 1. Mise à jour Optimiste (UI immédiate)
                // `Tache` (tachesUser) = MES tâches (owner = moi, cf.
                // fetch_Tache) : si l'update réassigne la tâche à quelqu'un
                // d'autre, elle doit en sortir plutôt qu'être mise à jour en
                // place — sinon le re-sync de TaskPageContext (useEffect sur
                // `Tache`) la remet dans `tasks` juste après que saveTask
                // l'en ait retirée.
                const reassignedAway =
                    "owner" in updates &&
                    !!updates.owner &&
                    !!user?.user_id &&
                    updates.owner !== user.user_id
                setTachesUser((prev) =>
                    reassignedAway
                        ? prev.filter((t) => t.id !== id)
                        : prev.map((t) =>
                              t.id === id ? { ...t, ...updates } : t
                          )
                )
                setClientTaches((prev) =>
                    prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
                )
                // Réassignée à moi : elle n'est plus « assignée à un autre ».
                const reassignedToMe =
                    "owner" in updates &&
                    !!user?.user_id &&
                    updates.owner === user.user_id
                setTachesDelegated((prev) =>
                    reassignedToMe
                        ? prev.filter((t) => t.id !== id)
                        : prev.map((t) =>
                              t.id === id ? { ...t, ...updates } : t
                          )
                )

                // 2. Préparation Payload
                const clientId =
                    typeof updates.client === "object" && updates.client
                        ? updates.client.id
                        : updates.client

                // `updates` peut être un Tache complet (cf. TaskPageContext
                // saveTask, qui repasse editTask tel quel) : owner_role /
                // creator_role sont des jointures en lecture seule, pas des
                // colonnes — Supabase rejette le PATCH (PGRST204) si on les
                // laisse dans le payload.
                const payload: Partial<Tache> & { client?: string | null } = {
                    ...updates,
                    client: clientId,
                }
                delete payload.owner_role
                delete payload.creator_role

                // 3. Envoi Supabase
                try {
                    await tacheService.updateTache(id, payload)
                } catch (error) {
                    // Rollback si erreur (on recharge la vérité)
                    fetch_Tache()
                    fetch_Tache_delegated()
                    throw error
                }
            } catch (error) {
                console.error("❌ Erreur update tâche:", error)
            }
        },
        [fetch_Tache, fetch_Tache_delegated, user?.user_id]
    )

    // 🔹 Suppression
    const delete_Tache = useCallback(
        async (id: string) => {
            try {
                // Optimistic UI
                setTachesUser((prev) => prev.filter((t) => t.id !== id))
                setTachesDelegated((prev) => prev.filter((t) => t.id !== id))
                setAllTaches((prev) => prev.filter((t) => t.id !== id))
                setClientTaches((prev) => prev.filter((t) => t.id !== id))

                try {
                    await tacheService.deleteTache(id)
                } catch (error) {
                    fetch_Tache() // Rollback
                    fetch_Tache_delegated()
                    throw error
                }
            } catch (error) {
                console.error("❌ Erreur delete tâche:", error)
            }
        },
        [fetch_Tache, fetch_Tache_delegated]
    )

    // 🔹 REALTIME / WEBSOCKETS
    useEffect(() => {
        if (!user?.user_id) return

        // Chargement initial : mes tâches + liste légère (toutes) pour les pastilles.
        fetch_Tache()
        fetch_Tache_delegated()
        fetch_Tache_alltask()

        // Abonnement — nom de channel unique par utilisateur (évite toute
        // collision de topic si le hook venait à être monté plus d'une fois).
        // Forme brute d'une ligne Tache_crm reçue par Realtime (pas de JOIN :
        // `client` y est l'id du client, pas l'objet joint de `Tache`).
        type TacheRow = {
            id: string
            client: string | null
            date: string | null
            owner: string | null
            creator_id: string | null
        }

        const unsubscribe = subscribeToTable<TacheRow>(
            `realtime-taches-${user.user_id}`,
            "Tache_crm",
            // Filtre optionnel : owner=eq.${user.user_id}
            // Si on veut voir les assignations d'autres personnes, on enlève le filtre owner
            undefined,
            async ({ eventType, newRow, oldRow }) => {
                    if (eventType === "DELETE") {
                        const oldId = oldRow.id
                        setTachesUser((prev) =>
                            prev.filter((t) => t.id !== oldId)
                        )
                        setTachesDelegated((prev) =>
                            prev.filter((t) => t.id !== oldId)
                        )
                        setAllTaches((prev) =>
                            prev.filter((t) => t.id !== oldId)
                        )
                        setClientTaches((prev) =>
                            prev.filter((t) => t.id !== oldId)
                        )
                        return
                    }

                    if (
                        eventType !== "INSERT" &&
                        eventType !== "UPDATE"
                    ) {
                        return
                    }

                    const row = newRow
                    if (!row.id) return
                    const rowClientId: string | undefined =
                        row.client ?? undefined

                    // Liste LÉGÈRE (board) : upsert d'une entrée minimale pour
                    // TOUTE tâche (visible par tous). payload.new contient déjà
                    // (id, client, date) → pas besoin de re-fetch.
                    const light = {
                        id: row.id,
                        client: rowClientId,
                        date: row.date,
                    } as unknown as Tache
                    setAllTaches((prev) => {
                        const exists = prev.some((t) => t.id === row.id)
                        return exists
                            ? prev.map((t) => (t.id === row.id ? light : t))
                            : [light, ...prev]
                    })

                    // Listes COMPLÈTES : on ne fetch la ligne complète (JOIN) que
                    // si la tâche m'est assignée OU concerne le client ouvert.
                    const isOwn = row.owner === user.user_id
                    const isDelegated =
                        row.creator_id === user.user_id &&
                        !!row.owner &&
                        row.owner !== user.user_id
                    const isOpenClient =
                        rowClientId != null &&
                        rowClientId === openClientIdRef.current
                    if (!isDelegated) {
                        setTachesDelegated((prev) =>
                            prev.filter((t) => t.id !== row.id)
                        )
                    }
                    if (!isOwn && !isDelegated && !isOpenClient) {
                        // Réassignée à quelqu'un d'autre : si elle était
                        // dans MES tâches avant cette mise à jour, elle doit
                        // en disparaître (sinon elle reste affichée avec un
                        // nouvel owner qui n'est plus moi).
                        if (eventType === "UPDATE") {
                            setTachesUser((prev) =>
                                prev.filter((t) => t.id !== row.id)
                            )
                        }
                        return
                    }

                    const fullTask = await fetchOneTaskWithRelations(row.id)
                    if (!fullTask) return

                    if (fullTask.owner === user.user_id) {
                        setTachesUser((prev) => {
                            const exists = prev.some((t) => t.id === fullTask.id)
                            return eventType === "UPDATE" || exists
                                ? prev.map((t) =>
                                      t.id === fullTask.id ? fullTask : t
                                  )
                                : [fullTask, ...prev]
                        })
                    }

                    if (isDelegated) {
                        setTachesDelegated((prev) => {
                            const exists = prev.some((t) => t.id === fullTask.id)
                            return exists
                                ? prev.map((t) =>
                                      t.id === fullTask.id ? fullTask : t
                                  )
                                : [fullTask, ...prev]
                        })
                    }

                    const fullClientId =
                        typeof fullTask.client === "object"
                            ? fullTask.client?.id
                            : fullTask.client
                    if (fullClientId === openClientIdRef.current) {
                        setClientTaches((prev) => {
                            const exists = prev.some((t) => t.id === fullTask.id)
                            return eventType === "UPDATE" || exists
                                ? prev.map((t) =>
                                      t.id === fullTask.id ? fullTask : t
                                  )
                                : [fullTask, ...prev]
                        })
                    }
            }
        )

        return unsubscribe
    }, [
        user?.user_id,
        fetch_Tache,
        fetch_Tache_delegated,
        fetch_Tache_alltask,
        fetchOneTaskWithRelations,
    ])

    // Utilisation de useMemo pour éviter les re-rendus inutiles
    return useMemo(
        () => ({
            Tache: tachesUser, // MES tâches
            TacheDelegated: tachesDelegated, // Tâches que j'ai assignées à d'autres
            AllTache: allTaches, // Toutes les tâches (léger) → pastilles du board
            clientTaches, // Tâches complètes du client ouvert (fiche)
            create_Tache,
            fetch_Tache,
            fetch_Tache_delegated,
            delete_Tache,
            update_Tache,
            fetch_Tache_alltask,
            fetch_client_taches,
        }),
        [
            tachesUser,
            tachesDelegated,
            allTaches,
            clientTaches,
            create_Tache,
            fetch_Tache,
            fetch_Tache_delegated,
            delete_Tache,
            update_Tache,
            fetch_Tache_alltask,
            fetch_client_taches,
        ]
    )
}
