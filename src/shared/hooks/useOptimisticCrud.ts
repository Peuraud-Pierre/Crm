import { useState, useEffect, useCallback, useRef } from "react"

/**
 * CRUD optimiste générique : state local synchronisé sur une source serveur,
 * update/remove appliqués immédiatement avec rollback + refetch en cas
 * d'échec.
 *
 * Vit dans `shared/` et non dans une feature : le hook ne connaît aucun
 * domaine (seule contrainte : `T extends { id: string }`). Il était sous
 * `features/stock/hooks/data/`, d'où `stock_handpick` n'aurait pu l'importer
 * sans franchir la frontière d'une autre feature.
 *
 * Contrat de retour — c'est lui qui permet à un formulaire de rester ouvert
 * quand l'écriture échoue, au lieu de se refermer sur une saisie perdue :
 *   - `create` rend l'élément créé, ou `null` en échec ;
 *   - `update` et `remove` rendent `true` si l'écriture a abouti.
 * L'erreur elle-même est signalée par `onError` ; l'appelant n'a plus qu'à
 * décider s'il referme.
 */
interface CrudApi<T, TCreate = T> {
    create: (item: TCreate) => Promise<T | null>
    update: (id: string, item: Partial<T>) => Promise<void>
    delete: (id: string) => Promise<void>
    refetch: () => Promise<void>
}

export function useOptimisticCrud<T extends { id: string }, TCreate = T>(
    serverItems: T[] | undefined,
    api: CrudApi<T, TCreate>,
    onError?: (action: string, error: unknown) => void
) {
    const [items, setItems] = useState<T[]>(serverItems ?? [])
    const itemsRef = useRef(items)

    // Sync serveur → state local : resync de l'entité quand la source serveur change.
    useEffect(() => {
        // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
        if (serverItems) setItems(serverItems)
    }, [serverItems])

    // Sync state local → ref (sans déclencher de re-render)
    useEffect(() => {
        itemsRef.current = items
    }, [items])

    const create = useCallback(async (item: TCreate) => {
        try {
            const created = await api.create(item)
            // Sans cet ajout, un élément créé restait invisible jusqu'au
            // prochain refetch — qui n'arrive jamais sur une table sans
            // realtime (les référentiels). Le refetch suivant, quand il y en
            // a un, remplace de toute façon la liste par celle du serveur.
            if (created) {
                setItems(prev =>
                    prev.some(i => i.id === created.id) ? prev : [created, ...prev]
                )
            }
            return created
        } catch (error) {
            onError?.("create", error)
            return null
        }
    }, [api, onError])

    const update = useCallback(async (id: string, partial: Partial<T>): Promise<boolean> => {
        const previous = [...itemsRef.current] // ← ref stable, pas de dépendance
        setItems(prev => prev.map(i => i.id === id ? { ...i, ...partial } : i))
        try {
            await api.update(id, partial)
            return true
        } catch (error) {
            setItems(previous)
            api.refetch()
            onError?.("update", error)
            return false
        }
    }, [api, onError]) // ← items retiré

    const remove = useCallback(async (id: string): Promise<boolean> => {
        const previous = [...itemsRef.current] // ← ref stable
        setItems(prev => prev.filter(i => i.id !== id))
        try {
            await api.delete(id)
            return true
        } catch (error) {
            setItems(previous)
            onError?.("delete", error)
            return false
        }
    }, [api, onError]) // ← items retiré

    return { items, create, update, remove }
}
