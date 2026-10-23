import type { SupabaseClient } from "@supabase/supabase-js"
import { supabase } from "@/integrations/supabase/client"
import type {
    WikiColdArticle,
    WikiReader,
    WikiRetentionCell,
    WikiStatsOverview,
    WikiStatsPoint,
    WikiTopArticle,
    WikiViewSource,
} from "../types/wiki-analytics.types"

/**
 * Couche d'accès aux données de la mesure d'usage du wiki (guide Architecture
 * §5.2 : tout appel Supabase vit ici).
 *
 * Deux natures d'appels :
 *   - écriture : `wiki_article_views`, une ligne par ouverture d'article,
 *     complétée au départ (temps passé, lecture terminée) ;
 *   - lecture : les RPC `wiki_stats_*`, qui agrègent côté serveur et sont
 *     gardées par la permission `wiki.manage`. On ne rapatrie jamais les
 *     lignes brutes — volume, et confidentialité (données nominatives).
 *
 * Comme `wikiService.ts`, le client est casté : les tables `wiki_*` ne sont
 * pas encore dans `integrations/supabase/types.ts` (auto-généré). Le typage
 * applicatif est porté par `types/wiki-analytics.types.ts`.
 * **À régénérer après migration** via l'UI admin GenTypes.
 */
const db = supabase as unknown as SupabaseClient

export const wikiAnalyticsService = {
    // -------- Écriture (télémétrie de lecture) --------
    /**
     * Enregistre l'ouverture d'un article et renvoie l'id de la ligne créée,
     * à repasser à `patchView` à la fermeture.
     */
    // `async` et non le style `.then(...)` du reste de la couche service : le
    // builder Supabase renvoie un PromiseLike, sans `.catch`. Or l'appelant
    // (useWikiViewTracker) doit pouvoir avaler les échecs sans bruit.
    async recordView(articleId: string, source: WikiViewSource) {
        const { data, error } = await db
            .from("wiki_article_views")
            .insert([{ article_id: articleId, source }])
            .select("id")
            .single()
        if (error) throw error
        return (data as { id: string }).id
    },

    /** Complète une consultation : temps passé et lecture menée à son terme. */
    async patchView(
        viewId: string,
        patch: { dwell_ms: number; completed: boolean }
    ) {
        const { error } = await db
            .from("wiki_article_views")
            .update(patch)
            .eq("id", viewId)
        if (error) throw error
    },

    // -------- Lecture (agrégats, permission wiki.manage) --------
    getOverview: (from: Date, to: Date) =>
        db
            .rpc("wiki_stats_overview", {
                p_from: from.toISOString(),
                p_to: to.toISOString(),
            })
            .then(({ data, error }) => {
                if (error) throw error
                return (data ?? null) as WikiStatsOverview | null
            }),

    getTimeseries: (from: Date, to: Date) =>
        db
            .rpc("wiki_stats_timeseries", {
                p_from: from.toISOString(),
                p_to: to.toISOString(),
            })
            .then(({ data, error }) => {
                if (error) throw error
                return (data ?? []) as WikiStatsPoint[]
            }),

    getTopArticles: (from: Date, to: Date, limit = 10) =>
        db
            .rpc("wiki_stats_top_articles", {
                p_from: from.toISOString(),
                p_to: to.toISOString(),
                p_limit: limit,
            })
            .then(({ data, error }) => {
                if (error) throw error
                return (data ?? []) as WikiTopArticle[]
            }),

    getColdArticles: (from: Date, to: Date) =>
        db
            .rpc("wiki_stats_cold_articles", {
                p_from: from.toISOString(),
                p_to: to.toISOString(),
            })
            .then(({ data, error }) => {
                if (error) throw error
                return (data ?? []) as WikiColdArticle[]
            }),

    getReaders: (from: Date, to: Date, limit = 20) =>
        db
            .rpc("wiki_stats_readers", {
                p_from: from.toISOString(),
                p_to: to.toISOString(),
                p_limit: limit,
            })
            .then(({ data, error }) => {
                if (error) throw error
                return (data ?? []) as WikiReader[]
            }),

    getRetention: (from: Date, to: Date) =>
        db
            .rpc("wiki_stats_retention", {
                p_from: from.toISOString(),
                p_to: to.toISOString(),
            })
            .then(({ data, error }) => {
                if (error) throw error
                return (data ?? []) as WikiRetentionCell[]
            }),
}
