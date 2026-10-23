import TabbedModuleRoute from "@/app/routes/layouts/TabbedModuleRoute"
import { STOCK_HANDPICK_MODULE } from "../types/ui.types"
import HandpickTabs from "../components/Tabs"

/**
 * Le gating des onglets et toute la canonicalisation de l'URL vivent dans
 * `TabbedModuleRoute`, partagé avec le stock principal — y compris le garde-fou
 * contre l'oscillation d'onglets (un onglet ne doit jamais se rediriger
 * lui-même, cf. le docblock du layout).
 */
export default function StockHandpick() {
    return (
        <TabbedModuleRoute config={STOCK_HANDPICK_MODULE}>
            {({ activeTab, detail, visibleTabs, goToTab }) => (
                <HandpickTabs
                    activeTab={activeTab}
                    detail={detail}
                    visibleTabs={visibleTabs}
                    onTabChange={goToTab}
                />
            )}
        </TabbedModuleRoute>
    )
}
