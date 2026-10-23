import { Shield } from "lucide-react"
import { useRoles } from "../../hooks/data/useRoles"
import type { Permission } from "../../types"
import { EntityTab, type EntityTabLabels } from "./EntityTab"

const LABELS: EntityTabLabels = {
    title: "Gestion des rôles",
    createLabel: "Nouveau rôle",
    createTitle: "Créer un rôle",
    nameLabel: "Nom du rôle",
    emptyTitle: "Aucun rôle créé",
    entityWord: "rôle",
    statsLabel: "Rôles",
    searchPlaceholder: "Rechercher un rôle...",
    icon: Shield,
}

export function RolesTab({
    counts,
    countsLoading,
    permissions,
}: {
    counts: Map<string, number>
    countsLoading: boolean
    permissions: Permission[]
}) {
    const { roles, ...crud } = useRoles()
    return (
        <EntityTab
            labels={LABELS}
            crud={{ ...crud, entities: roles }}
            counts={counts}
            countsLoading={countsLoading}
            permissions={permissions}
        />
    )
}
