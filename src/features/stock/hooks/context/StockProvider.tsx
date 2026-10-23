import type { ReactNode } from "react"
import { StockUIProvider } from "./StockUIContext"
import { ReferentialProvider } from "./ReferentialContext"
import { ArrivageManuelProvider } from "./ArrivageManuelContext"

/**
 * Providers communs à tout le module, dans l'ordre :
 *
 *  StockUIProvider            → état UI global (viewMode, searchInput…)
 *    ReferentialProvider      → données stables partagées (fournisseurs, catégories)
 *      ArrivageManuelProvider → arrivages manuels (Flux, analyse fournisseurs)
 *
 * Les providers propres à un onglet ne sont PAS montés ici, mais dans
 * `components/StockTabs.tsx`, autour de l'onglet qui les lit :
 *
 *  InventoryProvider (balles + livraisons) → Inventaire, Dashboard
 *  HistoryProvider   (journal + prix)      → Historique, Dashboard
 *
 * Montés ici, ils chargeaient leurs tables à chaque ouverture de /stock, quel
 * que soit l'onglet — y compris des onglets `devOnly` invisibles en production
 * et un journal réservé à `stock.history.view`.
 */
export default function StockProvider({ children }: { children: ReactNode }) {
    return (
        <StockUIProvider>
            <ReferentialProvider>
                <ArrivageManuelProvider>
                    {children}
                </ArrivageManuelProvider>
            </ReferentialProvider>
        </StockUIProvider>
    )
}

// ─── Re-exports ───────────────────────────────────────────────────────────────
export { default as InventoryProvider } from "./InventoryProvider"
export { HistoryProvider } from "./HistoryContext"
export { useStockUIContext } from "./StockUIContext"
export { useReferentialContext } from "./ReferentialContext"
export { useBalleContext } from "./BalleContext"
export { useDeliveryContext } from "./LivraisonContext"
export { useArrivageManuelContext } from "./ArrivageManuelContext"
export { useHistoryContext } from "./HistoryContext"
