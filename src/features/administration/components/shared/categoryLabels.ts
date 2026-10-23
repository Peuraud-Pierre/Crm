/** Labels lisibles pour les catégories de permissions (code catégorie → FR). */
const CATEGORY_LABELS: Record<string, string> = {
    dashboard: "Accueil",
    content: "Contenu",
    messages: "Messagerie",
    messaging: "Messagerie",
    tickets: "Tickets",
    users: "Utilisateurs",
    settings: "Paramètres",
    matomo: "Matomo",
    security: "Sécurité",
    roles_services: "Rôles/Services",
    manager: "Manager",
    sorters: "Rapport de tri",
    manager_sorters: "Gestion trieurs",
    projects: "Projets",
    gestion: "Gestion Salle de tri",
    stock: "Stock",
    stock_handpick: "Stock Handpick",
    crm: "CRM",
    catalogue: "Catalogue",
    profile: "Profil",
    journalsell: "Journal de vente",
    leads_stats: "Statistiques Leads",
    veille: "Veille",
    changelogs: "Changelog",
    reports: "Signalements",
    trieur: "Trieur",
}

export function categoryLabel(label: string): string {
    return CATEGORY_LABELS[label.toLowerCase()] ?? label
}
