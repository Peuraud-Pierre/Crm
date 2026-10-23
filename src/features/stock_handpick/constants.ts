// ── Permissions ────────────────────────────────────────────────────────────────
/**
 * Registre des codes de permission de la feature. Tout `hasPermission(...)`
 * passe par ces constantes, jamais par un littéral en dur.
 *
 * Les codes sont créés par
 * `supabase/migrations/20260914140000_stock_handpick_permissions.sql`, qui
 * n'en attribue AUCUN : ils se donnent depuis /administration. Au premier
 * déploiement, personne ne voit le module tant que `stock_handpick.view`
 * n'a pas été accordée.
 *
 * Les migrations 20260914141000 à 20260914145000 adossent la RLS de chaque
 * table à ces mêmes codes — modifier une valeur ici sans migration
 * correspondante ouvrirait un écran vide plutôt qu'une erreur.
 */
export const STOCK_HANDPICK_PERMISSIONS = {
    /** Accès au module (gaté aussi par le router). */
    view: "stock_handpick.view",

    // Dashboard
    dashboardView: "stock_handpick.dashboard.view",

    // Inventaire (balles)
    inventaireView:   "stock_handpick.inventaire.view",
    inventaireCreate: "stock_handpick.inventaire.create",
    inventaireUpdate: "stock_handpick.inventaire.update",
    inventaireDelete: "stock_handpick.inventaire.delete",

    // Flux (arrivages / départs)
    fluxView:   "stock_handpick.flux.view",
    fluxCreate: "stock_handpick.flux.create",
    fluxUpdate: "stock_handpick.flux.update",
    fluxDelete: "stock_handpick.flux.delete",

    // Historique
    historyView: "stock_handpick.history.view",

    // Paramètres (référentiel fournisseurs / catégories)
    settingsView:   "stock_handpick.settings.view",
    settingsCreate: "stock_handpick.settings.create",
    settingsUpdate: "stock_handpick.settings.update",
    settingsDelete: "stock_handpick.settings.delete",

    // Plan de l'entrepôt (zones / emplacements)
    planView:   "stock_handpick.plan.view",
    planCreate: "stock_handpick.plan.create",
    planUpdate: "stock_handpick.plan.update",
    planDelete: "stock_handpick.plan.delete",
} as const

// ── Tables Supabase ────────────────────────────────────────────────────────────
/**
 * Noms de tables regroupés : ils n'apparaissent que dans `services/`, mais les
 * y répéter en littéral rendrait un renommage silencieusement partiel.
 */
export const HANDPICK_TABLES = {
    fournisseurs:          "fournisseurs_handpick",
    categories:            "categories_handpick",
    fournisseursCategories: "fournisseurs_categories_handpick",
    zones:                 "zones_handpick",
    emplacements:          "emplacements_handpick",
    balles:                "balles_handpick",
    /** Historique d'emplacement des balles, écrit par trigger. */
    balleEmplacements:     "balles_emplacements_handpick",
    /** Disposition du plan (JSON), ligne unique `default`. */
    planLayout:            "plan_layout_handpick",
    flux:                  "flux_handpick",
    mouvements:            "mouvements_handpick",
    activityLog:           "activity_log_handpick",
} as const

// ── Statuts exposés dans l'UI ──────────────────────────────────────────────────
/**
 * Le `CHECK` de `balles_handpick.status` accepte les 7 valeurs du stock
 * principal ; toutes n'ont pas de sens ici. L'UI n'en propose que ce
 * sous-ensemble à la saisie — les autres restent affichables si une donnée
 * historique les porte.
 */
export const BALLE_STATUS_CONFIG = {
    stocked: {
        label: "En stock",
        className: "bg-chart-1/10 text-chart-1 border-chart-1/20",
        card: {
            border: "border-chart-1/20 hover:border-chart-1/60",
            icon: "text-chart-1",
            footerBorder: "border-chart-1/10",
            statusDot: "bg-chart-1",
        },
    },
    used: {
        label: "Utilisée",
        className: "bg-chart-5/10 text-chart-5 border-chart-5/20",
        card: {
            border: "border-chart-5/20 hover:border-chart-5/60",
            icon: "text-chart-5",
            footerBorder: "border-chart-5/10",
            statusDot: "bg-chart-5",
        },
    },
    transfered: {
        label: "Transférée",
        className: "bg-chart-7/10 text-chart-7 border-chart-7/20",
        card: {
            border: "border-chart-7/20 hover:border-chart-7/60",
            icon: "text-chart-7",
            footerBorder: "border-chart-7/10",
            statusDot: "bg-chart-7",
        },
    },
    delivered: {
        label: "Livrée",
        className: "bg-chart-2/10 text-chart-2 border-chart-2/20",
        card: {
            border: "border-chart-2/20 hover:border-chart-2/60",
            icon: "text-chart-2",
            footerBorder: "border-chart-2/10",
            statusDot: "bg-chart-2",
        },
    },
    exported: {
        label: "Sortie",
        className: "bg-chart-4/10 text-chart-4 border-chart-4/20",
        card: {
            border: "border-chart-4/20 hover:border-chart-4/60",
            icon: "text-chart-4",
            footerBorder: "border-chart-4/10",
            statusDot: "bg-chart-4",
        },
    },
    imported: {
        label: "Reçue",
        className: "bg-muted text-muted-foreground border-border",
        card: {
            border: "border-border hover:border-muted-foreground/40",
            icon: "text-muted-foreground",
            footerBorder: "border-border/60",
            statusDot: "bg-muted-foreground",
        },
    },
    shipped: {
        label: "Expédiée",
        className: "bg-chart-2/10 text-chart-2 border-chart-2/20",
        card: {
            border: "border-chart-2/20 hover:border-chart-2/60",
            icon: "text-chart-2",
            footerBorder: "border-chart-2/10",
            statusDot: "bg-chart-2",
        },
    },
    // Hors saisie (absent de BALLE_STATUS_SELECTABLE) : posé par l'action
    // « Éclater » de la fiche, jamais par le formulaire.
    eclatee: {
        label: "Éclatée",
        className: "bg-destructive/10 text-destructive border-destructive/20",
        card: {
            border: "border-destructive/20 hover:border-destructive/60",
            icon: "text-destructive",
            footerBorder: "border-destructive/10",
            statusDot: "bg-destructive",
        },
    },
} as const

