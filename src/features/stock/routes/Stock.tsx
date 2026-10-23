import TabbedModuleRoute from "@/app/routes/layouts/TabbedModuleRoute"
import { STOCK_MODULE } from "../types/ui.types"
import StockTabs from "../components/StockTabs"

/**
 * Le gating des onglets et toute la canonicalisation de l'URL vivent dans
 * `TabbedModuleRoute`, partagé avec les autres modules de stock — y compris le
 * garde-fou contre l'oscillation d'onglets (un onglet ne doit jamais se
 * rediriger lui-même, cf. le docblock du layout).
 */
export default function Stock() {
    return (
        <TabbedModuleRoute config={STOCK_MODULE}>
            {({ activeTab, detail, visibleTabs, goToTab }) => (
                <StockTabs
                    activeTab={activeTab}
                    detail={detail}
                    visibleTabs={visibleTabs}
                    onTabChange={goToTab}
                />
            )}
        </TabbedModuleRoute>
    )
}
