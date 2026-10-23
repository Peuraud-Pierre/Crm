import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { Permission, Role, Service } from "../../types"

type EntityShape = Role | Service

export interface EntityApi<T extends EntityShape> {
    list: () => Promise<T[]>
    create: (nom: string) => Promise<T>
    rename: (id: string, nom: string) => Promise<void>
    remove: (id: string) => Promise<void>
    addPermissions: (id: string, permissionIds: string[]) => Promise<void>
    removePermission: (id: string, permissionId: string) => Promise<void>
}

/**
 * CRUD optimiste pour une entité porteuse de permissions (rôle ou service).
 *
 * Même idiome snapshot-ref + rollback que `useOptimisticCrud` (stock), mais
 * avec une seule source de vérité locale : les mutations du tableau
 * `permissions` imbriqué et le CRUD de base opèrent sur le même state, ce
 * qu'une composition avec `useOptimisticCrud` (state interne séparé,
 * resynchronisé par prop) ne permet pas sans conflit.
 */
export function useEntityPermissionsCrud<T extends EntityShape>(
    api: EntityApi<T>,
    entityLabel: string
) {
    const [entities, setEntities] = useState<T[]>([])
    const [loading, setLoading] = useState(true)
    const entitiesRef = useRef(entities)

    useEffect(() => {
        entitiesRef.current = entities
    }, [entities])

    const refetch = useCallback(async () => {
        try {
            setEntities(await api.list())
        } catch (err) {
            console.error(`Erreur chargement ${entityLabel}s:`, err)
            toast.error(`Erreur lors du chargement des ${entityLabel}s`)
        } finally {
            setLoading(false)
        }
    }, [api, entityLabel])

    useEffect(() => {
        refetch()
    }, [refetch])

    /** Renvoie l'entité créée (pour ouvrir sa fiche) ou null en échec. */
    const create = useCallback(
        async (nom: string): Promise<T | null> => {
            try {
                const created = await api.create(nom)
                setEntities((prev) =>
                    [...prev, created].sort((a, b) =>
                        a.nom.localeCompare(b.nom)
                    )
                )
                return created
            } catch (err) {
                console.error(`Erreur création ${entityLabel}:`, err)
                toast.error(`Erreur lors de la création du ${entityLabel}`)
                return null
            }
        },
        [api, entityLabel]
    )

    const rename = useCallback(
        async (id: string, nom: string) => {
            const previous = [...entitiesRef.current]
            setEntities((prev) =>
                prev.map((e) => (e.id === id ? { ...e, nom } : e))
            )
            try {
                await api.rename(id, nom)
                return true
            } catch (err) {
                console.error(`Erreur renommage ${entityLabel}:`, err)
                setEntities(previous)
                toast.error(`Erreur lors du renommage du ${entityLabel}`)
                return false
            }
        },
        [api, entityLabel]
    )

    const remove = useCallback(
        async (id: string) => {
            const previous = [...entitiesRef.current]
            setEntities((prev) => prev.filter((e) => e.id !== id))
            try {
                await api.remove(id)
                return true
            } catch (err) {
                console.error(`Erreur suppression ${entityLabel}:`, err)
                setEntities(previous)
                toast.error(`Erreur lors de la suppression du ${entityLabel}`)
                return false
            }
        },
        [api, entityLabel]
    )

    const addPermissions = useCallback(
        async (id: string, toAdd: Permission[]) => {
            if (toAdd.length === 0) return true
            const previous = [...entitiesRef.current]
            setEntities((prev) =>
                prev.map((e) =>
                    e.id !== id
                        ? e
                        : {
                              ...e,
                              permissions: [
                                  ...e.permissions,
                                  ...toAdd.filter(
                                      (p) =>
                                          !e.permissions.some(
                                              (x) => x.id === p.id
                                          )
                                  ),
                              ],
                          }
                )
            )
            try {
                await api.addPermissions(
                    id,
                    toAdd.map((p) => p.id)
                )
                return true
            } catch (err) {
                console.error(`Erreur ajout permissions ${entityLabel}:`, err)
                setEntities(previous)
                toast.error("Erreur lors de l'ajout des permissions")
                await refetch()
                return false
            }
        },
        [api, entityLabel, refetch]
    )

    const removePermission = useCallback(
        async (id: string, permissionId: string) => {
            const previous = [...entitiesRef.current]
            setEntities((prev) =>
                prev.map((e) =>
                    e.id !== id
                        ? e
                        : {
                              ...e,
                              permissions: e.permissions.filter(
                                  (p) => p.id !== permissionId
                              ),
                          }
                )
            )
            try {
                await api.removePermission(id, permissionId)
                return true
            } catch (err) {
                console.error(
                    `Erreur retrait permission ${entityLabel}:`,
                    err
                )
                setEntities(previous)
                toast.error("Erreur lors du retrait de la permission")
                await refetch()
                return false
            }
        },
        [api, entityLabel, refetch]
    )

    return {
        entities,
        loading,
        refetch,
        create,
        rename,
        remove,
        addPermissions,
        removePermission,
    }
}
