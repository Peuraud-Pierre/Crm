-- ============================================================
-- RLS granulaires pour watch_config
-- ============================================================
-- Date: 2026-03-13
-- Remplace l'ancienne policy "Admin" (ALL) par des policies
-- granulaires utilisant has_permission() existant.
-- Ajoute la permission veille.manage pour les services.
-- ============================================================

-- 1. Nouvelle permission
INSERT INTO public.permissions (code, label, category)
VALUES ('veille.manage', 'Gérer ses configurations de veille', 'veille')
ON CONFLICT (code) DO NOTHING;

-- 2. Supprimer l'ancienne policy ALL
DROP POLICY IF EXISTS "Admin" ON public.watch_config;

-- 3. SELECT : admin voit tout, view/manage voient les configs de leur service
CREATE POLICY "watch_config_select" ON public.watch_config
  FOR SELECT
  USING (
    has_permission('veille.admin')
    OR (
      (has_permission('veille.view') OR has_permission('veille.manage'))
      AND (
        service_ids IS NULL
        OR (SELECT service_id FROM public.profiles WHERE user_id = auth.uid()) = ANY(service_ids)
      )
    )
  );

-- 4. INSERT : admin peut tout, manage peut créer pour son service
CREATE POLICY "watch_config_insert" ON public.watch_config
  FOR INSERT
  WITH CHECK (
    has_permission('veille.admin')
    OR (
      has_permission('veille.manage')
      AND service_ids IS NOT NULL
      AND (SELECT service_id FROM public.profiles WHERE user_id = auth.uid()) = ANY(service_ids)
    )
  );

-- 5. UPDATE : admin peut tout, manage peut modifier les configs de son service
CREATE POLICY "watch_config_update" ON public.watch_config
  FOR UPDATE
  USING (
    has_permission('veille.admin')
    OR (
      has_permission('veille.manage')
      AND service_ids IS NOT NULL
      AND (SELECT service_id FROM public.profiles WHERE user_id = auth.uid()) = ANY(service_ids)
    )
  )
  WITH CHECK (
    has_permission('veille.admin')
    OR (
      has_permission('veille.manage')
      AND service_ids IS NOT NULL
      AND (SELECT service_id FROM public.profiles WHERE user_id = auth.uid()) = ANY(service_ids)
    )
  );

-- 6. DELETE : admin peut tout, manage peut supprimer les configs de son service
CREATE POLICY "watch_config_delete" ON public.watch_config
  FOR DELETE
  USING (
    has_permission('veille.admin')
    OR (
      has_permission('veille.manage')
      AND service_ids IS NOT NULL
      AND (SELECT service_id FROM public.profiles WHERE user_id = auth.uid()) = ANY(service_ids)
    )
  );
