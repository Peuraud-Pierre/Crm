import { lazy } from "react"
import { CalendarClock, ListChecks } from "lucide-react"
import type { WidgetDef } from "@/shared/types/widget.types"

/** Widgets exposés par la feature CRM. */
export const crmWidgets: WidgetDef[] = [
    {
        id: "crm.today-events",
        title: "Mes rendez-vous du jour",
        description: "Votre agenda de la journée.",
        icon: CalendarClock,
        category: "activite",
        accent: "chart-4",
        permission: "crm.view",
        featureKey: "crm",
        href: "/crm/agenda",
        starter: 3,
        defaultW: 6,
        defaultH: 5,
        Component: lazy(() => import("./TodayEventsWidget")),
    },
    {
        id: "crm.taches",
        title: "Mes tâches CRM",
        description: "Les tâches qui vous sont assignées, par échéance.",
        icon: ListChecks,
        category: "activite",
        accent: "chart-4",
        permission: "crm.view",
        featureKey: "crm",
        href: "/crm/tache",
        defaultW: 6,
        defaultH: 5,
        Component: lazy(() => import("./CrmTasksWidget")),
    },
]
