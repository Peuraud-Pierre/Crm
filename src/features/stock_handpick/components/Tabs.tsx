import type { ReactNode } from "react"
import {
    BoxesIcon,
    HistoryIcon,
    LayoutDashboardIcon,
    MapIcon,
    QrCodeIcon,
    Settings2Icon,
} from "lucide-react"
import { ModuleTabs, type ModuleTabItem } from "@/shared/ui/organisms/module-tabs"
import type { HandpickTab, HandpickTabDef } from "@/features/stock_handpick/types/ui.types"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"
import DashboardTab from "./dashboard/DashboardTab"
import InventaireTab from "./inventaire/InventaireTab"
import CodesTab from "./codes/CodesTab"
import PlanTab from "./plan/PlanTab"
import HistoriqueTab from "./historique/HistoriqueTab"
import SettingsBoard from "./settings/SettingsBoard"

interface HandpickTabsProps {
    activeTab: HandpickTab
    detail?: string
    /** Onglets autorisés, calculés une seule fois par `TabbedModuleRoute`. */
    visibleTabs: HandpickTabDef[]
    onTabChange: (tab: HandpickTab) => void
}

interface TabMeta {
    label: string
    icon: ReactNode
    tooltip: string
    content: (detail?: string) => ReactNode
}

// Présentation seule : le gating (dev / permission) vit dans STOCK_HANDPICK_TABS.
const TAB_META: Record<HandpickTab, TabMeta> = {
    dashboardTab: {
        label: "Dashboard",
        icon: <LayoutDashboardIcon size={20} />,
        tooltip: "Vue d'ensemble du stock handpick",
        content: () => <DashboardTab />,
    },
    inventaireTab: {
        label: "Inventaire",
        icon: <BoxesIcon size={20} />,
        tooltip: "Contenu du stock handpick",
        content: (detail) => <InventaireTab detail={detail} />,
    },
    planTab: {
        label: "Plan",
        icon: <MapIcon size={20} />,
        tooltip: "Plan de l'entrepôt et contenu des étagères",
        content: (detail) => <PlanTab detail={detail} />,
    },
    codesTab: {
        label: "Codes",
        icon: <QrCodeIcon size={20} />,
        tooltip: "Étiquettes QR des emplacements : imprimer et scanner",
        content: (detail) => <CodesTab detail={detail} />,
    },
    historiqueTab: {
        label: "Historique",
        icon: <HistoryIcon size={20} />,
        tooltip: "Journal des actions sur le stock",
        content: () => <HistoriqueTab />,
    },
    settingsTab: {
        label: "Paramètres",
        icon: <Settings2Icon size={20} />,
        tooltip: "Usines, catégories et configuration",
        content: (detail) => <SettingsBoard section={detail} />,
    },
}

/** Compose `ModuleTabs` avec le vocabulaire du stock handpick. */
export default function HandpickTabs({
    activeTab,
    detail,
    visibleTabs,
    onTabChange,
}: HandpickTabsProps) {
    const items: ModuleTabItem<HandpickTab>[] = visibleTabs.map((tab) => ({
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
            theme={HANDPICK_THEME.tabs}
            onTabChange={onTabChange}
        />
    )
}
