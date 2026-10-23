import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
    addUserPermissions as addUserPermissionsApi,
    listPermissions,
    listUserPermissions,
    removeUserPermission as removeUserPermissionApi,
} from "../../services/permissionService"
import type { Permission } from "../../types"

const EMPTY_PERMS: Permission[] = []

interface LoadedPermissions {
    /** Identifie le chargement (user + rôle + service) — `loading` en dérive. */
    key: string
    allPermissions: Permission[]
    inheritedCodes: Set<string>
}

/**
 * Permissions d'un utilisateur : catalogue complet, héritées (rôle + service,
 * lecture seule) et individuelles (mutables, optimistes avec rollback).
 *
 * `userId` à null désactive le hook (aucun utilisateur en cours d'édition).
 */
export function useUserPermissions(
    userId: string | null,
    roleId: string | null,
    serviceId: string | null
) {
    const key = userId ? `${userId}|${roleId ?? ""}|${serviceId ?? ""}` : null

    const [loaded, setLoaded] = useState<LoadedPermissions | null>(null)
    const [individualState, setIndividualState] = useState<Permission[]>([])
    const individualRef = useRef(individualState)

    useEffect(() => {
        individualRef.current = individualState
    }, [individualState])

    useEffect(() => {
        if (!key || !userId) return

        let cancelled = false
        Promise.all([
            listPermissions(),
            listUserPermissions(userId, roleId, serviceId),
        ])
            .then(([perms, userPerms]) => {
                if (cancelled) return
                setLoaded({
                    key,
                    allPermissions: perms,
                    inheritedCodes: userPerms.inheritedCodes,
                })
                setIndividualState(userPerms.individual)
            })
            .catch((err) => {
                console.error("Erreur chargement permissions:", err)
                if (!cancelled)
                    toast.error("Impossible de charger les permissions")
            })

        return () => {
            cancelled = true
        }
    }, [key, userId, roleId, serviceId])

    const ready = key !== null && loaded?.key === key
    const loading = key !== null && !ready
    const allPermissions = ready ? loaded.allPermissions : EMPTY_PERMS
    const individualPerms = ready ? individualState : EMPTY_PERMS
    const inheritedCodes = useMemo(
        () => (ready ? loaded.inheritedCodes : new Set<string>()),
        [ready, loaded]
    )

    // Héritées du rôle/service — lecture seule
    const inheritedPerms = useMemo(
        () => allPermissions.filter((p) => inheritedCodes.has(p.code)),
        [allPermissions, inheritedCodes]
    )

    // Individuelles qui ajoutent réellement un droit (non couvertes par l'héritage)
    const effectiveIndividualPerms = useMemo(
        () => individualPerms.filter((p) => !inheritedCodes.has(p.code)),
        [individualPerms, inheritedCodes]
    )

    // Disponibles à l'ajout = ni héritées ni déjà individuelles
    const availablePerms = useMemo(() => {
        const individualCodes = new Set(individualPerms.map((p) => p.code))
        return allPermissions.filter(
            (p) => !inheritedCodes.has(p.code) && !individualCodes.has(p.code)
        )
    }, [allPermissions, inheritedCodes, individualPerms])

    const addPermissions = useCallback(
        async (toAdd: Permission[]) => {
            if (!userId || toAdd.length === 0) return true
            const previous = [...individualRef.current]
            setIndividualState((prev) => [
                ...prev,
                ...toAdd.filter((p) => !prev.some((x) => x.id === p.id)),
            ])
            try {
                await addUserPermissionsApi(
                    userId,
                    toAdd.map((p) => p.id)
                )
                return true
            } catch (err) {
                console.error("Erreur ajout permissions individuelles:", err)
                setIndividualState(previous)
                toast.error("Impossible d'ajouter les permissions")
                return false
            }
        },
        [userId]
    )

    const removePermission = useCallback(
        async (permissionId: string) => {
            if (!userId) return false
            const previous = [...individualRef.current]
            setIndividualState((prev) =>
                prev.filter((p) => p.id !== permissionId)
            )
            try {
                await removeUserPermissionApi(userId, permissionId)
                return true
            } catch (err) {
                console.error("Erreur retrait permission individuelle:", err)
                setIndividualState(previous)
                toast.error("Impossible de retirer la permission")
                return false
            }
        },
        [userId]
    )

    return {
        allPermissions,
        inheritedPerms,
        individualPerms,
        effectiveIndividualPerms,
        availablePerms,
        addPermissions,
        removePermission,
        loading,
    }
}
