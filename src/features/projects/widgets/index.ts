import { lazy } from "react"
import { SquareKanban } from "lucide-react"
import type { WidgetDef } from "@/shared/types/widget.types"

/** Widgets exposés par la feature projets. */
export const projectWidgets: WidgetDef[] = [
    {
        id: "projects.mes-taches",
        title: "Mes tâches",
        description: "Les tâches de projet qui vous sont assignées.",
        icon: SquareKanban,
        category: "activite",
        accent: "chart-6",
        permission: "projects.view",
        featureKey: "projects",
        href: "/projects",
        starter: 4,
        defaultW: 6,
        defaultH: 5,
        Component: lazy(() => import("./MyTasksWidget")),
    },
]
