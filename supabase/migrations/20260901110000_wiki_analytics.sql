-- ============================================================
-- Wiki — mesure d'usage (consultations d'articles)
--
-- Contexte : le wiki n'était pas instrumenté. Les compteurs affichés en
-- gestion (total / publiés / brouillons / catégories) décrivent le stock
-- de contenu, pas son utilité. Impossible de savoir quels articles
-- servent, qui les lit, ni si les gens y reviennent.
--
-- Cette migration ajoute :
--   1. public.wiki_article_views — une ligne par ouverture d'article,
--      NOMINATIVE (user_id), enrichie à la fermeture par le temps passé
--      (dwell_ms) et l'atteinte du bas de page (completed).
--   2. public.wiki_article_views_measured — la vue qui définit, en un seul
--      endroit, ce qui compte comme consultation mesurable.
--   3. six RPC d'agrégation (SECURITY DEFINER + garde 'wiki.manage') :
--      l'agrégat est calculé en SQL, jamais en rapatriant les lignes
--      brutes — volume, et surtout confidentialité.
--   4. l'inscription de la table au dispositif de rétention existant
--      (app_logs_retention_config), à 6 mois.
--
-- Sécurité :
--   - insert  : soi-même, si 'wiki.view'
--   - update  : soi-même, et UNIQUEMENT dwell_ms/completed (GRANT colonne)
--   - select  : ses propres lignes, ou 'wiki.manage' (= voit tout)
--   - delete  : personne (purge par le job de rétention)
--
-- Idempotent : CREATE TABLE/INDEX IF NOT EXISTS, DROP POLICY IF EXISTS,
-- CREATE OR REPLACE FUNCTION, INSERT ... ON CONFLICT DO NOTHING.
-- ============================================================

-- ─── 1. Table ───
CREATE TABLE IF NOT EXISTS public.wiki_article_views (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id  uuid NOT NULL REFERENCES public.wiki_articles (id) ON DELETE CASCADE,
    -- profiles(user_id) et non auth.users : convention posée par
    -- 20260831110000_repoint_auth_users_fks_to_profiles.sql (le stub archivé
    -- survit à la suppression du compte, la trace de lecture reste lisible).
    user_id     uuid NOT NULL DEFAULT auth.uid()
                     REFERENCES public.profiles (user_id) ON DELETE CASCADE,
    viewed_at   timestamptz NOT NULL DEFAULT now(),
    -- NULL tant que l'onglet n'a pas été quitté (patch au démontage).
    dwell_ms    int,
    completed   boolean NOT NULL DEFAULT false,
    source      text NOT NULL DEFAULT 'direct'
                     CHECK (source IN ('tree', 'list', 'search', 'breadcrumb', 'direct'))
);

COMMENT ON TABLE public.wiki_article_views IS
    'Consultations d''articles du wiki (nominatif). Une ligne par ouverture ; dwell_ms/completed patchés à la fermeture. Rétention 6 mois via app_logs_retention_config.';

