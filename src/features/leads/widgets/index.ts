import { lazy } from "react"
import { UserPlus } from "lucide-react"
import type { WidgetDef } from "@/shared/types/widget.types"

/** Widgets exposés par la feature leads. */
export const leadWidgets: WidgetDef[] = [
    {
        id: "leads.derniers",
        title: "Derniers leads",
        description: "Les demandes entrantes les plus récentes.",
        icon: UserPlus,
        category: "metier",
        accent: "chart-5",
        // Même droit que l'onglet « Statistiques Leads » d'/analytics.
        permission: "leads_stats.view",
        // Reste `analytics` : c'est ce périmètre qui sert la donnée, et
        // `featureKey` pilote la dégradation en maintenance. Le module
        // apparaît donc sous Analytics au catalogue, même si son « voir
        // tout » mène au CRM — c'est là qu'on traite un lead.
        featureKey: "analytics",
        href: "/crm/clients",
        defaultW: 6,
        defaultH: 5,
        settings: [
            {
                key: "period",
                label: "Période",
                description:
                    "Ancienneté maximale des demandes affichées.",
                type: "select",
                options: [
                    { value: "all", label: "Depuis toujours" },
                    { value: "7", label: "7 derniers jours" },
                    { value: "30", label: "30 derniers jours" },
                    { value: "90", label: "90 derniers jours" },
                ],
                defaultValue: "all",
            },
        ],
        Component: lazy(() => import("./LatestLeadsWidget")),
    },
]
