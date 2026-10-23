import { GESTION_THEME } from "@/features/stock/theme"
import type { BalleStatus } from "@/features/stock/types/balle.types"

// ── Permissions ────────────────────────────────────────────────────────────────
/**
 * Registre des codes de permission de la feature. Tout `hasPermission(...)`
 * passe par ces constantes, jamais par un littéral en dur.
 *
 * Les codes `settings.*` et `history.view` sont créés par
 * `supabase/migrations/20260818120000_stock_settings_permissions.sql`, qui
 * aligne aussi la RLS de `categories_gestion` / `fournisseur_gestion` dessus.
 */
export const STOCK_PERMISSIONS = {
    /** Accès au module (gaté aussi par le router). */
    view: "stock.view",

    // Arrivages
    arrivageView:   "stock.arrivage.view",
    arrivageCreate: "stock.arrivage.create",
    arrivageUpdate: "stock.arrivage.update",
    /**
     * Créée par `20260707130000_arrivage_manuel_permissions.sql` et attribuée à
     * PERSONNE par défaut : la suppression reste fermée tant qu'un
     * administrateur ne l'accorde pas. La RLS l'applique de son côté.
     */
    arrivageDelete: "stock.arrivage.delete",
    arrivageExport: "stock.arrivage.export",

    // Paramètres (référentiel catégories / fournisseurs)
    settingsView:   "stock.settings.view",
    settingsCreate: "stock.settings.create",
    settingsUpdate: "stock.settings.update",
    settingsDelete: "stock.settings.delete",

    // Historique
    historyView: "stock.history.view",

    /**
     * Packing lists des arrivages — `20260915100000_stock_packing_list.sql`.
     * `delete` n'est attribuée à personne par défaut, comme pour les
     * arrivages ; « Remplacer le fichier » en dépend aussi.
     */
    packingView:   "stock.packing.view",
    packingCreate: "stock.packing.create",
    packingUpdate: "stock.packing.update",
    packingDelete: "stock.packing.delete",
    /**
     * Supervision du classement — `20260921120000_stock_packing_admin_permission.sql`.
     * Ouvre la console `/packing-admin`. Référencée ici parce que l'encart
     * d'apprentissage de Paramètres n'affiche son lien qu'aux porteurs du droit ;
     * la console, elle, a son propre registre.
     */
    packingAdmin:  "stock.packing.admin",

} as const

// ── Statuts de balle ───────────────────────────────────────────────────────────
/**
 * Libellé et habillage d'un statut, déclarés UNE fois.
 *
 * `BalleSheet` et `LivraisonSheet` construisaient chacun leur propre table,
 * et `GESTION_THEME.card.<statut>.badge` en dupliquait les classes une
 * troisième fois. Même forme que `BALLE_STATUS_CONFIG` du stock handpick :
 * les deux modules alimentent le même composant `StatusBadge`.
 */
export const BALLE_STATUS_CONFIG: Record<BalleStatus, { label: string; className: string }> = {
    stocked:    { label: "En stock",   className: GESTION_THEME.badges.status.stocked },
    used:       { label: "Utilisée",   className: GESTION_THEME.badges.status.used },
    exported:   { label: "Exportée",   className: GESTION_THEME.badges.status.exported },
    transfered: { label: "Transférée", className: GESTION_THEME.badges.status.transfered },
    imported:   { label: "Importée",   className: GESTION_THEME.badges.status.shipped },
    delivered:  { label: "Livrée",     className: GESTION_THEME.badges.status.shipped },
    shipped:    { label: "Expédiée",   className: GESTION_THEME.badges.status.shipped },
}

// ── Arrivage manuel ────────────────────────────────────────────────────────────
export const TRANSPORT_MODES = ["40'", "COMPLET", "LCL", "40HC", "20'"] as const

export const ARRIVAGE_STATUS_CONFIG = {
    planifié:   { label: "Planifié",   className: "bg-muted text-muted-foreground border-border" },
    en_transit: { label: "En transit", className: "bg-chart-2/10 text-chart-2 border-chart-2/20" },
    déchargé:   { label: "Déchargé",   className: "bg-warning-light text-warning border-warning/20" },
    reçu:       { label: "Reçu",       className: "bg-success-light text-success border-success/20" },
    annulé:     { label: "Annulé",     className: "bg-destructive-light text-destructive border-destructive/20" },
} as const

