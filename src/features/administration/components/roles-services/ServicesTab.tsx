import { Briefcase } from "lucide-react"
import { useServices } from "../../hooks/data/useServices"
import type { Permission } from "../../types"
import { EntityTab, type EntityTabLabels } from "./EntityTab"

const LABELS: EntityTabLabels = {
    title: "Gestion des services",
    createLabel: "Nouveau service",
    createTitle: "Créer un service",
    nameLabel: "Nom du service",
    emptyTitle: "Aucun service créé",
    entityWord: "service",
    statsLabel: "Services",
    searchPlaceholder: "Rechercher un service...",
    icon: Briefcase,
}

export function ServicesTab({
    counts,
    countsLoading,
    permissions,
}: {
    counts: Map<string, number>
    countsLoading: boolean
    permissions: Permission[]
}) {
    const { services, ...crud } = useServices()
    return (
        <EntityTab
            labels={LABELS}
            crud={{ ...crud, entities: services }}
            counts={counts}
            countsLoading={countsLoading}
            permissions={permissions}
        />
    )
}