/** Statuts proposés à la saisie, dans l'ordre du cycle de vie observé. */
export const BALLE_STATUS_SELECTABLE = [
    "stocked", "used", "transfered", "delivered", "exported",
] as const

export const BALLE_LOCATION_LABELS = {
    reception:  "Réception",
    tri:        "Tri",
    handpick:   "Handpick",
    warehouse:  "Entrepôt",
    expedition: "Expédition",
    out:        "Sortie",
} as const

export const BALLE_EMPLACEMENT_EVENT_LABELS = {
    placed:   "Rangée",
    moved:    "Déplacée",
    removed:  "Retirée",
    borrowed: "Empruntée",
    returned: "Rendue",
} as const

export const BALLE_TYPE_LABELS = {
    push:    "Push",
    bags:    "Sacs",
    balle:   "Balle",
    palette: "Palette",
    other:   "Autre",
} as const

// ── Flux ───────────────────────────────────────────────────────────────────────
export const MOUVEMENT_DIRECTION_LABELS = {
    in:  "Arrivage",
    out: "Départ",
} as const

export const QUANTITY_UNIT_LABELS = {
    kg:     "kg",
    pieces: "pièces",
} as const

/**
 * Cycle de vie d'une expédition. Libellés et couleurs repris à l'identique du
 * stock principal (`ARRIVAGE_STATUS_CONFIG`) : les deux tableaux se lisent de la
 * même façon, un statut ne doit pas changer de couleur d'un module à l'autre.
 */
export const FLUX_STATUS_CONFIG = {
    planifié:   { label: "Planifié",   className: "bg-muted text-muted-foreground border-border" },
    en_transit: { label: "En transit", className: "bg-chart-2/10 text-chart-2 border-chart-2/20" },
    déchargé:   { label: "Déchargé",   className: "bg-warning-light text-warning border-warning/20" },
    reçu:       { label: "Reçu",       className: "bg-success-light text-success border-success/20" },
    annulé:     { label: "Annulé",     className: "bg-destructive-light text-destructive border-destructive/20" },
} as const

/** Modes de transport proposés à la saisie ; le champ reste libre en base. */
export const TRANSPORT_MODES = ["40'", "COMPLET", "LCL", "40HC", "20'"] as const

// ── Tableau des flux ───────────────────────────────────────────────────────────
/** Mois affichés par page — même densité que le tableau du stock principal. */
export const FLUX_MONTHS_PER_PAGE = 3
/** Nombre d'expéditions à venir mises en avant en ambre. */
export const UPCOMING_FLUX_COUNT = 5
/** Jours avant déchargement au-delà desquels une facture manquante alerte. */
export const INVOICE_ALERT_DAYS = 7

// ── Plan de l'entrepôt ─────────────────────────────────────────────────────────
export const ZONE_KIND_LABELS = {
    zone:    "Zone",
    allee:   "Allée",
    etagere: "Étagère",
} as const

/** Séparateur du chemin lisible d'un emplacement : « A · 01 · 3 · P02 ». */
export const EMPLACEMENT_PATH_SEPARATOR = " · "

// ── Pagination & display limits ────────────────────────────────────────────────
export const SETTINGS_PAGE_SIZE        = 8   // fournisseurs & catégories
export const BALLE_INITIAL_LIMIT       = 40  // board inventaire, premier chargement
export const BALLE_LOAD_MORE_INCREMENT = 40
export const FLUX_PAGE_SIZE            = 25  // tableaux arrivages / départs
export const FLUX_PAGE_SIZES           = [10, 25, 50, 100] as const
export const HISTORY_PAGE_SIZE         = 25

// ── Data limits ────────────────────────────────────────────────────────────────
export const ACTIVITY_LOG_LIMIT  = 200  // borne du fetch historique
/** Fenêtre de regroupement des actions d'un même utilisateur dans le feed. */
export const GROUPING_WINDOW_MS  = 120_000  // 2 minutes
/** Une balle n'ayant pas de code lisible, on affiche son UUID tronqué. */
export const UUID_DISPLAY_LENGTH = 8

// ── Realtime ───────────────────────────────────────────────────────────────────
/**
 * Les événements Supabase arrivent en rafale sur une écriture groupée
 * (un arrivage = N lignes) : on ne refetch qu'une fois la rafale passée.
 */
export const REALTIME_DEBOUNCE_MS = 500
