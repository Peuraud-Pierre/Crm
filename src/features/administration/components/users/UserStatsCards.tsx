import { Hourglass, UserCheck, Users as UsersIcon, UserX } from "lucide-react"
import type { AdminProfile } from "../../types"
import { StatTile } from "@/shared/components/misc/StatTile"

interface UserStatsCardsProps {
    users: AdminProfile[]
    loading: boolean
}

/** Bande de stats de l'onglet Utilisateurs : total et répartition par statut. */
export function UserStatsCards({ users, loading }: UserStatsCardsProps) {
    const countByStatus = (status: AdminProfile["status"]) =>
        users.filter((u) => u.status === status).length

    return (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-4">
            <StatTile
                icon={UsersIcon}
                label="Total utilisateurs"
                value={users.length}
                tone="primary"
                loading={loading}
                index={0}
            />
            <StatTile
                icon={UserCheck}
                label="Actifs"
                value={countByStatus("active")}
                tone="success"
                loading={loading}
                index={1}
            />
            <StatTile
                icon={Hourglass}
                label="En attente"
                value={countByStatus("pending")}
                tone="warning"
                loading={loading}
                index={2}
            />
            <StatTile
                icon={UserX}
                label="Inactifs"
                value={countByStatus("inactive")}
                tone="destructive"
                loading={loading}
                index={3}
            />
        </div>
    )
}
