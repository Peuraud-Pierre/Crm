-- ============================================================
-- Fix changelog RLS policies
-- Remplace les checks sur le JSON roles.permissions par
-- des checks via roles_permissions + services_permissions
-- (même source que le RPC get_user_permissions)
-- ============================================================

-- Helper : vérifie qu'un utilisateur possède un code de permission
-- via son rôle ou son service
CREATE OR REPLACE FUNCTION public.user_has_permission(p_uid uuid, p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.roles_permissions rp ON rp.role_id = pr.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE pr.user_id = p_uid
      AND p.code = p_code
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.services_permissions sp ON sp.service_id = pr.service_id
    JOIN public.permissions p ON p.id = sp.permission_id
    WHERE pr.user_id = p_uid
      AND p.code = p_code
  );
$$;

-- ============================================================
-- changelog_categories
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view changelog categories" ON public.changelog_categories;
DROP POLICY IF EXISTS "Managers can manage changelog categories" ON public.changelog_categories;

CREATE POLICY "Authenticated users can view changelog categories"
  ON public.changelog_categories FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users with manager.changelog can insert changelog categories"
  ON public.changelog_categories FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), 'manager.changelog'));

CREATE POLICY "Users with manager.changelog can update changelog categories"
  ON public.changelog_categories FOR UPDATE
  USING (public.user_has_permission(auth.uid(), 'manager.changelog'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manager.changelog'));

CREATE POLICY "Users with manager.changelog can delete changelog categories"
  ON public.changelog_categories FOR DELETE
  USING (public.user_has_permission(auth.uid(), 'manager.changelog'));

-- ============================================================
-- changelog_versions
-- ============================================================
DROP POLICY IF EXISTS "Users can view published changelog versions" ON public.changelog_versions;
DROP POLICY IF EXISTS "Managers can insert changelog versions" ON public.changelog_versions;
DROP POLICY IF EXISTS "Managers can update changelog versions" ON public.changelog_versions;
DROP POLICY IF EXISTS "Managers can delete changelog versions" ON public.changelog_versions;

CREATE POLICY "Users can view published changelog versions"
  ON public.changelog_versions FOR SELECT
  USING (
    status = 'published'
    OR public.user_has_permission(auth.uid(), 'manager.changelog')
  );

CREATE POLICY "Users with changelogs.create can insert changelog versions"
  ON public.changelog_versions FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), 'changelogs.create'));

CREATE POLICY "Users with changelogs.edit can update changelog versions"
  ON public.changelog_versions FOR UPDATE
  USING (public.user_has_permission(auth.uid(), 'changelogs.edit'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'changelogs.edit'));

CREATE POLICY "Users with changelogs.delete can delete changelog versions"
  ON public.changelog_versions FOR DELETE
  USING (public.user_has_permission(auth.uid(), 'changelogs.delete'));

-- ============================================================
-- changelog_items
-- ============================================================
DROP POLICY IF EXISTS "Users can view changelog items of visible versions" ON public.changelog_items;
DROP POLICY IF EXISTS "Managers can manage changelog items" ON public.changelog_items;

CREATE POLICY "Users can view changelog items of visible versions"
  ON public.changelog_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.changelog_versions v
      WHERE v.id = changelog_items.version_id
        AND (
          v.status = 'published'
          OR public.user_has_permission(auth.uid(), 'manager.changelog')
        )
    )
  );

CREATE POLICY "Users with manager.changelog can insert changelog items"
  ON public.changelog_items FOR INSERT
  WITH CHECK (public.user_has_permission(auth.uid(), 'manager.changelog'));

CREATE POLICY "Users with manager.changelog can update changelog items"
  ON public.changelog_items FOR UPDATE
  USING (public.user_has_permission(auth.uid(), 'manager.changelog'))
  WITH CHECK (public.user_has_permission(auth.uid(), 'manager.changelog'));

CREATE POLICY "Users with manager.changelog can delete changelog items"
  ON public.changelog_items FOR DELETE
  USING (public.user_has_permission(auth.uid(), 'manager.changelog'));
