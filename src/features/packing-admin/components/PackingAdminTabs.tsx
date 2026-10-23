import { useMemo, type ReactNode } from "react"
import { ModuleTabs, type ModuleTabItem } from "@/shared/ui/organisms/module-tabs"
import type { TabDef } from "@/shared/types/tabbed-module.types"
import {
    PACKING_ADMIN_TABS_THEME,
    TAB_META,
} from "@/features/packing-admin/constants"
import type { PackingAdminTab } from "@/features/packing-admin/types"
import { usePackingImportHistory } from "@/features/packing-admin/hooks/data/usePackingImportHistory"
import { usePackingMisses } from "@/features/packing-admin/hooks/data/usePackingMisses"
import { usePackingReplay } from "@/features/packing-admin/hooks/data/usePackingReplay"
import { usePackingServiceStatus } from "@/features/packing-admin/hooks/data/usePackingServiceStatus"
import { buildPackingAdminAlerts } from "@/features/packing-admin/utils/alerts"
import { AlertsBanner } from "./overview/AlertsBanner"
import { OverviewTab } from "./overview/OverviewTab"
import { ImportsTab } from "./imports/ImportsTab"
import { MissesTab } from "./misses/MissesTab"
import { SimulationTab } from "./simulation/SimulationTab"

interface PackingAdminTabsProps {
    activeTab: PackingAdminTab
    detail?: string
    visibleTabs: TabDef<PackingAdminTab>[]
    onTabChange: (tab: PackingAdminTab) => void
}

/**
 * Onglets de la console, et l'endroit où les lectures partagées sont montées.
 *
 * Les quatre hooks vivent ICI et non dans chaque onglet : le bandeau d'alertes
 * croise l'état du service, le modèle, le rejeu, les imports et les écarts. Les
 * charger par onglet le rendrait faux selon l'onglet ouvert, ce qui est
 * exactement ce qu'un bandeau d'alertes ne doit pas être.
 *
 * Conséquence assumée : ouvrir la console lit tout. Le service met en cache ses
 * propres lectures (60 s pour l'entraînement, 5 min pour le rejeu), et les
 * lectures Supabase sont bornées.
 */
export default function PackingAdminTabs({
    activeTab,
    detail,
    visibleTabs,
    onTabChange,
}: PackingAdminTabsProps) {
    const service = usePackingServiceStatus()
    const history = usePackingImportHistory()
    const misses = usePackingMisses(history.imports)
    const replay = usePackingReplay()

    const alerts = useMemo(
        () =>
            buildPackingAdminAlerts({
                apiConfigured: service.configured,
                reachable: service.reachable,
                status: service.status,
                statusError: service.error,
                model: service.status?.model
                    ? { ...service.status.model, recent_imports: [] }
                    : null,
                replay: replay.replay,
                imports: history.imports,
                misses: misses.misses,
                conflicts: misses.conflicts,
                feedbackTableMissing: misses.tableMissing,
            }),
        [service.configured, service.reachable, service.status, service.error, replay.replay, history.imports, misses.misses, misses.conflicts, misses.tableMissing],
    )

    const content: Record<PackingAdminTab, ReactNode> = {
        pilotage: (
            <OverviewTab
                service={service}
                replay={replay}
                imports={history.imports}
                importsLoading={history.loading}
            />
        ),
        imports: (
            <ImportsTab
                imports={history.imports}
                loading={history.loading}
                error={history.error}
                detail={detail}
                onRefresh={history.refetch}
            />
        ),
        ecarts: <MissesTab misses={misses} />,
        simulation: <SimulationTab production={service.status ?? null} />,
    }

    const items: readonly ModuleTabItem<PackingAdminTab>[] = visibleTabs.map((tab) => {
        const meta = TAB_META[tab.id]
        const Icon = meta.icon
        return {
            id: tab.id,
            label: meta.label,
            icon: <Icon size={18} />,
            tooltip: meta.description,
            content: (
                <div className="flex flex-col gap-4 sm:gap-6">
                    <AlertsBanner alerts={alerts} onGoToTab={onTabChange} />
                    <p className="text-sm text-muted-foreground">{meta.description}</p>
                    {content[tab.id]}
                </div>
            ),
        }
    })

    return (
        <ModuleTabs
            value={activeTab}
            items={items}
            theme={PACKING_ADMIN_TABS_THEME}
            onTabChange={onTabChange}
        />
    )
}
