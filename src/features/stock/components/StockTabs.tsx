import {
    BoxIcon,
    CalendarCogIcon,
    HistoryIcon,
    LayoutDashboardIcon,
    ScanTextIcon,
    Settings2Icon,
} from "lucide-react"
import { ModuleTabs, type ModuleTabItem } from "@/shared/ui/organisms/module-tabs"
import type { StockTab, StockTabDef } from "@/features/stock/types/ui.types"
import { GESTION_THEME } from "@/features/stock/theme"
import {
    HistoryProvider,
    InventoryProvider,
    useStockUIContext,
} from "../hooks/context/StockProvider"
import StockBoard from "./stockboard/StockBoard"
import SettingsBoard from "./settings/SettingsBoard"
import StockDashboard from "./dashboard/DashboardTab"
import FlowBoard from "./flow/FlowBoard"
import HistoryBoard from "./history/HistoryBoard"
import ScanBoard from "./scan/ScanBoard"

interface StockTabsProps {
    activeTab: StockTab
    detail?: string
    /** Onglets autorisés, calculés une seule fois par `TabbedModuleRoute`. */
    visibleTabs: StockTabDef[]
    onTabChange: (tab: StockTab) => void
}

interface TabMeta {
    label: string
    icon: React.ReactNode
    tooltip: string
    content: (detail?: string) => React.ReactNode
}

// Présentation seule : le gating (dev / permission) vit dans STOCK_TABS.
//
// Les providers de données propres à un onglet sont montés ICI, autour de
// l'onglet qui les lit, et non dans `StockProvider` : Radix ne monte que
// l'onglet actif, donc balles, livraisons et journal ne se chargent qu'à
// l'ouverture d'un onglet qui les affiche (voir `InventoryProvider`).
const TAB_META: Record<StockTab, TabMeta> = {
    dashboardTab: {
        label: "Dashboard",
        icon: <LayoutDashboardIcon size={20} />,
        tooltip: "Voir le dashboard du stock",
        content: () => (
            <HistoryProvider>
                <InventoryProvider>
                    <StockDashboard />
                </InventoryProvider>
            </HistoryProvider>
        ),
    },
    inventaireTab: {
        label: "Inventaire",
        icon: <BoxIcon size={20} />,
        tooltip: "Contenu du stock",
        content: () => (
            <InventoryProvider>
                <StockBoard />
            </InventoryProvider>
        ),
    },
    fluxTab: {
        label: "Flux",
        icon: <CalendarCogIcon size={20} />,
        tooltip: "Arrivages et departs",
        content: (detail) => <FlowBoard detail={detail} />,
    },
    scanTab: {
        label: "Scan",
        icon: <ScanTextIcon size={20} />,
        tooltip: "Transformer des fiches scannées ou photographiées en Excel",
        content: () => <ScanBoard />,
    },
    historiqueTab: {
        label: "Historique",
        icon: <HistoryIcon size={20} />,
        tooltip: "Historique du stock et analyse des fournisseurs",
        content: () => (
            <HistoryProvider>
                <HistoryBoard />
            </HistoryProvider>
        ),
    },
    settingsTab: {
        label: "Paramètres",
        icon: <Settings2Icon size={20} />,
        tooltip: "Gérer les fournisseurs et les catégories",
        content: (detail) => <SettingsBoard section={detail} />,
    },
}

/**
 * Compose `ModuleTabs` avec le vocabulaire du stock.
 *
 * Ce composant ne se réduit pas à un passe-plat : c'est ici que vit le reset du
 * champ de recherche, qui a besoin du contexte du module. Le court-circuiter en
 * rendant `ModuleTabs` directement depuis la route ferait disparaître ce reset
 * sans le moindre symptôme technique — la recherche garderait simplement sa
 * valeur d'un onglet à l'autre.
 */
export default function StockTabs({
    activeTab,
    detail,
    visibleTabs,
    onTabChange,
}: StockTabsProps) {
    const { setSearchInput } = useStockUIContext()

    const items: ModuleTabItem<StockTab>[] = visibleTabs.map((tab) => ({
        id: tab.id,
        label: TAB_META[tab.id].label,
        icon: TAB_META[tab.id].icon,
        tooltip: TAB_META[tab.id].tooltip,
        content: TAB_META[tab.id].content(detail),
    }))

    return (
        <ModuleTabs
            value={activeTab}
            items={items}
            theme={GESTION_THEME.tabs}
            onTabChange={(id) => {
                setSearchInput("")
                onTabChange(id)
            }}
        />
    )
}
