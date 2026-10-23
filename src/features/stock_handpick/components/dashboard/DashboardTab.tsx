import { LayoutDashboard } from "lucide-react"
import { EmptyState } from "@/shared/ui/molecules/empty-state"
import { HANDPICK_THEME } from "@/features/stock_handpick/theme"

/**
 * Vue d'ensemble du module — construite en DERNIER, une fois que les trois
 * onglets qui produisent la donnée (Inventaire, Flux, Historique) sont
 * stabilisés : un dashboard bâti sur des agrégats encore mouvants se refait
 * autant de fois qu'ils changent.
 *
 * L'onglet est `devOnly` dans STOCK_HANDPICK_TABS jusqu'à sa livraison.
 */
export default function DashboardTab() {
    return (
        <EmptyState
            icon={LayoutDashboard}
            title="Dashboard à venir"
            description="La vue d'ensemble sera construite une fois l'inventaire, les flux et l'historique en place."
            size="md"
            className={HANDPICK_THEME.board.emptyState}
        />
    )
}
