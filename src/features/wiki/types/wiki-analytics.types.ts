// Contrats TypeScript du domaine « mesure d'usage du wiki ».
// Table public.wiki_article_views + RPC wiki_stats_* (migration
// 20260901110000_wiki_analytics.sql).

/** D'où l'article a été ouvert — permet de juger les points d'entrée. */
export type WikiViewSource =
    | "tree"
    | "list"
    | "search"
    | "breadcrumb"
    | "direct"

/** Ligne brute de consultation (insérée à l'ouverture, complétée à la sortie). */
export interface WikiArticleView {
    id: string
    article_id: string
    user_id: string
    viewed_at: string
    /** Temps passé sur l'article, en millisecondes. `null` tant qu'il est ouvert. */
    dwell_ms: number | null
    /** L'utilisateur a atteint le bas de l'article. */
    completed: boolean
    source: WikiViewSource
}

/** Agrégat global de la période (RPC `wiki_stats_overview`). */
export interface WikiStatsOverview {
    views: number
    unique_readers: number
    articles_viewed: number
    articles_published: number
    /** % du catalogue publié lu au moins une fois. */
    coverage_rate: number
    avg_dwell_seconds: number
    /** % de consultations menées jusqu'au bas de l'article. */
    completion_rate: number
    /** % de consultations refermées en moins de 5 s (clic sans lecture). */
    bounce_rate: number
}

/** Un point de la courbe (RPC `wiki_stats_timeseries`). */
export interface WikiStatsPoint {
    day: string
    views: number
    unique_readers: number
}

/** Une ligne du classement des articles (RPC `wiki_stats_top_articles`). */
export interface WikiTopArticle {
    article_id: string
    title: string
    category_id: string | null
    status: string
    views: number
    unique_readers: number
    avg_dwell_seconds: number
    completion_rate: number
    last_viewed_at: string
}

/**
 * Un article publié que personne n'a ouvert sur la période
 * (RPC `wiki_stats_cold_articles`).
 */
export interface WikiColdArticle {
    article_id: string
    title: string
    category_id: string | null
    updated_at: string
}

/** Un lecteur et son activité sur la période (RPC `wiki_stats_readers`). */
export interface WikiReader {
    user_id: string
    full_name: string
    avatar_url: string | null
    views: number
    articles_read: number
    last_seen: string
}

/** Une case de la matrice de cohortes (RPC `wiki_stats_retention`). */
export interface WikiRetentionCell {
    cohort_week: string
    /** Nombre de semaines écoulées depuis la première lecture (0 = cohorte). */
    week_offset: number
    readers: number
}

/** Bornes de la période analysée. */
export interface WikiStatsRange {
    from: Date
    to: Date
}

/** Jeu complet de statistiques affiché par l'onglet « Statistiques ». */
export interface WikiStats {
    overview: WikiStatsOverview | null
    timeseries: WikiStatsPoint[]
    topArticles: WikiTopArticle[]
    coldArticles: WikiColdArticle[]
    readers: WikiReader[]
    retention: WikiRetentionCell[]
}
