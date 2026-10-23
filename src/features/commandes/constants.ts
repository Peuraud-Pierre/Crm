/**
 * Constantes de la salle de commande (commandes boutiques).
 *
 * Page à part (`/commandes`), feature à part : elle partage avec le stock
 * principal ses catégories (via l'API publique `@/features/stock`) et son
 * journal. Ses URL sont aussi écrites par les notifications SQL
 * (`20261001110000_stock_commandes.sql`) : ne pas renommer la route sans y
 * reporter le changement.
 */

export const COMMANDES_ROUTE = "/commandes"

/**
 * Permissions — `20261001110000_stock_commandes.sql`, sans backfill.
 * `view`     : lecture (requise par la page, boutique comprise).
 * `manage`   : espace entrepôt — boutiques, commandes, préparation, expédition.
 * `boutique` : espace boutique — passer ses commandes, réceptionner au scan
 *              (simulé en V1).
 */
export const COMMANDES_PERMISSIONS = {
    view:     "stock.commandes.view",
    manage:   "stock.commandes.manage",
    boutique: "stock.commandes.boutique",
} as const

// ── Statuts ────────────────────────────────────────────────────────────────────
// Libellé et habillage de chaque statut, déclarés une fois (rendus par
// `StatusBadge`). `dot` : la pastille du planning et des tableaux.

export const COMMANDE_STATUS_CONFIG = {
    ouverte:  { label: "Ouverte",  className: "bg-muted text-muted-foreground border-border",                 dot: "bg-muted-foreground" },
    en_cours: { label: "En cours", className: "bg-chart-2/10 text-chart-2 border-chart-2/20",                 dot: "bg-chart-2" },
    soldee:   { label: "Soldée",   className: "bg-success-light text-success border-success/20",              dot: "bg-success" },
    annulee:  { label: "Annulée",  className: "bg-destructive-light text-destructive border-destructive/20",  dot: "bg-destructive" },
} as const

export const LIVRAISON_BOUTIQUE_STATUS_CONFIG = {
    planifiee:    { label: "Planifiée",     className: "bg-muted text-muted-foreground border-border",                dot: "bg-muted-foreground" },
    preparation:  { label: "En préparation", className: "bg-chart-4/10 text-chart-4 border-chart-4/20",               dot: "bg-chart-4" },
    expediee:     { label: "Expédiée",      className: "bg-chart-2/10 text-chart-2 border-chart-2/20",                dot: "bg-chart-2" },
    en_reception: { label: "En réception",  className: "bg-warning-light text-warning border-warning/20",             dot: "bg-warning" },
    receptionnee: { label: "Réceptionnée",  className: "bg-success-light text-success border-success/20",             dot: "bg-success" },
    litige:       { label: "Litige",        className: "bg-destructive-light text-destructive border-destructive/20", dot: "bg-destructive" },
    annulee:      { label: "Annulée",       className: "bg-muted text-muted-foreground border-border line-through",   dot: "bg-border" },
} as const

export const CARTON_STATUS_CONFIG = {
    prepare:       { label: "Préparé",    className: "bg-muted text-muted-foreground border-border",                dot: "bg-muted-foreground" },
    expedie:       { label: "En transit", className: "bg-chart-2/10 text-chart-2 border-chart-2/20",                dot: "bg-chart-2" },
    recu_conforme: { label: "Reçu",       className: "bg-success-light text-success border-success/20",             dot: "bg-success" },
    recu_ecart:    { label: "Écart",      className: "bg-warning-light text-warning border-warning/20",             dot: "bg-warning" },
    manquant:      { label: "Manquant",   className: "bg-destructive-light text-destructive border-destructive/20", dot: "bg-destructive" },
} as const

export const CARTON_ETAT_LABEL = {
    conforme:           "Conforme",
    ecart_poids:        "Écart de poids",
    endommage:          "Endommagé",
    mauvaise_categorie: "Mauvaise catégorie",
    manquant:           "Manquant",
} as const

/** Poids type d'un carton proposé à la préparation (kg). */
export const CARTON_POIDS_TYPE = 25

/** Pas rapides proposés à la saisie des kilos demandés. */
export const KG_PAS_RAPIDES = [10, 25] as const

/** Rappel affiché partout où l'on saisit un poids demandé. */
export const POIDS_BRUT_AIDE = "Poids brut : vêtements seuls, sans cintre ni antivol."
