-- ============================================================
-- Dashboard modulaire : dispositions personnelles et gabarits
-- Date: 2026-08-24
--
-- Contexte
-- --------
-- /dashboard devient un portail composé de modules (widgets) que
-- l'utilisateur agence lui-même. Deux niveaux :
--
--   public.user_dashboard_layout      → la disposition de CHACUN
--   public.dashboard_layout_templates → le défaut d'un rôle/service
--
-- Résolution côté front, dans cet ordre :
--   disposition personnelle → gabarit du rôle → gabarit du service
--   → défauts déclarés dans le registre de widgets (code).
--
-- L'absence de ligne est partout un état valide : un nouvel
-- utilisateur reçoit le gabarit de son rôle sans qu'aucune écriture
-- n'ait eu lieu, et « Réinitialiser » se traduit par un simple DELETE
-- de sa ligne personnelle. Même parti pris que public.user_preferences
-- (20260811160000).
--
-- Forme du JSON (validée par zod au chargement, jamais supposée
-- valide : un widget disparu du registre ou devenu inaccessible est
-- ignoré silencieusement plutôt que de rendre une page blanche) :
--
--   {
--     "version": 1,
--     "items": [
--       { "instanceId": "uuid", "widgetId": "announcements.carousel",
--         "span": 12, "rows": 1, "settings": { ... } }
--     ]
--   }
--
-- `version` est là pour permettre une migration de forme côté front
-- sans toucher à la base.
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

-- ─── 1. Disposition personnelle ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_dashboard_layout (
    user_id    uuid PRIMARY KEY
                   REFERENCES auth.users (id) ON DELETE CASCADE,
    layout     jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Garde-fou minimal : on refuse un JSON qui n'a pas la forme
    -- attendue. La validation fine (widgetId connu, span dans les
    -- bornes du widget) appartient au front, qui seul connaît le
    -- registre — la base ne peut pas la faire.
    CONSTRAINT user_dashboard_layout_shape CHECK (
        jsonb_typeof(layout -> 'items') = 'array'
        AND jsonb_typeof(layout -> 'version') = 'number'
    )
);

COMMENT ON TABLE public.user_dashboard_layout IS
    'Disposition du dashboard propre à un utilisateur. Absence de '
    'ligne = il suit le gabarit de son rôle/service.';

-- ─── 2. Gabarits par rôle / service ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dashboard_layout_templates (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id    uuid REFERENCES public.roles (id) ON DELETE CASCADE,
    service_id uuid REFERENCES public.services (id) ON DELETE CASCADE,
    layout     jsonb NOT NULL,
    updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- Un gabarit cible un rôle OU un service, jamais les deux (sinon
    -- il faudrait arbitrer l'ordre de précédence à l'intérieur d'une
    -- même ligne), jamais aucun des deux (ce serait un défaut global,
    -- rôle tenu par le registre côté code).
    CONSTRAINT dashboard_layout_templates_one_target CHECK (
        (role_id IS NOT NULL AND service_id IS NULL)
        OR (role_id IS NULL AND service_id IS NOT NULL)
    ),

    CONSTRAINT dashboard_layout_templates_shape CHECK (
        jsonb_typeof(layout -> 'items') = 'array'
        AND jsonb_typeof(layout -> 'version') = 'number'
    )
);

-- Un seul gabarit par rôle et par service : la résolution front
-- attend un état, pas une liste à départager.
CREATE UNIQUE INDEX IF NOT EXISTS dashboard_layout_templates_role_uniq
    ON public.dashboard_layout_templates (role_id)
    WHERE role_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_layout_templates_service_uniq
    ON public.dashboard_layout_templates (service_id)
    WHERE service_id IS NOT NULL;

COMMENT ON TABLE public.dashboard_layout_templates IS
    'Disposition de dashboard par défaut pour un rôle ou un service. '
    'Écriture sous dashboard.templates.manage.';

-- ─── 3. updated_at automatique ──────────────────────────────────────────
-- Une seule fonction pour les deux tables : le corps est identique et
-- ne dépend pas de la relation (motif de user_preferences_set_updated_at,
-- généralisé plutôt que dupliqué).

CREATE OR REPLACE FUNCTION public.dashboard_layout_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS user_dashboard_layout_set_updated_at
    ON public.user_dashboard_layout;
CREATE TRIGGER user_dashboard_layout_set_updated_at
    BEFORE UPDATE ON public.user_dashboard_layout
    FOR EACH ROW EXECUTE FUNCTION public.dashboard_layout_set_updated_at();

DROP TRIGGER IF EXISTS dashboard_layout_templates_set_updated_at
    ON public.dashboard_layout_templates;
CREATE TRIGGER dashboard_layout_templates_set_updated_at
    BEFORE UPDATE ON public.dashboard_layout_templates
    FOR EACH ROW EXECUTE FUNCTION public.dashboard_layout_set_updated_at();

-- ─── 4. RLS — disposition personnelle ───────────────────────────────────
-- Strictement personnel, calque de public.user_preferences : aucune
-- permission applicative n'entre en jeu, un utilisateur ne lit et
-- n'écrit que sa propre ligne.

ALTER TABLE public.user_dashboard_layout ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_dashboard_layout_select" ON public.user_dashboard_layout;
DROP POLICY IF EXISTS "user_dashboard_layout_insert" ON public.user_dashboard_layout;
DROP POLICY IF EXISTS "user_dashboard_layout_update" ON public.user_dashboard_layout;
DROP POLICY IF EXISTS "user_dashboard_layout_delete" ON public.user_dashboard_layout;

CREATE POLICY "user_dashboard_layout_select" ON public.user_dashboard_layout
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_dashboard_layout_insert" ON public.user_dashboard_layout
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_dashboard_layout_update" ON public.user_dashboard_layout
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_dashboard_layout_delete" ON public.user_dashboard_layout
    FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- ─── 5. RLS — gabarits ──────────────────────────────────────────────────
-- Lecture ouverte à tout utilisateur authentifié : chacun doit
-- pouvoir résoudre le gabarit qui le concerne, et le front ne connaît
-- le rôle/service de l'utilisateur qu'après coup. Le contenu est une
-- disposition d'écran, sans donnée métier.
--
-- Écriture sous dashboard.templates.manage (20260824100000).

ALTER TABLE public.dashboard_layout_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dashboard_layout_templates_select"
    ON public.dashboard_layout_templates;
DROP POLICY IF EXISTS "dashboard_layout_templates_insert"
    ON public.dashboard_layout_templates;
DROP POLICY IF EXISTS "dashboard_layout_templates_update"
    ON public.dashboard_layout_templates;
DROP POLICY IF EXISTS "dashboard_layout_templates_delete"
    ON public.dashboard_layout_templates;

CREATE POLICY "dashboard_layout_templates_select"
    ON public.dashboard_layout_templates
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "dashboard_layout_templates_insert"
    ON public.dashboard_layout_templates
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT has_permission('dashboard.templates.manage'::text)));

CREATE POLICY "dashboard_layout_templates_update"
    ON public.dashboard_layout_templates
    FOR UPDATE TO authenticated
    USING ((SELECT has_permission('dashboard.templates.manage'::text)))
    WITH CHECK ((SELECT has_permission('dashboard.templates.manage'::text)));

CREATE POLICY "dashboard_layout_templates_delete"
    ON public.dashboard_layout_templates
    FOR DELETE TO authenticated
    USING ((SELECT has_permission('dashboard.templates.manage'::text)));
