import { lazy } from "react"
import { Bell } from "lucide-react"
import type { WidgetDef } from "@/shared/types/widget.types"

/** Widgets exposés par la feature notifications. */
export const notificationWidgets: WidgetDef[] = [
    {
        id: "notifications.recentes",
        title: "Notifications",
        description: "Ce qui s'est passé depuis votre dernier passage.",
        icon: Bell,
        category: "activite",
        accent: "chart-2",
        // Aucune permission : chacun ne lit que les siennes (RLS).
        // Aucun `href` non plus — les notifications n'ont pas de page,
        // seulement le panneau de l'en-tête.
        maxInstances: 1,
        defaultW: 6,
        defaultH: 5,
        Component: lazy(() => import("./RecentNotificationsWidget")),
    },
]
