-- ============================================================
-- Rattrapage : public.annonce — définition versionnée + RLS.
-- Date: 2026-08-24
--
-- Contexte
-- --------
-- La table public.annonce a été créée via le dashboard Supabase,
-- avant l'existence du dossier migrations/. Le dépôt ne contient
-- AUCUN CREATE TABLE ni AUCUNE policy pour elle : seule
-- 20260812120000_annonce_archive.sql ajoute une colonne. Une base
-- reconstruite depuis migrations/ n'a donc pas d'annonces, et
-- l'état de sécurité réel n'est vérifiable nulle part dans le code.
--
-- Cette migration rend l'état déterministe :
--   * la structure est déclarée telle qu'elle existe réellement
--     (relevée dans src/integrations/supabase/types.ts), en
--     CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS : sur la
--     base de production elle ne touche à rien, sur une base neuve
--     elle crée la table ;
--   * les policies préexistantes sont purgées puis redéclarées.
--
-- ⚠️ AVANT D'APPLIQUER : relever l'existant. Les policies étant
--    combinées en OR, en laisser une permissive annulerait le
--    verrouillage (même précaution que
--    20260818120000_stock_settings_permissions §3).
--
--      select * from pg_policies where tablename = 'annonce';
--
-- Modèle d'accès
-- --------------
--   SELECT → tout utilisateur authentifié, mais UNIQUEMENT les
--            annonces en ligne (publiées, non expirées, non
--            archivées). Aujourd'hui le filtrage est fait dans le
--            navigateur (AnnonceCarrousel.tsx) après avoir
--            téléchargé brouillons et archives : ce qui n'est pas
--            encore publié fuite vers tous les clients.
--            Les porteurs de manager.annonce voient tout — c'est la
--            console d'administration.
--   INSERT/UPDATE/DELETE → manager.annonce.
--
-- Pas d'exigence AAL2 ici, contrairement aux policies stock : les
-- annonces s'affichent sur la page d'accueil traversée par tous les
-- utilisateurs, y compris ceux qui ne sont pas soumis à la MFA.
--
-- Le ciblage par rôle/service est ajouté par la migration suivante
-- (20260824102000), qui remplace la policy SELECT créée ici.
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

-- ─── 1. Structure (no-op sur une base où la table existe déjà) ──────────

CREATE TABLE IF NOT EXISTS public.annonce (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  timestamptz NOT NULL DEFAULT now(),
    titre       text NOT NULL,
    type        text NOT NULL,
    image       jsonb,
    description text,
    link        text,
    start_date  timestamptz NOT NULL DEFAULT now(),
    end_date    timestamptz,
    archived_at timestamptz
);

-- Rejouable sur une base créée par le dashboard, où une colonne
-- pourrait manquer.
ALTER TABLE public.annonce
    ADD COLUMN IF NOT EXISTS image       jsonb,
    ADD COLUMN IF NOT EXISTS description text,
    ADD COLUMN IF NOT EXISTS link        text,
    ADD COLUMN IF NOT EXISTS end_date    timestamptz,
    ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Reprise de l'index de 20260812120000 (une base neuve exécute les
-- deux migrations dans l'ordre, celle-ci ne fait que garantir sa
-- présence).
CREATE INDEX IF NOT EXISTS annonce_active_idx
    ON public.annonce (start_date DESC)
    WHERE archived_at IS NULL;

COMMENT ON TABLE public.annonce IS
    'Annonces affichées sur la page d''accueil. Fenêtre de diffusion '
    '[start_date, end_date] ; archived_at = masquage réversible.';

-- ─── 2. Purge des policies préexistantes (état déterministe) ────────────
-- Leurs noms sont inconnus du dépôt (table antérieure au dossier
-- migrations/) : on les énumère depuis pg_policies plutôt que de
-- deviner. Voir l'avertissement en tête de fichier.

DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'annonce'
    LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON public.annonce', pol.policyname
        );
    END LOOP;
END
$$;

-- ─── 3. Policies ────────────────────────────────────────────────────────

ALTER TABLE public.annonce ENABLE ROW LEVEL SECURITY;

-- Lecture : ce qui est effectivement en ligne, pour tout le monde.
-- `start_date <= now()` et `end_date` nulle ou future reproduisent
-- exactement isBeforeNow()/isExpired() du front, mais côté serveur.
CREATE POLICY "annonce_select" ON public.annonce
    FOR SELECT
    TO authenticated
    USING (
        (SELECT has_permission('manager.annonce'::text))
        OR (
            archived_at IS NULL
            AND start_date <= now()
            AND (end_date IS NULL OR end_date > now())
        )
    );

CREATE POLICY "annonce_insert" ON public.annonce
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT has_permission('manager.annonce'::text)));

CREATE POLICY "annonce_update" ON public.annonce
    FOR UPDATE
    TO authenticated
    USING ((SELECT has_permission('manager.annonce'::text)))
    WITH CHECK ((SELECT has_permission('manager.annonce'::text)));

CREATE POLICY "annonce_delete" ON public.annonce
    FOR DELETE
    TO authenticated
    USING ((SELECT has_permission('manager.annonce'::text)));
