-- ============================================================
-- Feature Wiki — base de connaissances interne
--
-- Tables :
--   - public.wiki_categories : regroupement des articles
--   - public.wiki_articles   : articles (contenu markdown, statut draft/published)
--
-- Sécurité (RLS), via le helper existant public.user_has_permission(uid, code)
-- (défini dans 20260225_fix_changelog_rls.sql) :
--   - lecture   : permission 'wiki.view'  (les non-managers ne voient que published)
--   - écriture  : permission 'wiki.manage'
--
-- Seed des permissions (idempotent, gardes NOT EXISTS) :
--   1. catalogue public.permissions
--   2. 'wiki.view'   octroyé à tous ceux qui ont déjà 'dashboard.view'
--   3. 'wiki.manage' octroyé à ceux qui ont déjà 'roles_services.view' (rôles admin)
--
-- Idempotent : CREATE TABLE IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ============================================================

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wiki_categories (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id   uuid REFERENCES public.wiki_categories (id) ON DELETE CASCADE,
    name        text NOT NULL,
    position    int  NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wiki_categories_parent_idx ON public.wiki_categories (parent_id);

CREATE TABLE IF NOT EXISTS public.wiki_articles (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id  uuid REFERENCES public.wiki_categories (id) ON DELETE SET NULL,
    title        text NOT NULL,
    slug         text,
    body         text NOT NULL DEFAULT '',
    -- Page construite par sections (blocs texte/image), ordre = ordre du tableau.
    sections     jsonb NOT NULL DEFAULT '[]'::jsonb,
    status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    position     int  NOT NULL DEFAULT 0,
    created_by   uuid,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wiki_articles_category_idx ON public.wiki_articles (category_id);
CREATE INDEX IF NOT EXISTS wiki_articles_status_idx   ON public.wiki_articles (status);

-- updated_at auto sur UPDATE
CREATE OR REPLACE FUNCTION public.wiki_articles_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wiki_articles_set_updated_at ON public.wiki_articles;
CREATE TRIGGER wiki_articles_set_updated_at
    BEFORE UPDATE ON public.wiki_articles
    FOR EACH ROW EXECUTE FUNCTION public.wiki_articles_set_updated_at();

-- ------------------------------------------------------------
-- RLS : wiki_categories
-- ------------------------------------------------------------
ALTER TABLE public.wiki_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users with wiki.view can view wiki categories" ON public.wiki_categories;
DROP POLICY IF EXISTS "Users with wiki.manage can insert wiki categories" ON public.wiki_categories;
DROP POLICY IF EXISTS "Users with wiki.manage can update wiki categories" ON public.wiki_categories;
DROP POLICY IF EXISTS "Users with wiki.manage can delete wiki categories" ON public.wiki_categories;

CREATE POLICY "Users with wiki.view can view wiki categories"
    ON public.wiki_categories FOR SELECT
    USING (public.user_has_permission(auth.uid(), 'wiki.view'));

CREATE POLICY "Users with wiki.manage can insert wiki categories"
    ON public.wiki_categories FOR INSERT
    WITH CHECK (public.user_has_permission(auth.uid(), 'wiki.manage'));

CREATE POLICY "Users with wiki.manage can update wiki categories"
    ON public.wiki_categories FOR UPDATE
    USING (public.user_has_permission(auth.uid(), 'wiki.manage'))
    WITH CHECK (public.user_has_permission(auth.uid(), 'wiki.manage'));

CREATE POLICY "Users with wiki.manage can delete wiki categories"
    ON public.wiki_categories FOR DELETE
    USING (public.user_has_permission(auth.uid(), 'wiki.manage'));

-- ------------------------------------------------------------
-- RLS : wiki_articles
-- ------------------------------------------------------------
ALTER TABLE public.wiki_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users with wiki.view can view wiki articles" ON public.wiki_articles;
DROP POLICY IF EXISTS "Users with wiki.manage can insert wiki articles" ON public.wiki_articles;
DROP POLICY IF EXISTS "Users with wiki.manage can update wiki articles" ON public.wiki_articles;
DROP POLICY IF EXISTS "Users with wiki.manage can delete wiki articles" ON public.wiki_articles;

CREATE POLICY "Users with wiki.view can view wiki articles"
    ON public.wiki_articles FOR SELECT
    USING (
        public.user_has_permission(auth.uid(), 'wiki.view')
        AND (
            status = 'published'
            OR public.user_has_permission(auth.uid(), 'wiki.manage')
        )
    );

CREATE POLICY "Users with wiki.manage can insert wiki articles"
    ON public.wiki_articles FOR INSERT
    WITH CHECK (public.user_has_permission(auth.uid(), 'wiki.manage'));

CREATE POLICY "Users with wiki.manage can update wiki articles"
    ON public.wiki_articles FOR UPDATE
    USING (public.user_has_permission(auth.uid(), 'wiki.manage'))
    WITH CHECK (public.user_has_permission(auth.uid(), 'wiki.manage'));

CREATE POLICY "Users with wiki.manage can delete wiki articles"
    ON public.wiki_articles FOR DELETE
    USING (public.user_has_permission(auth.uid(), 'wiki.manage'));

-- ------------------------------------------------------------
-- Seed des permissions
-- ------------------------------------------------------------

-- 1. Catalogue
INSERT INTO public.permissions (code, label, category)
SELECT 'wiki.view', 'Consulter le wiki', 'wiki'
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions WHERE code = 'wiki.view'
);

INSERT INTO public.permissions (code, label, category)
SELECT 'wiki.manage', 'Gérer le wiki', 'wiki'
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions WHERE code = 'wiki.manage'
);

