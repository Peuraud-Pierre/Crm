import { lazy } from "react"
import { MessageSquare } from "lucide-react"
import type { WidgetDef } from "@/shared/types/widget.types"

/** Widgets exposés par la feature messages. */
export const messageWidgets: WidgetDef[] = [
    {
        id: "messages.non-lus",
        title: "Messages non lus",
        description: "Qui attend une réponse, et depuis combien de messages.",
        icon: MessageSquare,
        category: "activite",
        accent: "chart-2",
        // `/messages` exige `messages.view` : sans ce code, le module
        // était proposé à tout le monde et sa flèche « voir tout »
        // menait à un NotFound.
        permission: "messages.view",
        featureKey: "messages",
        href: "/messages",
        maxInstances: 1,
        defaultW: 4,
        defaultH: 4,
        Component: lazy(() => import("./UnreadMessagesWidget")),
    },
]
