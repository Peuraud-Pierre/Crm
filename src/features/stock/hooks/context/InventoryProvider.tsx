import type { ReactNode } from "react"
import { BalleProvider } from "./BalleContext"
import { DeliveryProvider } from "./LivraisonContext"

/**
 * Balles et livraisons, montées au plus près des onglets qui les lisent
 * (Inventaire, Dashboard) plutôt qu'à la racine du module.
 *
 * Montés dans `StockProvider`, ces deux providers chargeaient à chaque
 * ouverture de /stock l'intégralité de `balles_gestion` et de
 * `deliveries_gestion` avec leurs jointures, et ouvraient deux canaux realtime
 * rechargeant toute la table à chaque événement — alors que les deux onglets
 * qui les consomment sont `devOnly` : en production, tout visiteur de l'onglet
 * Flux payait ce chargement pour des écrans qu'il ne pouvait pas afficher.
 *
 * Radix Tabs ne monte que l'onglet actif : le chargement n'a lieu qu'à
 * l'ouverture de l'un des deux onglets. En contrepartie, filtres et sheets de
 * l'inventaire ne survivent pas à un changement d'onglet.
 */
export default function InventoryProvider({ children }: { children: ReactNode }) {
    return (
        <BalleProvider>
            <DeliveryProvider>{children}</DeliveryProvider>
        </BalleProvider>
    )
}
