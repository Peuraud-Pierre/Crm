-- ============================================================
-- Mode maintenance : globale OU par feature — public.app_maintenance
-- Date: 2026-08-24
--
-- Contexte
-- --------
-- L'existant est une table public."Maintenance" à ligne unique
-- (id, created_at, deployement_date, message, Active), créée via le
-- dashboard Supabase : aucune migration, aucune policy versionnée,
-- un nom en PascalCase et une faute dans « deployement_date ». Elle
-- ne sait exprimer qu'un interrupteur global.
--
-- Besoin : couper une seule feature (le temps d'un correctif sur le
-- stock, d'une migration CRM…) sans fermer l'application entière.
--
-- Modèle
-- ------
--   scope = 'global'  → toute l'application, feature_key NULL
--   scope = 'feature' → une feature, feature_key NOT NULL
--
-- feature_key reprend `title` de src/shared/components/layout/menuItems.ts
-- ('stock', 'crm', 'messages'…), qui est déjà le registre central des
-- features de l'application : les routes en portent la clé dans leur
-- `handle`, la sidebar les énumère, les permissions y sont rattachées.
-- Aucune contrainte d'énumération côté base : menuItems évolue avec le
-- code, une clé obsolète est simplement sans effet (aucune route ne la
-- réclame), et un CHECK figé ici deviendrait faux à la première
-- feature ajoutée.
--
-- « Active » devient `active`, « deployement_date » devient
-- `starts_at`, et `ends_at` (nullable) permet d'annoncer une fenêtre
-- de fin.
--
-- Idempotent : ré-exécutable sans doublon. La table "Maintenance"
-- est conservée intacte — sa suppression est un geste distinct, une
-- fois le front basculé.
-- ============================================================

-- ─── 1. Table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_maintenance (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scope       text NOT NULL CHECK (scope IN ('global', 'feature')),
    feature_key text,
    active      boolean NOT NULL DEFAULT false,
    starts_at   timestamptz NOT NULL,
    ends_at     timestamptz,
    message     text,
    created_by  uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    -- Une portée 'global' n'a pas de feature ; une portée 'feature' en
    -- exige une. Empêche la ligne ambiguë (globale ET ciblée) que le
    -- front devrait sinon arbitrer.
    CONSTRAINT app_maintenance_scope_key_coherent CHECK (
        (scope = 'global' AND feature_key IS NULL)
        OR (scope = 'feature' AND feature_key IS NOT NULL)
    ),

    -- Une fenêtre qui se termine avant de commencer n'a pas de sens.
    -- La règle métier « pas de modification à moins de 12 h »
    -- (utils/timeRules.ts) reste côté applicatif : elle dépend de
    -- l'instant de l'édition, pas de la ligne.
    CONSTRAINT app_maintenance_window_ordered CHECK (
        ends_at IS NULL OR ends_at > starts_at
    )
);

-- Au plus une ligne globale, au plus une ligne par feature : le front
-- résout un état, pas une collection à fusionner. L'unicité porte sur
-- `scope`, restreinte par le WHERE aux seules lignes globales — ce qui
-- revient à « au plus une », sans recourir à un index sur expression
-- constante.
CREATE UNIQUE INDEX IF NOT EXISTS app_maintenance_global_uniq
    ON public.app_maintenance (scope)
    WHERE scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS app_maintenance_feature_uniq
    ON public.app_maintenance (feature_key)
    WHERE scope = 'feature';

COMMENT ON TABLE public.app_maintenance IS
    'Fenêtres de maintenance. scope=global coupe l''application, '
    'scope=feature coupe la seule feature feature_key (clé = title de '
    'menuItems.ts). Contournement : permission maintenance.bypass.';

-- ─── 2. updated_at automatique ──────────────────────────────────────────
-- Même motif que public.user_preferences (20260811160000).

CREATE OR REPLACE FUNCTION public.app_maintenance_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS app_maintenance_set_updated_at ON public.app_maintenance;
CREATE TRIGGER app_maintenance_set_updated_at
    BEFORE UPDATE ON public.app_maintenance
    FOR EACH ROW EXECUTE FUNCTION public.app_maintenance_set_updated_at();

-- ─── 3. Reprise de la ligne existante ───────────────────────────────────
-- Sans effet si "Maintenance" n'existe pas (base neuve) ou si une
-- ligne globale a déjà été reprise.

DO $do$
BEGIN
    IF to_regclass('public."Maintenance"') IS NULL THEN
        RAISE NOTICE 'public."Maintenance" absente — aucune reprise à faire.';
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.app_maintenance WHERE scope = 'global'
    ) THEN
        RAISE NOTICE 'Ligne globale déjà présente — reprise ignorée.';
        RETURN;
    END IF;

    EXECUTE $sql$
        INSERT INTO public.app_maintenance
            (scope, feature_key, active, starts_at, message)
        SELECT 'global', NULL,
               coalesce(m."Active", false),
               m.deployement_date,
               m.message
        FROM public."Maintenance" m
        LIMIT 1
    $sql$;
END
$do$;

-- ─── 4. RLS ─────────────────────────────────────────────────────────────
-- Lecture ouverte à tout utilisateur authentifié : l'écran de
-- maintenance et le compte à rebours du header doivent s'afficher
-- pour ceux qui sont précisément privés d'accès. Aucune donnée
-- sensible ici (une date et un message d'information).
--
-- Écriture réservée à manager.maintenance — le code qui gate déjà
-- l'onglet Maintenance de la console.

ALTER TABLE public.app_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_maintenance_select" ON public.app_maintenance;
DROP POLICY IF EXISTS "app_maintenance_insert" ON public.app_maintenance;
DROP POLICY IF EXISTS "app_maintenance_update" ON public.app_maintenance;
DROP POLICY IF EXISTS "app_maintenance_delete" ON public.app_maintenance;

CREATE POLICY "app_maintenance_select" ON public.app_maintenance
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "app_maintenance_insert" ON public.app_maintenance
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT has_permission('manager.maintenance'::text)));

CREATE POLICY "app_maintenance_update" ON public.app_maintenance
    FOR UPDATE
    TO authenticated
    USING ((SELECT has_permission('manager.maintenance'::text)))
    WITH CHECK ((SELECT has_permission('manager.maintenance'::text)));

CREATE POLICY "app_maintenance_delete" ON public.app_maintenance
    FOR DELETE
    TO authenticated
    USING ((SELECT has_permission('manager.maintenance'::text)));

-- ─── 5. Realtime ────────────────────────────────────────────────────────
-- 20260624120100_realtime_disable_config_admin.sql a retiré
-- public."Maintenance" de la publication au motif que la table change
-- rarement et que les écrans se rechargent au montage. Ce raisonnement
-- ne tient pas pour la maintenance : sa finalité est justement de
-- sortir de l'application les sessions DÉJÀ chargées. Sans Realtime,
-- activer la maintenance ne met personne dehors avant un F5, ce qui
-- est exactement ce qu'on veut éviter avant un déploiement.
--
-- Le coût est négligeable — une table de quelques lignes, écrite
-- quelques fois par mois. `annonce` et les tables changelog restent
-- volontairement hors publication.

DO $do$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'app_maintenance'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.app_maintenance;
    END IF;
END
$do$;

-- Realtime n'émet l'ancienne ligne sur UPDATE/DELETE que si l'identité
-- de réplication est complète : sans cela, un passage de active=true à
-- false ne porte pas assez d'information pour les abonnés.
ALTER TABLE public.app_maintenance REPLICA IDENTITY FULL;
