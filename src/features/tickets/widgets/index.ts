import { lazy } from "react"
import { Ticket } from "lucide-react"
import type { WidgetDef } from "@/shared/types/widget.types"

/** Widgets exposés par la feature tickets. */
export const ticketWidgets: WidgetDef[] = [
    {
        id: "tickets.mine",
        title: "Mes tickets",
        description: "Les tickets ouverts qui vous attendent.",
        icon: Ticket,
        category: "activite",
        accent: "chart-3",
        permission: "tickets.view",
        featureKey: "tickets",
        href: "/tickets",
        starter: 2,
        defaultW: 6,
        defaultH: 5,
        settings: [
            {
                key: "scope",
                label: "Périmètre",
                description:
                    "« Nouveaux » = ouverts et assignés à personne. Un ticket déjà en cours de traitement n'y figure pas.",
                type: "select",
                options: [
                    { value: "mine", label: "Assignés à moi" },
                    { value: "new", label: "Nouveaux non assignés" },
                    { value: "all", label: "Les deux" },
                ],
                defaultValue: "mine",
            },
        ],
        Component: lazy(() => import("./MyTicketsWidget")),
    },
]