export const ARRIVAGE_MONTHS_PER_PAGE = 3

// ── Packing list ───────────────────────────────────────────────────────────────
export const PACKING_STATUS_CONFIG = {
    en_traitement: { label: "En traitement", className: "bg-chart-2/10 text-chart-2 border-chart-2/20" },
    a_verifier:    { label: "À vérifier",    className: "bg-warning-light text-warning border-warning/20" },
    validee:       { label: "Validée",       className: "bg-success-light text-success border-success/20" },
    echec:         { label: "Échec",         className: "bg-destructive-light text-destructive border-destructive/20" },
} as const

/** Pastille du tableau : même lecture que le badge, en un point. */
export const PACKING_STATUS_DOT = {
    en_traitement: "bg-chart-2",
    a_verifier:    "bg-warning",
    validee:       "bg-success",
    echec:         "bg-destructive",
} as const

/**
 * `.xls` (format Excel 97-2003) est volontairement REFUSÉ : le service Go
 * lira les classeurs avec `excelize`, qui ne le prend pas en charge. Accepter
 * un format que le back rejettera ferait échouer l'import après l'envoi, au
 * lieu de le dire tout de suite. Les packings du fournisseur sont des `.xlsx`.
 */
export const PACKING_ACCEPTED_EXTENSIONS = [".xlsx"] as const
export const PACKING_MAX_FILE_MB = 10

/**
 * Écart relatif toléré entre les totaux saisis sur l'arrivage et ceux de la
 * packing list avant de signaler une divergence. En deçà, c'est de l'arrondi
 * de pesée, pas une erreur.
 */
export const PACKING_GAP_TOLERANCE = 0.02

/**
 * Sous ce seuil de confiance, une proposition de catégorie est affichée comme
 * incertaine. Ce n'est qu'un signal visuel : toute proposition reste à
 * confirmer.
 */
export const PACKING_LOW_CONFIDENCE = 0.6

// ── History / activity log ─────────────────────────────────────────────────────
export const GROUPING_WINDOW_MS = 120_000  // 2 minutes
export const GROUPS_PER_PAGE    = 20

// ── Pagination & display limits ────────────────────────────────────────────────
export const STOCK_PAGE_SIZE            = 10  // balle search
export const ACTIVITY_MAX_ITEMS         = 10  // sidebar activity feed
export const SETTINGS_PAGE_SIZE         = 8   // categories & fournisseurs
export const BALLE_INITIAL_LIMIT        = 40  // balle board initial load
export const BALLE_LOAD_MORE_INCREMENT  = 40  // balle board load more
export const DELIVERY_ITEMS_PER_PAGE    = 5   // delivery sheet balle list
export const SHIPMENT_PAGE_SIZES        = [10, 25, 50, 100] as const
export const SHIPMENT_DEFAULT_PAGE_SIZE = 25

// ── Data limits ────────────────────────────────────────────────────────────────
export const ACTIVITY_LOG_LIMIT   = 200  // fetch limit + realtime slice
export const HISTORY_PAGE_SIZE    = 25   // activity log pagination
export const UUID_DISPLAY_LENGTH  = 8    // truncated ID chars shown in UI
export const CALENDAR_MAX_PER_DAY = 2    // max arrivages shown per calendar day

// ── Analytics fournisseurs (vue Analyse de l'historique) ───────────────────────
/** Nombre de fournisseurs mis en avant dans les graphes du top. */
export const ANALYTICS_TOP_N = 5

/**
 * Au-delà de ce délai sans arrivage, un fournisseur est compté comme inactif —
 * candidat au nettoyage du référentiel.
 */
export const FOURNISSEUR_INACTIVE_DAYS = 90

// ── Arrivage invoice alert ─────────────────────────────────────────────────────
export const INVOICE_ALERT_DAYS = 7   // jours avant déchargement sans facture

// ── Validation ─────────────────────────────────────────────────────────────────
export const BIC_RE = /^[A-Z]{3,4}[0-9]{6,7}$/
