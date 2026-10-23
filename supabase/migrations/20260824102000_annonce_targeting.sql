-- ============================================================
-- Annonces : ciblage par rôle / service, épinglage, type contraint.
-- Date: 2026-08-24
--
-- Contexte
-- --------
-- Le dashboard devient un portail personnalisé : un commercial doit
-- y voir les annonces qui le concernent, pas l'intégralité des
-- communications de l'entreprise. Aujourd'hui public.annonce n'a
-- aucune notion d'audience — le seul filtrage possible est temporel.
--
-- Modèle retenu : deux tableaux d'identifiants, l'un de rôles,
-- l'autre de services. Une annonce dont les DEUX tableaux sont vides
-- s'adresse à tout le monde (c'est le comportement actuel, donc la
-- valeur par défaut, donc une migration sans reprise de données).
-- Sinon elle est visible de qui correspond à l'un OU l'autre —
-- « les commerciaux ET le service logistique », pas l'intersection.
--
-- Le ciblage est appliqué dans la policy SELECT, pas dans le
-- navigateur : une annonce non ciblée ne descend jamais jusqu'au
-- client.
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

-- ─── 1. Colonnes ────────────────────────────────────────────────────────

ALTER TABLE public.annonce
    ADD COLUMN IF NOT EXISTS target_role_ids    uuid[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS target_service_ids uuid[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS pinned             boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.annonce.target_role_ids IS
    'Rôles destinataires. Tableau vide = tous les rôles.';
COMMENT ON COLUMN public.annonce.target_service_ids IS
    'Services destinataires. Tableau vide = tous les services.';
COMMENT ON COLUMN public.annonce.pinned IS
    'Annonce épinglée : présentée en tête du carrousel.';

-- ─── 2. Contrainte sur `type` ───────────────────────────────────────────
-- L'UI n'a jamais proposé que ces trois valeurs (Select de
-- AnnonceForm.tsx) mais la colonne est un `text` libre : rien
-- n'empêche une écriture directe d'y mettre autre chose, et le front
-- suppose partout l'union des trois.
--
-- Ajoutée NOT VALID à dessein : la contrainte s'applique à toute
-- écriture future sans faire échouer la migration sur d'éventuelles
-- lignes historiques non conformes, qu'on ne veut pas réécrire
-- silencieusement. Le bloc suivant les liste s'il y en a.
--
-- ⚠️ Après avoir traité les lignes signalées, valider la contrainte :
--      ALTER TABLE public.annonce VALIDATE CONSTRAINT annonce_type_check;

DO $$
DECLARE
    bad_count integer;
BEGIN
    SELECT count(*) INTO bad_count
    FROM public.annonce
    WHERE type IS NULL OR type NOT IN ('news', 'event', 'message');

    IF bad_count > 0 THEN
        RAISE WARNING
            'annonce.type : % ligne(s) hors de (news, event, message). '
            'Les corriger puis exécuter '
            'ALTER TABLE public.annonce VALIDATE CONSTRAINT annonce_type_check;',
            bad_count;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'annonce_type_check'
          AND conrelid = 'public.annonce'::regclass
    ) THEN
        ALTER TABLE public.annonce
            ADD CONSTRAINT annonce_type_check
            CHECK (type IN ('news', 'event', 'message'))
            NOT VALID;
    END IF;
END
$$;

-- ─── 3. Fonction de ciblage ─────────────────────────────────────────────
-- SECURITY DEFINER pour lire public.profiles sans dépendre de la RLS
-- de cette table depuis l'intérieur d'une policy. Elle ne révèle rien
-- de plus que « l'appelant appartient-il à cette audience » : les
-- tableaux lui sont passés en argument, elle ne retourne qu'un booléen
-- sur l'appelant lui-même.
--
-- STABLE : ses arguments étant des colonnes de la ligne testée, elle
-- est nécessairement évaluée ligne par ligne (pas d'InitPlan possible
-- ici, contrairement au motif (SELECT has_permission(...)) qui, lui,
-- ne dépend d'aucune colonne). L'EXISTS sur profiles porte sur
-- user_id, qui est indexé ; et la branche has_permission court-circuite
-- l'appel pour les administrateurs.

CREATE OR REPLACE FUNCTION public.annonce_targets_viewer(
    p_role_ids    uuid[],
    p_service_ids uuid[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
    SELECT
        -- Aucune audience déclarée → annonce générale.
        (
            coalesce(cardinality(p_role_ids), 0) = 0
            AND coalesce(cardinality(p_service_ids), 0) = 0
        )
        OR EXISTS (
            SELECT 1
            FROM public.profiles pr
            WHERE pr.user_id = (SELECT auth.uid())
              AND (
                  pr.role_id    = ANY(coalesce(p_role_ids,    '{}'::uuid[]))
                  OR pr.service_id = ANY(coalesce(p_service_ids, '{}'::uuid[]))
              )
        );
$function$;

-- Une fonction SECURITY DEFINER ne doit pas être exécutable par
-- n'importe qui : précédent de 20260817130000 (users_with_permission
-- permettait d'énumérer les détenteurs d'une permission).
REVOKE ALL ON FUNCTION public.annonce_targets_viewer(uuid[], uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.annonce_targets_viewer(uuid[], uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.annonce_targets_viewer(uuid[], uuid[]) TO authenticated;

-- ─── 4. Policy SELECT enrichie du ciblage ───────────────────────────────
-- Remplace celle de 20260824101000 : mêmes conditions temporelles,
-- plus l'audience.

DROP POLICY IF EXISTS "annonce_select" ON public.annonce;

CREATE POLICY "annonce_select" ON public.annonce
    FOR SELECT
    TO authenticated
    USING (
        (SELECT has_permission('manager.annonce'::text))
        OR (
            archived_at IS NULL
            AND start_date <= now()
            AND (end_date IS NULL OR end_date > now())
            AND public.annonce_targets_viewer(
                target_role_ids, target_service_ids
            )
        )
    );

-- ─── 5. Index ───────────────────────────────────────────────────────────
-- Le carrousel trie les épinglées d'abord, puis par date de début.

DROP INDEX IF EXISTS public.annonce_active_idx;
CREATE INDEX IF NOT EXISTS annonce_active_idx
    ON public.annonce (pinned DESC, start_date DESC)
    WHERE archived_at IS NULL;
