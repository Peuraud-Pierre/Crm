-- ============================================================
-- Configuration de l'export Excel des statistiques CRM
--
-- Déporte en base la liste ordonnée des collaborateurs affichés dans
-- l'export (anciennement codée en dur dans
-- src/features/crm/components/Analytics/ExportStatsButton.tsx :
-- constantes GROUPS et NAME_BY_ID).
--
-- Une ligne = un collaborateur. Le regroupement (barres de séparation
-- colorées) se fait via group_index ; l'ordre via member_index.
-- ============================================================

-- ------------------------------------------------------------
-- Table de configuration
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_export_collaborators (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid NOT NULL,          -- = profiles.user_id (auth.uid)
    fallback_name text,                   -- nom de repli si profil non résolu
    group_index   int  NOT NULL,          -- regroupement (0, 1, 2…)
    member_index  int  NOT NULL,          -- ordre dans le groupe
    sep_after     text,                   -- NULL | 'black' | 'red' : barre après le groupe
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS analytics_export_collaborators_order_idx
    ON public.analytics_export_collaborators (group_index, member_index);

-- ------------------------------------------------------------
-- RLS : lecture pour tout utilisateur authentifié.
-- (Écriture réservée à l'administration via le dashboard Supabase /
--  service_role ; aucune policy d'écriture exposée ici.)
-- ------------------------------------------------------------
ALTER TABLE public.analytics_export_collaborators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read analytics export collaborators"
    ON public.analytics_export_collaborators;
CREATE POLICY "read analytics export collaborators"
    ON public.analytics_export_collaborators FOR SELECT
    TO authenticated
    USING (true);

-- ------------------------------------------------------------
-- Seed : reprise à l'identique de l'ancienne config GROUPS / NAME_BY_ID.
-- ------------------------------------------------------------
INSERT INTO public.analytics_export_collaborators
    (user_id, fallback_name, group_index, member_index, sep_after)
VALUES
    ('8f93efc7-a3fb-496b-a397-781ae3fc41cf', 'Nokk_project (central 1)', 0, 0, 'black'),
    ('921e5a2d-1447-4f4c-b893-2f935a996973', 'Nokk_project (central 2)', 0, 1, 'black'),
    ('2c2312cb-1cf3-4c6a-a4c6-c0a363eb9ade', 'Nokk_project (central 3)', 0, 2, 'black'),
    ('f2166860-c501-4c35-926c-fc8fb097eff5', 'Commercial A',               1, 0, NULL),
    ('998e6ec9-1a2b-4c84-ac36-e0deedb43f52', 'Commercial B',              2, 0, NULL),
    ('77f6427e-3658-47e7-80ce-d40eb31a5d8e', 'Commercial C',               2, 1, NULL)
ON CONFLICT (user_id) DO NOTHING;
