/**
 * Registre central des codes de permission consommés par la feature.
 * Tout check `hasPermission(...)` de la feature passe par ces constantes —
 * jamais par un littéral en dur.
 */
export const PROFILE_PERMISSIONS = {
    /** Accès à la page elle-même (gaté aussi par le router). */
    view: "profile.view",
    /** Donne accès à la carte Newsletter arrivages (écran Paramètres). */
    newsletterView: "stock.arrivage.newsletter.view",
} as const

/**
 * Colonnes proposées dans la newsletter arrivages. Chaque clé a une
 * permission dérivée `stock.arrivage.newsletter.<key>` : l'utilisateur ne
 * voit que les colonnes qu'il a le droit de recevoir.
 */
export const NEWSLETTER_COLUMNS = [
    { key: "status", label: "Statut" },
    { key: "fournisseur_name", label: "Fournisseur" },
    { key: "fournisseur_lieu", label: "Lieu" },
    { key: "transport_mode", label: "Mode" },
    { key: "container_no", label: "N° Conteneur" },
    { key: "internal_ref", label: "N° Interne" },
    { key: "departure_date", label: "Départ" },
    { key: "port_arrival_date", label: "Le Havre" },
    { key: "prev_dechargement_at", label: "Déchargement" },
    { key: "invoice_date", label: "Date facture" },
    { key: "total_weight_kg", label: "Poids (kg)" },
    { key: "total_qty", label: "Quantité" },
    { key: "notes", label: "Notes" },
] as const

/** Préfixe des permissions par colonne de la newsletter. */
export const NEWSLETTER_COLUMN_PERMISSION_PREFIX =
    "stock.arrivage.newsletter."
