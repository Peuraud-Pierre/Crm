-- ============================================================
-- Stock Handpick — journal d'activité
-- Date: 2026-09-07
-- Dépend de : 20260914141000, 20260914142000, 20260914143000,
--             20260914144000
--
-- Contexte
-- --------
-- Journal PROPRE au module : réutiliser public.activity_log aurait
-- mélangé les deux stocks dans un même feed, imposé un filtre partout
-- et rendu impossible une RLS distincte. Table dédiée, permKey dédiée.
--
-- Deux écarts délibérés par rapport au modèle copié
-- (20260428_stock_history.sql) :
--
--   1. `changes` est construit GÉNÉRIQUEMENT (toutes les colonnes
--      modifiées), pas colonne par colonne. log_balle_activity ne
--      journalise que status / location / packing et perd
--      silencieusement le reste. Pattern repris de
--      20260601_activity_log_full_changes.sql.
--
--   2. AUCUNE policy d'écriture. RLS activée + zéro policy INSERT =
--      deny-by-default : personne ne peut forger une ligne
--      d'historique depuis le client. L'existant
--      (auth_insert_activity_log ... WITH CHECK (true)) le permet.
--      Les triggers ci-dessous sont SECURITY DEFINER et s'exécutent
--      en tant que propriétaire, qui bypasse RLS — d'où l'absence
--      VOLONTAIRE de FORCE ROW LEVEL SECURITY sur cette table.
--
-- Mapping permKey → policy :
--   SELECT → stock_handpick.history.view
--   INSERT / UPDATE / DELETE → aucune (triggers uniquement)
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

-- ─── 1. Table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.activity_log_handpick (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id      UUID        REFERENCES public.profiles(user_id) ON DELETE SET NULL,

    entity_type  TEXT        NOT NULL,
    -- TEXT et non UUID : la liaison fournisseur↔catégorie n'a pas d'id
    -- simple, son entité est identifiée par la paire.
    entity_id    TEXT,
    -- Libellé lisible figé au moment de l'action : l'entrée reste
    -- compréhensible après suppression de l'entité.
    entity_label TEXT,

    action       TEXT        NOT NULL,
    description  TEXT,
    -- { colonne: { before, after } } — uniquement les colonnes modifiées.
    changes      JSONB,

    CONSTRAINT activity_log_handpick_entity_type_valid CHECK (entity_type IN (
        'balle', 'category', 'fournisseur', 'fournisseur_category',
        'mouvement', 'zone', 'emplacement'
    )),
    CONSTRAINT activity_log_handpick_action_valid
        CHECK (action IN ('create', 'update', 'delete'))
);

