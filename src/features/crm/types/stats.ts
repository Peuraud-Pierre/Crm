// Types d'événements, couleurs et libellés : centralisés dans `utils/eventTypes.ts`.
// Réexportés ici pour conserver les imports existants de l'analytics.
export {
    CHART_COLORS,
    KNOWN_EVENT_TYPES,
    EVENT_TYPE_LABELS,
} from "@/features/crm/utils/eventTypes"

export type WidgetId =
    | "rdvPerformance"
    | "revenue"
    | "rdvByPerson"
    | "activitesByType"
    | "activitesByOwner"
    | "showNoShow"
    | "funnel"
    | "provenance"
    | "produitsRecherches"
    | "produitsRechercheEvolution"
    | "rdvByType"

export type { PeriodType } from "@/features/crm/types"

export const DEFAULT_WIDGET_CONFIG: Record<
    WidgetId,
    { id: WidgetId; visible: boolean; title: string }
> = {
    rdvPerformance: {
        id: "rdvPerformance",
        visible: true,
        title: "Évolution des RDV (par date de création)",
    },
    revenue: {
        id: "revenue",
        visible: true,
        title: "Évolution du CA",
    },
    rdvByPerson: {
        id: "rdvByPerson",
        visible: true,
        title: "RDV par commercial",
    },
    activitesByType: {
        id: "activitesByType",
        visible: true,
        title: "Activités par type",
    },
    activitesByOwner: {
        id: "activitesByOwner",
        visible: true,
        title: "Activités par collaborateur",
    },
    showNoShow: {
        id: "showNoShow",
        visible: true,
        title: "Taux de présence (Show/No-Show)",
    },
    funnel: {
        id: "funnel",
        visible: true,
        title: "Tunnel de conversion",
    },
    provenance: {
        id: "provenance",
        visible: true,
        title: "Origine des clients (Provenance)",
    },
    produitsRecherches: {
        id: "produitsRecherches",
        visible: true,
        title: "Produits les plus recherchés",
    },
    produitsRechercheEvolution: {
        id: "produitsRechercheEvolution",
        visible: true,
        title: "Évolution des produits recherchés",
    },
    rdvByType: {
        id: "rdvByType",
        visible: true,
        title: "Types de RDV pris",
    },
}
