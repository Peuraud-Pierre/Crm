import TabbedModuleRoute from "@/app/routes/layouts/TabbedModuleRoute"
import { PACKING_ADMIN_MODULE } from "@/features/packing-admin/constants"
import PackingAdminTabs from "@/features/packing-admin/components/PackingAdminTabs"

/**
 * Console de supervision de `packing-api` — `/packing-admin/:section?/:detail?`.
 *
 * Tout le routing (filtrage des onglets, canonicalisation d'URL, unique effet de
 * garde) vit dans `TabbedModuleRoute`, partagé avec les deux modules de stock.
 * Ne pas le réécrire ici : un onglet qui se redirige lui-même provoque une
 * oscillation silencieuse, panne observée en août 2026 et documentée dans le
 * docblock du layout.
 *
 * Pas de `<h1>` : le header applicatif l'affiche déjà, dérivé de `menuItems` par
 * préfixe de chemin.
 */
export default function PackingAdmin() {
    return (
        <TabbedModuleRoute config={PACKING_ADMIN_MODULE}>
            {({ activeTab, detail, visibleTabs, goToTab }) => (
                <PackingAdminTabs
                    activeTab={activeTab}
                    detail={detail}
                    visibleTabs={visibleTabs}
                    onTabChange={goToTab}
                />
            )}
        </TabbedModuleRoute>
    )
}