CREATE INDEX IF NOT EXISTS idx_activity_log_handpick_created
    ON public.activity_log_handpick (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_handpick_entity_type
    ON public.activity_log_handpick (entity_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_handpick_entity_id
    ON public.activity_log_handpick (entity_id);

-- ─── 2. Journalisation générique ────────────────────────────────────────
-- Une seule fonction pour les cinq tables munies d'un `id`. Les arguments
-- du trigger portent ce qui varie :
--   TG_ARGV[0] = entity_type
--   TG_ARGV[1] = nom de la colonne servant de libellé lisible
--
-- SECURITY DEFINER + SET search_path = '' et appels entièrement qualifiés :
-- les fonctions historiques (log_balle_activity) omettent le search_path,
-- ce que security-review signale à juste titre. Ne pas les copier.

CREATE OR REPLACE FUNCTION public.log_handpick_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_entity_type TEXT := TG_ARGV[0];
    v_label_col   TEXT := TG_ARGV[1];
    v_action      TEXT;
    v_record      JSONB;
    v_entity_id   TEXT;
    v_label       TEXT;
    v_changes     JSONB;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_action := 'delete';
        v_record := to_jsonb(OLD);
    ELSIF TG_OP = 'INSERT' THEN
        v_action := 'create';
        v_record := to_jsonb(NEW);
    ELSE
        v_action := 'update';
        v_record := to_jsonb(NEW);

        -- Diff générique : toutes les colonnes réellement modifiées.
        -- updated_at est exclue, elle change à chaque UPDATE par
        -- construction et n'apprend rien.
        SELECT jsonb_object_agg(
                   o.key,
                   jsonb_build_object('before', o.value, 'after', n.value)
               )
        INTO v_changes
        FROM jsonb_each(to_jsonb(OLD)) o
        JOIN jsonb_each(to_jsonb(NEW)) n ON n.key = o.key
        WHERE o.value IS DISTINCT FROM n.value
          AND o.key <> 'updated_at';

        -- Rien d'autre que updated_at n'a bougé : pas de bruit dans le feed.
        IF v_changes IS NULL THEN
            RETURN NULL;
        END IF;
    END IF;

    v_entity_id := v_record ->> 'id';
    v_label     := v_record ->> v_label_col;

    INSERT INTO public.activity_log_handpick (
        user_id, entity_type, entity_id, entity_label, action, description, changes
    ) VALUES (
        auth.uid(),
        v_entity_type,
        v_entity_id,
        v_label,
        v_action,
        NULL,
        v_changes
    );

    RETURN NULL;  -- trigger AFTER : la valeur de retour est ignorée
END;
$$;

-- ─── 3. Journalisation de la liaison fournisseur ↔ catégorie ────────────
-- Table sans colonne `id` : son identité est la paire, et son libellé n'a
-- de sens qu'en résolvant les deux noms. D'où une fonction dédiée plutôt
-- qu'un contorsionnement de la générique. Pas d'UPDATE possible sur une
-- table qui n'est que sa propre clé primaire.

CREATE OR REPLACE FUNCTION public.log_handpick_fournisseur_category_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_row         RECORD;
    v_action      TEXT;
    v_fournisseur TEXT;
    v_category    TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_action := 'delete';
        v_row    := OLD;
    ELSE
        v_action := 'create';
        v_row    := NEW;
    END IF;

    SELECT f.name INTO v_fournisseur
    FROM public.fournisseurs_handpick f WHERE f.id = v_row.fournisseur_id;

    SELECT c.name INTO v_category
    FROM public.categories_handpick c WHERE c.id = v_row.category_id;

    INSERT INTO public.activity_log_handpick (
        user_id, entity_type, entity_id, entity_label, action, description, changes
    ) VALUES (
        auth.uid(),
        'fournisseur_category',
        v_row.fournisseur_id::text || ':' || v_row.category_id::text,
        COALESCE(v_fournisseur, '?') || ' → ' || COALESCE(v_category, '?'),
        v_action,
        CASE WHEN v_action = 'create'
             THEN 'Catégorie rattachée au fournisseur'
             ELSE 'Catégorie détachée du fournisseur'
        END,
        NULL
    );

    RETURN NULL;
END;
$$;

-- ─── 4. Triggers ────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS log_balles_handpick_activity ON public.balles_handpick;
CREATE TRIGGER log_balles_handpick_activity
    AFTER INSERT OR UPDATE OR DELETE ON public.balles_handpick
    FOR EACH ROW EXECUTE FUNCTION public.log_handpick_activity('balle', 'raw_name');

DROP TRIGGER IF EXISTS log_categories_handpick_activity ON public.categories_handpick;
CREATE TRIGGER log_categories_handpick_activity
    AFTER INSERT OR UPDATE OR DELETE ON public.categories_handpick
    FOR EACH ROW EXECUTE FUNCTION public.log_handpick_activity('category', 'name');

DROP TRIGGER IF EXISTS log_fournisseurs_handpick_activity ON public.fournisseurs_handpick;
CREATE TRIGGER log_fournisseurs_handpick_activity
    AFTER INSERT OR UPDATE OR DELETE ON public.fournisseurs_handpick
    FOR EACH ROW EXECUTE FUNCTION public.log_handpick_activity('fournisseur', 'name');

DROP TRIGGER IF EXISTS log_mouvements_handpick_activity ON public.mouvements_handpick;
CREATE TRIGGER log_mouvements_handpick_activity
    AFTER INSERT OR UPDATE OR DELETE ON public.mouvements_handpick
    FOR EACH ROW EXECUTE FUNCTION public.log_handpick_activity('mouvement', 'balle_label');

DROP TRIGGER IF EXISTS log_zones_handpick_activity ON public.zones_handpick;
CREATE TRIGGER log_zones_handpick_activity
    AFTER INSERT OR UPDATE OR DELETE ON public.zones_handpick
    FOR EACH ROW EXECUTE FUNCTION public.log_handpick_activity('zone', 'code');

DROP TRIGGER IF EXISTS log_emplacements_handpick_activity ON public.emplacements_handpick;
CREATE TRIGGER log_emplacements_handpick_activity
    AFTER INSERT OR UPDATE OR DELETE ON public.emplacements_handpick
    FOR EACH ROW EXECUTE FUNCTION public.log_handpick_activity('emplacement', 'code');

DROP TRIGGER IF EXISTS log_fournisseurs_categories_handpick_activity
    ON public.fournisseurs_categories_handpick;
CREATE TRIGGER log_fournisseurs_categories_handpick_activity
    AFTER INSERT OR DELETE ON public.fournisseurs_categories_handpick
    FOR EACH ROW EXECUTE FUNCTION public.log_handpick_fournisseur_category_activity();

-- ─── 5. RLS — lecture seule ─────────────────────────────────────────────

ALTER TABLE public.activity_log_handpick ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_log_handpick_select" ON public.activity_log_handpick;
CREATE POLICY "activity_log_handpick_select" ON public.activity_log_handpick
    FOR SELECT
    USING (
        has_permission('stock_handpick.history.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

-- Aucune policy INSERT / UPDATE / DELETE : voir l'en-tête du fichier.
-- Ne PAS ajouter FORCE ROW LEVEL SECURITY, cela couperait les triggers.

-- ─── 6. Realtime ────────────────────────────────────────────────────────
-- ALTER PUBLICATION ... ADD TABLE n'a pas de IF NOT EXISTS et échoue si la
-- table est déjà membre : test préalable, comme
-- 20260624120000_realtime_disable_logs_kpis.sql.
--
-- Seules les deux tables à valeur collaborative sont publiées.
-- activity_log_handpick en est VOLONTAIREMENT exclue : la migration
-- 20260624120000 a justement retiré activity_log de la publication, chaque
-- table publiée faisant décoder son WAL en continu pour tous les clients
-- connectés. Un journal append-heavy n'a rien à y faire.

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'balles_handpick',
        'mouvements_handpick'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = t
        ) THEN
            EXECUTE format(
                'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t
            );
            RAISE NOTICE 'Realtime activé pour public.%', t;
        END IF;
    END LOOP;
END;
$$;
