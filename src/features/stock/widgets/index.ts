import { lazy } from "react"
import { Container, History } from "lucide-react"
import type { WidgetDef } from "@/shared/types/widget.types"
import { STOCK_PERMISSIONS } from "../constants"

/** Widgets exposés par la feature stock. */
export const stockWidgets: WidgetDef[] = [
    {
        id: "stock.arrivages",
        title: "Arrivages en cours",
        description: "Les prochains conteneurs à décharger.",
        icon: Container,
        category: "metier",
        accent: "chart-1",
        permission: STOCK_PERMISSIONS.arrivageView,
        featureKey: "stock",
        href: "/stock/arrivage",
        defaultW: 6,
        defaultH: 5,
        settings: [
            {
                key: "horizon",
                label: "Horizon",
                description:
                    "Nombre de jours à venir couverts. 0 affiche tous les déchargements à venir, sans borne.",
                type: "number",
                min: 0,
                max: 180,
                defaultValue: 14,
            },
        ],
        Component: lazy(() => import("./OpenArrivagesWidget")),
    },
    {
        id: "stock.activite",
        title: "Journal du stock",
        description: "Les dix dernières écritures, toutes entités confondues.",
        icon: History,
        category: "metier",
        accent: "chart-1",
        permission: STOCK_PERMISSIONS.historyView,
        featureKey: "stock",
        href: "/stock/historique",
        defaultW: 6,
        defaultH: 6,
        Component: lazy(() => import("./StockActivityWidget")),
    },
]
