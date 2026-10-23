import { cn } from "@/shared/lib/utils"

export const COLUMN_NAMES = [
    "Nouveau lead",
    "En qualification",
    "En incubation",
    "RDV Decouverte",
    "RDV Achat",
    "Visio RDV",
    "Fidélisation / Client Actif",
    "Dormant",
    "No Show",
    // Ajoutée en fin de tableau (index 9) pour préserver les valeurs `collum`
    // déjà stockées en base ; l'ordre visuel est géré dans `ACQUISITION_COLS`.
    "RDV à confirmer",
]

/**
 * Colonnes dont les leads sont visibles par TOUS les utilisateurs, quel que soit
 * le propriétaire (customer/closer) :
 *   - « RDV à confirmer »  : un RDV pris sur Amelia doit pouvoir être confirmé
 *                            par n'importe quel commercial, y compris quand le
 *                            provider n'a pas été résolu et que le lead n'est
 *                            donc rattaché à personne.
 *
 * « No Show » n'en fait plus partie : elle suit le filtre Gestionnaire comme
 * les autres colonnes.
 *
 * À tenir aligné avec le RPC `get_client_column_counts`, qui applique le même
 * partage pour les badges de comptage.
 */
export const SHARED_COLUMNS: number[] = [
    COLUMN_NAMES.indexOf("RDV à confirmer"),
]

/**
 * Pool d'entrée : partagé uniquement tant que le lead n'est PAS assigné.
 * Déplacé ailleurs sans assignation, il quitte la vue des autres utilisateurs.
 */
export const UNASSIGNED_POOL_COLUMN = COLUMN_NAMES.indexOf("Nouveau lead")

export const COLUMN_TOOLTIPS: Record<string, string> = {
    "Nouveau lead": "Lead reçu via site / Insta. À contacter.",
    "En qualification": "Comprendre le besoin et l'horizon.",
    "En incubation": "Projet futur. Relance planifiée.",
    "RDV à confirmer": "Rendez-vous proposé, en attente de confirmation.",
    "RDV Decouverte": "Premier échange approfondi (Partagé).",
    "RDV Achat": "Négociation en cours (Partagé).",
    "Visio RDV": "Rendez-vous de vision ou premier test.",
    "Fidélisation / Client Actif": "Relation continue.",
    Dormant: "Relance des comptes inactifs.",
}

export const TABLE_COLUMNS_CONFIG = [
    { id: "client", label: "Client" },
    { id: "etape", label: "Étape" },
    { id: "budget", label: "Budget" },
    { id: "activite", label: "Activité" },
    { id: "contact", label: "Contact" },
    { id: "maj", label: "Dernière MAJ" },
    { id: "timer", label: "Timer" },
]

// --- HELPERS ---
export const isToday = (d: Date) =>
    d.toDateString() === new Date().toDateString()

export const isYesterday = (d: Date) => {
    const y = new Date()
    y.setDate(y.getDate() - 1)
    return d.toDateString() === y.toDateString()
}

export const isFutur = (d: Date) => {
    const today = new Date()
    today.setHours(23, 59, 59, 999)
    return d.getTime() > today.getTime()
}

export const getExperienceBgClasses = (experience?: number | string | null) => {
    if (experience == null)
        return "bg-card text-card-foreground border-border hover:bg-muted/50"

    // Les fonds ci-dessous sont des couleurs de donnée (niveau d'expérience), sombres et
    // saturées, identiques dans les deux thèmes : le contraste ne peut pas venir d'un token
    // `-foreground` (design system §12.4). `text-card-foreground` devenait quasi-noir en
    // light et rendait la carte illisible.
    // eslint-disable-next-line nokk-project/no-restricted-syntax -- texte posé sur un aplat de couleur métier : non tokenisable (design system §12.4)
    const base = "text-white border-white/20 transition-colors"
    const eString = experience.toString()

    if (eString === "+ 3 ans")
        return cn(
            base,
            // eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4)
            "bg-[#19752A] bg-[#19752A]/90 dark:bg-[#084b0c] hover:dark:bg-[#084b0c]/90"
        )
    if (eString === "1 - 3 ans")
        return cn(
            base,
            // eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4)
            "bg-[#5F1D5F] bg-[#5F1D5F]/90 dark:bg-[#2D0F2F] hover:dark:bg-[#2D0F2F]/90"
        )
    if (eString === "0 - 1 ans")
        return cn(
            base,
            // eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4)
            "bg-[#9F0000] bg-[#9F0000]/90 dark:bg-[#610202] hover:dark:bg-[#610202]/90"
        )
    if (eString === "Nouveau")
        return cn(
            base,
            // eslint-disable-next-line nokk-project/no-restricted-syntax -- couleur de donnée métier / rendu canvas : non tokenisable (design system §12.4)
            "bg-[#FFA500] bg-[#FFA500]/90 dark:bg-[#CC8400] hover:dark:bg-[#CC8400]/90"
        )
    return "bg-card text-card-foreground border-border hover:bg-muted/50"
}
