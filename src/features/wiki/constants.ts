// Valeurs statiques de la feature wiki.

export const WIKI_ARTICLE_STATUS = ["draft", "published"] as const

export const WIKI_STATUS_LABEL: Record<
    (typeof WIKI_ARTICLE_STATUS)[number],
    string
> = {
    draft: "Brouillon",
    published: "Publié",
}

// Permissions (catalogue public.permissions)
export const WIKI_PERMISSION = {
    view: "wiki.view",
    manage: "wiki.manage",
} as const

// ── Mesure d'usage ──────────────────────────────────────────────────────────

/**
 * Part de l'article à avoir fait défiler pour compter la lecture comme
 * terminée. 0.9 et non 1 : les derniers pixels ne sont jamais atteints
 * (marges, barre flottante, inertie du défilement).
 */
export const WIKI_COMPLETION_SCROLL_RATIO = 0.9

/**
 * Périodes proposées par l'onglet « Statistiques ».
 *
 * La plus longue s'arrête à 6 mois : au-delà, les consultations sont purgées
 * par le job de rétention (`app_logs_retention_config`, 6 mois), et la période
 * afficherait une chute artificielle. `shortLabel` prend le relais sous `sm`,
 * où quatre libellés complets ne tiennent pas.
 */
export const WIKI_STATS_RANGES = [
    { value: "7days", label: "7 jours", shortLabel: "7 j", days: 7 },
    { value: "30days", label: "30 jours", shortLabel: "30 j", days: 30 },
    { value: "90days", label: "90 jours", shortLabel: "90 j", days: 90 },
    { value: "6months", label: "6 mois", shortLabel: "6 m", days: 180 },
] as const

/**
 * Durée de conservation des consultations, en mois. Doit rester alignée sur
 * `app_logs_retention_config` (migration 20260901110000) — c'est la base qui
 * fait foi ; cette constante ne sert qu'à l'affichage.
 */
export const WIKI_VIEWS_RETENTION_MONTHS = 6

export type WikiStatsRangeKey = (typeof WIKI_STATS_RANGES)[number]["value"]

export const WIKI_STATS_DEFAULT_RANGE: WikiStatsRangeKey = "30days"
