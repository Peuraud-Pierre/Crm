/**
 * Constantes de la salle de tri.
 *
 * Page à part (`/salle-de-tri`), feature à part : elle partage avec le stock
 * principal ses référentiels (fournisseurs, catégories, via l'API publique
 * `@/features/stock`) et son journal, rien d'autre.
 */

export const TRI_ROUTE = "/salle-de-tri"

/**
 * Permissions — `20261001100000_stock_tri.sql`. Créées SANS backfill : à
 * s'accorder depuis /administration. create/update/delete couvrent aussi le
 * référentiel des trieurs et des types de sortie.
 */
export const TRI_PERMISSIONS = {
    view:   "stock.tri.view",
    create: "stock.tri.create",
    update: "stock.tri.update",
    delete: "stock.tri.delete",
} as const

/**
 * Écart (en kg) à partir duquel une balle est signalée : poids initial et
 * total réparti diffèrent. Même seuil que les vues SQL (`abs(ecart_kg) >=
 * 0.01`) — les poids ont deux décimales, tout écart réel est donc signalé.
 * Un écart n'empêche JAMAIS l'enregistrement.
 */
export const TRI_ECART_SEUIL_KG = 0.01
