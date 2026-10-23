// Public API of the stock feature — only these exports may be used outside stock/

export type {
    Balle,
    BalleFormInput,
    BalleStatus,
    BalleLocation,
    BalleType,
    Delivery,
    Fournisseur,
    BalleCategory,
} from "./types/stock.types"

export { useBalle } from "./hooks/data/useBalle"
export { useDelivery } from "./hooks/data/useLivraison"

export { default as StockProvider } from "./hooks/context/StockProvider"
export { default as StockRoute } from "./routes/Stock"
export { KpiCard } from "./components/dashboard/KpiCard"

/** Modules posables sur le dashboard (contrat shared/types/widget.types). */
export { stockWidgets } from "./widgets"

/**
 * Socle partagé avec les pages à part liées au stock (salle de tri, salle de
 * commande) : référentiels catégories/fournisseurs, thème, journal par entité
 * et lecture des erreurs Supabase.
 */
export { ReferentialProvider, useReferentialContext } from "./hooks/context/ReferentialContext"
export { GESTION_THEME } from "./theme"
export { EntityTimeline } from "./components/history/EntityTimeline"
export { ReferentialConflictError, referentialErrorMessage, rpcMessage } from "./utils/crudErrors"
