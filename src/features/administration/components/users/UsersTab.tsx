import { useMemo, useState } from "react"
import { Users as UsersIcon, UserX } from "lucide-react"
import { useAuth } from "@/features/auth/hooks/useAuth/AuthProvider"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/shared/ui/atoms/card"
import { Skeleton } from "@/shared/ui/atoms/skeleton"
import { useAdminUsers } from "../../hooks/data/useAdminUsers"
import { useEntityOptions } from "../../hooks/data/useEntityOptions"
import { ADMIN_PERMISSIONS } from "../../constants"
import type { AdminProfile } from "../../types"
import { UserCard } from "./UserCard"
import { UserCreateSheet } from "./UserCreateSheet"
import {
    DEFAULT_USER_FILTERS,
    UserFilters,
    type UserFiltersState,
} from "./UserFilters"
import { UserSheet } from "./UserSheet"
import { UserStatsCards } from "./UserStatsCards"
import { UserTable } from "./UserTable"
import { EmptyState } from "@/shared/ui/molecules/empty-state"

// Clés stables pour les placeholders de chargement mobile.
const SKELETON_CARDS = ["sc1", "sc2", "sc3", "sc4"]

/** Onglet Utilisateurs : stats, filtres, liste responsive, fiche d'accès. */
export function UsersTab() {
    const { hasPermission } = useAuth()
    const {
        users,
        loading,
        updateUser,
        toggleStatus,
        createUser,
        inviteUser,
        deleteUser,
    } = useAdminUsers()
    const { roles, services } = useEntityOptions()

    const [filters, setFilters] = useState<UserFiltersState>(
        DEFAULT_USER_FILTERS
    )
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
    const [editingUserId, setEditingUserId] = useState<string | null>(null)

    const canCreate = hasPermission(ADMIN_PERMISSIONS.usersCreate)
    const canUpdate = hasPermission(ADMIN_PERMISSIONS.usersUpdate)
    const canDelete = hasPermission(ADMIN_PERMISSIONS.usersDelete)

    // Résolu depuis la liste pour que le realtime rafraîchisse la fiche ouverte.
    const editingUser =
        users.find((u) => u.user_id === editingUserId) ?? null

    const filteredUsers = useMemo(() => {
        const filtered = users.filter((user) => {
            const matchesSearch = user.full_name
                .toLowerCase()
                .includes(filters.search.toLowerCase())
            const matchesRole =
                filters.role === "all" || user.role?.nom === filters.role
            const matchesService =
                filters.service === "all" ||
                user.service?.nom === filters.service
            const matchesStatus =
                filters.status === "all" || user.status === filters.status
            return (
                matchesSearch && matchesRole && matchesService && matchesStatus
            )
        })

        // Jamais connecté (last_login null) = plus ancien que toute connexion.
        return [...filtered].sort((a, b) => {
            const aTime = a.last_login ? new Date(a.last_login).getTime() : 0
            const bTime = b.last_login ? new Date(b.last_login).getTime() : 0
            return sortOrder === "asc" ? aTime - bTime : bTime - aTime
        })
    }, [users, filters, sortOrder])

    const isEmpty = !loading && filteredUsers.length === 0

    const actionHandlers = {
        canUpdate,
        canDelete,
        onEdit: (user: AdminProfile) => setEditingUserId(user.user_id),
        onToggleStatus: (user: AdminProfile) => void toggleStatus(user),
        onDelete: (user: AdminProfile) => void deleteUser(user.user_id),
    }

    return (
        <div className="space-y-6">
            <UserStatsCards users={users} loading={loading} />

            <Card className="shadow-surface">
                <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="flex items-center gap-2 min-w-0 text-xl">
                            <UsersIcon className="w-5 h-5 text-primary shrink-0" />
                            <span className="truncate">
                                Liste des utilisateurs
                            </span>
                        </CardTitle>
                        <UserCreateSheet
                            roles={roles}
                            services={services}
                            canCreate={canCreate}
                            onCreate={createUser}
                            onInvite={inviteUser}
                        />
                    </div>

                    <UserFilters
                        filters={filters}
                        onChange={setFilters}
                        roles={roles}
                        services={services}
                        resultCount={filteredUsers.length}
                    />
                </CardHeader>

                <CardContent className="p-0" aria-busy={loading}>
                    {isEmpty ? (
                        <EmptyState
                            variant="search"
                            icon={UserX}
                            title="Aucun utilisateur"
                            description="Aucun utilisateur ne correspond aux filtres actuels."
                        />
                    ) : (
                        <>
                            {/* Desktop : table */}
                            <div className="hidden md:block">
                                <UserTable
                                    users={filteredUsers}
                                    loading={loading}
                                    sortOrder={sortOrder}
                                    onToggleSort={() =>
                                        setSortOrder((prev) =>
                                            prev === "asc" ? "desc" : "asc"
                                        )
                                    }
                                    {...actionHandlers}
                                />
                            </div>

                            {/* Mobile : cartes */}
                            <div className="md:hidden space-y-3 p-4">
                                {loading
                                    ? SKELETON_CARDS.map((key) => (
                                          <Skeleton
                                              key={key}
                                              className="h-32 w-full rounded-lg"
                                          />
                                      ))
                                    : filteredUsers.map((user) => (
                                          <UserCard
                                              key={user.user_id}
                                              user={user}
                                              {...actionHandlers}
                                          />
                                      ))}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <UserSheet
                user={editingUser}
                roles={roles}
                services={services}
                canUpdate={canUpdate}
                onClose={() => setEditingUserId(null)}
                onSave={updateUser}
            />
        </div>
    )
}