CREATE INDEX IF NOT EXISTS wiki_article_views_article_idx
    ON public.wiki_article_views (article_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS wiki_article_views_user_idx
    ON public.wiki_article_views (user_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS wiki_article_views_viewed_at_idx
    ON public.wiki_article_views (viewed_at DESC);

-- ─── 2. RLS ───
ALTER TABLE public.wiki_article_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wiki_article_views_insert_self" ON public.wiki_article_views;
DROP POLICY IF EXISTS "wiki_article_views_update_self" ON public.wiki_article_views;
DROP POLICY IF EXISTS "wiki_article_views_select"      ON public.wiki_article_views;

CREATE POLICY "wiki_article_views_insert_self"
    ON public.wiki_article_views
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = (SELECT auth.uid())
        AND (SELECT public.has_permission('wiki.view'::text))
    );

-- Sert uniquement à compléter sa propre ligne (dwell_ms, completed).
CREATE POLICY "wiki_article_views_update_self"
    ON public.wiki_article_views
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "wiki_article_views_select"
    ON public.wiki_article_views
    FOR SELECT TO authenticated
    USING (
        user_id = (SELECT auth.uid())
        OR (SELECT public.has_permission('wiki.manage'::text))
    );

-- La RLS filtre les LIGNES, pas les colonnes : sans ce garde-fou, la policy
-- ci-dessus laisserait un lecteur réécrire article_id / viewed_at / source de
-- ses propres consultations, donc se fabriquer un historique de lecture. Seules
-- les deux colonnes que le client a légitimement à compléter restent ouvertes.
REVOKE UPDATE ON public.wiki_article_views FROM authenticated;
GRANT UPDATE (dwell_ms, completed) ON public.wiki_article_views TO authenticated;

-- ─── 3. Ce qui compte comme consultation mesurable ───
-- Définition unique, partagée par les six RPC : une consultation compte si le
-- lecteur n'est PAS l'auteur de l'article. Sans ce filtre, le rédacteur qui
-- relit son brouillon dix fois propulse son propre article en tête du
-- classement — l'indicateur mesurerait l'activité d'écriture, pas l'usage.
-- Les lignes correspondantes restent en base : « l'auteur a rouvert son
-- article » est une information vraie, simplement pas une mesure d'audience.
--
-- security_invoker : la vue applique la RLS de l'APPELANT. Depuis les RPC
-- (SECURITY DEFINER, donc exécutées par le propriétaire) elle voit tout, ce
-- qu'il faut pour agréger ; interrogée directement par un client, elle ne rend
-- que ses propres lignes. Sans cette option, la vue serait un contournement de
-- la RLS de wiki_article_views.
DROP VIEW IF EXISTS public.wiki_article_views_measured;
CREATE VIEW public.wiki_article_views_measured
WITH (security_invoker = true) AS
SELECT v.id,
       v.article_id,
       v.user_id,
       v.viewed_at,
       v.dwell_ms,
       v.completed,
       v.source,
       a.title       AS article_title,
       a.status      AS article_status,
       a.category_id AS article_category_id
FROM public.wiki_article_views v
JOIN public.wiki_articles a ON a.id = v.article_id
-- IS DISTINCT FROM et non <> : created_by est nullable (articles importés,
-- auteur supprimé) et NULL doit compter comme « pas l'auteur ».
WHERE v.user_id IS DISTINCT FROM a.created_by;

COMMENT ON VIEW public.wiki_article_views_measured IS
    'Consultations retenues pour la mesure d''audience : les auto-consultations d''un auteur sur son propre article sont exclues.';

-- ─── 4. Garde commune aux RPC de stats ───
-- Les fonctions ci-dessous sont SECURITY DEFINER (elles contournent la RLS
-- pour agréger toutes les lignes) : le contrôle d'accès doit être explicite.
CREATE OR REPLACE FUNCTION public.wiki_stats_guard()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
    IF NOT (SELECT public.has_permission('wiki.manage'::text)) THEN
        RAISE EXCEPTION 'wiki.manage requis pour consulter les statistiques du wiki'
            USING ERRCODE = '42501';
    END IF;
END;
$fn$;

-- ─── 5. Vue d'ensemble ───
CREATE OR REPLACE FUNCTION public.wiki_stats_overview(
    p_from timestamptz,
    p_to   timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_published bigint;
    v_result    jsonb;
BEGIN
    PERFORM public.wiki_stats_guard();

    SELECT count(*) INTO v_published
    FROM public.wiki_articles WHERE status = 'published';

    SELECT jsonb_build_object(
        'views',              count(*),
        'unique_readers',     count(DISTINCT v.user_id),
        -- FILTER sur le statut : les managers consultent aussi les brouillons.
        -- Sans lui, le numérateur déborde le dénominateur et la couverture
        -- dépasse 100 %.
        'articles_viewed',    count(DISTINCT v.article_id)
                                  FILTER (WHERE v.article_status = 'published'),
        'articles_published', v_published,
        -- Part du catalogue publié qui a été lue au moins une fois.
        'coverage_rate',      CASE WHEN v_published > 0
                                   THEN round(count(DISTINCT v.article_id)
                                                  FILTER (WHERE v.article_status = 'published')::numeric
                                              * 100 / v_published, 1)
                                   ELSE 0 END,
        'avg_dwell_seconds',  COALESCE(round(avg(v.dwell_ms)
                                             FILTER (WHERE v.dwell_ms IS NOT NULL) / 1000.0, 1), 0),
        'completion_rate',    CASE WHEN count(*) > 0
                                   THEN round(count(*) FILTER (WHERE v.completed)::numeric
                                              * 100 / count(*), 1)
                                   ELSE 0 END,
        -- Rebond : ouvert puis refermé en moins de 5 s (clic sans lecture).
        'bounce_rate',        CASE WHEN count(*) FILTER (WHERE v.dwell_ms IS NOT NULL) > 0
                                   THEN round(count(*) FILTER (WHERE v.dwell_ms < 5000)::numeric
                                              * 100 / count(*) FILTER (WHERE v.dwell_ms IS NOT NULL), 1)
                                   ELSE 0 END
    ) INTO v_result
    FROM public.wiki_article_views_measured v
    WHERE v.viewed_at >= p_from AND v.viewed_at < p_to;

    RETURN v_result;
END;
$fn$;

-- ─── 6. Série temporelle (courbe) ───
CREATE OR REPLACE FUNCTION public.wiki_stats_timeseries(
    p_from timestamptz,
    p_to   timestamptz
)
RETURNS TABLE (day date, views bigint, unique_readers bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
    PERFORM public.wiki_stats_guard();

    RETURN QUERY
    -- Agrégation d'abord, jointure ensuite : un LEFT JOIN de la table de vues
    -- sur chaque jour généré relancerait un parcours par jour. generate_series
    -- reste nécessaire pour que les jours sans consultation valent 0 au lieu
    -- de trouer la courbe.
    WITH daily AS (
        SELECT date_trunc('day', v.viewed_at) AS d,
               count(*)                       AS views,
               count(DISTINCT v.user_id)      AS unique_readers
        FROM public.wiki_article_views_measured v
        WHERE v.viewed_at >= p_from AND v.viewed_at < p_to
        GROUP BY 1
    )
    SELECT g::date,
           COALESCE(daily.views, 0),
           COALESCE(daily.unique_readers, 0)
    FROM generate_series(date_trunc('day', p_from),
                         date_trunc('day', p_to - interval '1 microsecond'),
                         interval '1 day') AS g
    LEFT JOIN daily ON daily.d = g
    ORDER BY g;
END;
$fn$;

-- ─── 7. Articles les plus consultés ───
CREATE OR REPLACE FUNCTION public.wiki_stats_top_articles(
    p_from  timestamptz,
    p_to    timestamptz,
    p_limit int DEFAULT 10
)
RETURNS TABLE (
    article_id        uuid,
    title             text,
    category_id       uuid,
    status            text,
    views             bigint,
    unique_readers    bigint,
    avg_dwell_seconds numeric,
    completion_rate   numeric,
    last_viewed_at    timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
    PERFORM public.wiki_stats_guard();

    RETURN QUERY
    SELECT v.article_id,
           v.article_title,
           v.article_category_id,
           v.article_status,
           count(*),
           count(DISTINCT v.user_id),
           COALESCE(round(avg(v.dwell_ms) FILTER (WHERE v.dwell_ms IS NOT NULL) / 1000.0, 1), 0::numeric),
           round(count(*) FILTER (WHERE v.completed)::numeric * 100 / count(*), 1),
           max(v.viewed_at)
    FROM public.wiki_article_views_measured v
    WHERE v.viewed_at >= p_from AND v.viewed_at < p_to
    GROUP BY v.article_id, v.article_title, v.article_category_id, v.article_status
    ORDER BY count(*) DESC, max(v.viewed_at) DESC
    LIMIT GREATEST(p_limit, 1);
END;
$fn$;

-- ─── 8. Articles publiés jamais consultés ───
-- Le pendant actionnable du classement. Volontairement une RPC et non une
-- déduction côté client : `wiki_stats_top_articles` est plafonnée (10 lignes),
-- donc soustraire son résultat du catalogue ferait passer pour « jamais lu »
-- tout article publié classé au-delà du plafond.
CREATE OR REPLACE FUNCTION public.wiki_stats_cold_articles(
    p_from timestamptz,
    p_to   timestamptz
)
RETURNS TABLE (
    article_id  uuid,
    title       text,
    category_id uuid,
    updated_at  timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
    PERFORM public.wiki_stats_guard();

    RETURN QUERY
    SELECT a.id, a.title, a.category_id, a.updated_at
    FROM public.wiki_articles a
    WHERE a.status = 'published'
      -- Vue mesurée : un article que seul son auteur a rouvert reste froid.
      AND NOT EXISTS (
          SELECT 1
          FROM public.wiki_article_views_measured v
          WHERE v.article_id = a.id
            AND v.viewed_at >= p_from
            AND v.viewed_at <  p_to
      )
    ORDER BY a.updated_at DESC;
END;
$fn$;

-- ─── 9. Qui lit (nominatif) ───
CREATE OR REPLACE FUNCTION public.wiki_stats_readers(
    p_from  timestamptz,
    p_to    timestamptz,
    p_limit int DEFAULT 20
)
RETURNS TABLE (
    user_id       uuid,
    full_name     text,
    avatar_url    text,
    views         bigint,
    articles_read bigint,
    last_seen     timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
    PERFORM public.wiki_stats_guard();

    RETURN QUERY
    SELECT v.user_id,
           COALESCE(p.full_name, 'Utilisateur inconnu'),
           p.avatar_url,
           count(*),
           count(DISTINCT v.article_id),
           max(v.viewed_at)
    FROM public.wiki_article_views_measured v
    LEFT JOIN public.profiles p ON p.user_id = v.user_id
    WHERE v.viewed_at >= p_from AND v.viewed_at < p_to
    GROUP BY v.user_id, p.full_name, p.avatar_url
    ORDER BY count(*) DESC, max(v.viewed_at) DESC
    LIMIT GREATEST(p_limit, 1);
END;
$fn$;

-- ─── 10. Rétention (cohortes hebdomadaires) ───
-- Pour chaque semaine de première lecture (cohorte), combien de ses lecteurs
-- sont revenus k semaines plus tard. week_offset = 0 → taille de la cohorte.
CREATE OR REPLACE FUNCTION public.wiki_stats_retention(
    p_from timestamptz,
    p_to   timestamptz
)
RETURNS TABLE (cohort_week date, week_offset int, readers bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
    PERFORM public.wiki_stats_guard();

    RETURN QUERY
    WITH weeks AS (
        SELECT user_id, date_trunc('week', viewed_at) AS week
        FROM public.wiki_article_views_measured
        WHERE viewed_at >= p_from AND viewed_at < p_to
        GROUP BY user_id, date_trunc('week', viewed_at)
    ),
    cohorts AS (
        SELECT user_id, min(week) AS cohort FROM weeks GROUP BY user_id
    )
    SELECT c.cohort::date,
           (EXTRACT(EPOCH FROM (w.week - c.cohort)) / 604800)::int,
           count(DISTINCT w.user_id)
    FROM weeks w
    JOIN cohorts c ON c.user_id = w.user_id
    GROUP BY c.cohort, 2
    ORDER BY 1, 2;
END;
$fn$;

-- ─── 11. Rétention des données (RGPD) ───
-- La table s'inscrit au dispositif générique existant
-- (20260610120000_app_logs_retention.sql) : purge quotidienne par le cron
-- 'purge-old-app-logs', journal d'audit dans app_logs_retention_audit et purge
-- manuelle depuis la console manager, sans une ligne de code de plus.
--
-- 6 mois, et non les 12 mois des logs techniques : il s'agit du comportement de
-- lecture de personnes identifiées, donc d'une donnée plus sensible dont la
-- durée de conservation doit rester proportionnée à la finalité (mesurer
-- l'utilité du wiki). La période d'analyse la plus longue proposée par l'UI est
-- alignée dessus.
INSERT INTO public.app_logs_retention_config
    (table_name, date_column, retention_months, extra_filter)
VALUES
    ('wiki_article_views', 'viewed_at', 6, NULL)
ON CONFLICT (table_name) DO NOTHING;

-- Une première version de cette migration embarquait sa propre fonction de
-- purge. Elle faisait doublon avec le dispositif ci-dessus — deux chemins de
-- suppression concurrents sur la même table, dont un seul journalisé.
DROP FUNCTION IF EXISTS public.wiki_purge_old_views(int);

-- ─── 12. Droits d'exécution ───
REVOKE ALL ON FUNCTION public.wiki_stats_guard()                                       FROM public;
REVOKE ALL ON FUNCTION public.wiki_stats_overview(timestamptz, timestamptz)            FROM public;
REVOKE ALL ON FUNCTION public.wiki_stats_timeseries(timestamptz, timestamptz)          FROM public;
REVOKE ALL ON FUNCTION public.wiki_stats_top_articles(timestamptz, timestamptz, int)   FROM public;
REVOKE ALL ON FUNCTION public.wiki_stats_cold_articles(timestamptz, timestamptz)       FROM public;
REVOKE ALL ON FUNCTION public.wiki_stats_readers(timestamptz, timestamptz, int)        FROM public;
REVOKE ALL ON FUNCTION public.wiki_stats_retention(timestamptz, timestamptz)           FROM public;

GRANT EXECUTE ON FUNCTION public.wiki_stats_overview(timestamptz, timestamptz)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.wiki_stats_timeseries(timestamptz, timestamptz)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.wiki_stats_top_articles(timestamptz, timestamptz, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wiki_stats_cold_articles(timestamptz, timestamptz)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.wiki_stats_readers(timestamptz, timestamptz, int)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.wiki_stats_retention(timestamptz, timestamptz)         TO authenticated;

-- La vue n'est pas un point d'entrée client : les stats passent par les RPC.
REVOKE ALL ON public.wiki_article_views_measured FROM anon, authenticated;
