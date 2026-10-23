import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
    listPermissionAssignments,
    listPermissions,
} from "../../services/permissionService"
import {
    addRolePermissions,
    removeRolePermission,
} from "../../services/roleService"
import {
    addServicePermissions,
    removeServicePermission,
} from "../../services/serviceService"
import type {
    EntityKind,
    Permission,
    PermissionAssignments,
} from "../../types"

/**
 * Catalogue des permissions + détenteurs (rôles/services/compteur utilisateurs).
 * `withAssignments: false` permet de ne charger que le catalogue (picker).
 */
export function usePermissions(withAssignments = true) {
    const [permissions, setPermissions] = useState<Permission[]>([])
    const [assignments, setAssignments] = useState<PermissionAssignments>(
        () => new Map()
    )
    const [loading, setLoading] = useState(true)
    // Compteur de requêtes : une réponse tardive dont le compteur a été
    // dépassé par un refetch plus récent est ignorée (dernière requête gagne).
    const requestIdRef = useRef(0)

    const refetch = useCallback(async () => {
        const requestId = ++requestIdRef.current
        try {
            const [perms, assigns] = await Promise.all([
                listPermissions(),
                withAssignments
                    ? listPermissionAssignments()
                    : Promise.resolve<PermissionAssignments>(new Map()),
            ])
            if (requestIdRef.current !== requestId) return
            setPermissions(perms)
            setAssignments(assigns)
        } catch (err) {
            if (requestIdRef.current !== requestId) return
            console.error("Erreur chargement permissions:", err)
            toast.error("Erreur lors du chargement des permissions")
        } finally {
            if (requestIdRef.current === requestId) setLoading(false)
        }
    }, [withAssignments])

    useEffect(() => {
        refetch()
    }, [refetch])

    /**
     * Attribue (`grant: true`) ou retire une permission à un rôle/service
     * depuis le catalogue, puis recharge les détenteurs. Pas d'optimisme :
     * la volumétrie est faible et la cohérence de l'audit prime.
     */
    const assignToEntity = useCallback(
        async (
            permissionId: string,
            entity: { kind: EntityKind; id: string },
            grant: boolean
        ): Promise<boolean> => {
            try {
                if (entity.kind === "role") {
                    if (grant) await addRolePermissions(entity.id, [permissionId])
                    else await removeRolePermission(entity.id, permissionId)
                } else {
                    if (grant)
                        await addServicePermissions(entity.id, [permissionId])
                    else await removeServicePermission(entity.id, permissionId)
                }
                await refetch()
                return true
            } catch (err) {
                console.error("Erreur attribution permission:", err)
                toast.error("Erreur lors de la mise à jour de l'attribution")
                return false
            }
        },
        [refetch]
    )

    return { permissions, assignments, loading, refetch, assignToEntity }
}
