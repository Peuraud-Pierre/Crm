import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
    createUser as createUserApi,
    deleteUser as deleteUserApi,
    inviteUser as inviteUserApi,
    listProfiles,
    subscribeToProfiles,
    updateProfile,
} from "../../services/userAdminService"
import type {
    AdminProfile,
    CreateUserInput,
    InviteUserInput,
    ProfileUpdateInput,
} from "../../types"

// Fusion optimiste : champ par champ pour préserver les non-nullables
// d'AdminProfile (les champs de ProfileUpdateInput sont tous optionnels).
// Les jointures role/service sont resynchronisées par le refetch qui suit.
function mergeProfileUpdates(
    u: AdminProfile,
    updates: ProfileUpdateInput
): AdminProfile {
    return {
        ...u,
        full_name: updates.full_name ?? u.full_name,
        email: updates.email ?? u.email,
        role_id: updates.role_id === undefined ? u.role_id : updates.role_id,
        service_id:
            updates.service_id === undefined
                ? u.service_id
                : updates.service_id,
        status: updates.status ?? u.status,
    }
}

/**
 * Liste des utilisateurs (profils) pour l'administration.
 *
 * - Realtime `profiles` avec refetch débouncé (500 ms) : plus robuste qu'un
 *   merge de payload, qui perdrait les jointures rôle/service sur UPDATE.
 * - `updateUser`/`toggleStatus` : optimistes avec rollback (clé `user_id`).
 * - `createUser`/`inviteUser`/`deleteUser` : pas d'optimisme (backend Go
 *   keyexchange) — await + refetch.
 */
export function useAdminUsers() {
    const [users, setUsers] = useState<AdminProfile[]>([])
    const [loading, setLoading] = useState(true)
    const usersRef = useRef(users)

    useEffect(() => {
        usersRef.current = users
    }, [users])

    const refetch = useCallback(async () => {
        try {
            setUsers(await listProfiles())
        } catch (err) {
            console.error("Erreur chargement utilisateurs:", err)
            toast.error("Erreur lors du chargement des utilisateurs")
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        refetch()

        // Refetch débouncé : les payloads realtime ne portent pas les
        // jointures rôle/service, on recharge la liste après 500 ms de calme.
        let timeoutId: ReturnType<typeof setTimeout>
        const unsubscribe = subscribeToProfiles(() => {
            clearTimeout(timeoutId)
            timeoutId = setTimeout(() => refetch(), 500)
        })

        return () => {
            unsubscribe()
            clearTimeout(timeoutId)
        }
    }, [refetch])

    const updateUser = useCallback(
        async (userId: string, updates: ProfileUpdateInput) => {
            const previous = [...usersRef.current]
            setUsers((prev) =>
                prev.map((u) =>
                    u.user_id === userId ? mergeProfileUpdates(u, updates) : u
                )
            )
            try {
                await updateProfile(userId, updates)
                toast.success("Utilisateur mis à jour")
                // Refetch pour resynchroniser les jointures rôle/service
                await refetch()
                return true
            } catch (err) {
                console.error("Erreur mise à jour utilisateur:", err)
                setUsers(previous)
                toast.error("Erreur lors de la mise à jour")
                return false
            }
        },
        [refetch]
    )

    const toggleStatus = useCallback(
        async (user: AdminProfile) => {
            const status = user.status === "active" ? "inactive" : "active"
            const previous = [...usersRef.current]
            setUsers((prev) =>
                prev.map((u) =>
                    u.user_id === user.user_id ? { ...u, status } : u
                )
            )
            try {
                await updateProfile(user.user_id, { status })
                return true
            } catch (err) {
                console.error("Erreur changement de statut:", err)
                setUsers(previous)
                toast.error("Erreur lors du changement de statut")
                return false
            }
        },
        []
    )

    const createUser = useCallback(
        async (input: CreateUserInput) => {
            try {
                await createUserApi(input)
                toast.success("Utilisateur créé avec succès 🎉")
                await refetch()
                return true
            } catch (err) {
                console.error("Erreur création utilisateur:", err)
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Erreur lors de la création de l'utilisateur"
                )
                return false
            }
        },
        [refetch]
    )

    const inviteUser = useCallback(
        async (input: InviteUserInput) => {
            try {
                await inviteUserApi(input)
                toast.success("Invitation envoyée avec succès ✉️")
                await refetch()
                return true
            } catch (err) {
                console.error("Erreur invitation utilisateur:", err)
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Erreur lors de l'envoi de l'invitation"
                )
                return false
            }
        },
        [refetch]
    )

    const deleteUser = useCallback(async (userId: string) => {
        try {
            await deleteUserApi(userId)
            setUsers((prev) => prev.filter((u) => u.user_id !== userId))
            toast.success("Utilisateur supprimé")
            return true
        } catch (err) {
            console.error("Erreur suppression utilisateur:", err)
            toast.error("Erreur lors de la suppression")
            return false
        }
    }, [])

    return {
        users,
        loading,
        refetch,
        updateUser,
        toggleStatus,
        createUser,
        inviteUser,
        deleteUser,
    }
}