-- 2. 'wiki.view' aux RÔLES/SERVICES disposant déjà de dashboard.view
INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM public.roles_permissions rp
JOIN public.permissions dash   ON dash.id     = rp.permission_id AND dash.code   = 'dashboard.view'
JOIN public.permissions target ON target.code = 'wiki.view'
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles_permissions x
    WHERE x.role_id = rp.role_id AND x.permission_id = target.id
);

INSERT INTO public.services_permissions (service_id, permission_id)
SELECT sp.service_id, target.id
FROM public.services_permissions sp
JOIN public.permissions dash   ON dash.id     = sp.permission_id AND dash.code   = 'dashboard.view'
JOIN public.permissions target ON target.code = 'wiki.view'
WHERE NOT EXISTS (
    SELECT 1 FROM public.services_permissions x
    WHERE x.service_id = sp.service_id AND x.permission_id = target.id
);

-- 3. 'wiki.manage' aux RÔLES/SERVICES disposant déjà de roles_services.view (= admin)
INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM public.roles_permissions rp
JOIN public.permissions adm    ON adm.id      = rp.permission_id AND adm.code    = 'roles_services.view'
JOIN public.permissions target ON target.code = 'wiki.manage'
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles_permissions x
    WHERE x.role_id = rp.role_id AND x.permission_id = target.id
);

INSERT INTO public.services_permissions (service_id, permission_id)
SELECT sp.service_id, target.id
FROM public.services_permissions sp
JOIN public.permissions adm    ON adm.id      = sp.permission_id AND adm.code    = 'roles_services.view'
JOIN public.permissions target ON target.code = 'wiki.manage'
WHERE NOT EXISTS (
    SELECT 1 FROM public.services_permissions x
    WHERE x.service_id = sp.service_id AND x.permission_id = target.id
);

-- ------------------------------------------------------------
-- Storage : bucket public 'wiki' pour les images des articles
--   - lecture  : publique (bucket public)
--   - écriture : permission 'wiki.manage'
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
SELECT 'wiki', 'wiki', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'wiki');

DROP POLICY IF EXISTS "Anyone can view wiki images" ON storage.objects;
DROP POLICY IF EXISTS "wiki.manage can upload wiki images" ON storage.objects;
DROP POLICY IF EXISTS "wiki.manage can update wiki images" ON storage.objects;
DROP POLICY IF EXISTS "wiki.manage can delete wiki images" ON storage.objects;

CREATE POLICY "Anyone can view wiki images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'wiki');

CREATE POLICY "wiki.manage can upload wiki images"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'wiki'
        AND public.user_has_permission(auth.uid(), 'wiki.manage')
    );

CREATE POLICY "wiki.manage can update wiki images"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'wiki'
        AND public.user_has_permission(auth.uid(), 'wiki.manage')
    );

CREATE POLICY "wiki.manage can delete wiki images"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'wiki'
        AND public.user_has_permission(auth.uid(), 'wiki.manage')
    );
