-- ============================================================
-- Changelog Normalization Migration
-- Migrates from single JSONB "Changelog" table to normalized
-- changelog_categories + changelog_versions + changelog_items
-- ============================================================

-- 1. Enum for version status
CREATE TYPE public.changelog_version_status AS ENUM ('draft', 'published', 'archived');

-- 2. changelog_categories
CREATE TABLE public.changelog_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6366f1',
  icon text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.changelog_categories (name, color, icon, position) VALUES
  ('Ajouts',        '#22c55e', 'plus-circle',  0),
  ('Corrections',   '#f59e0b', 'wrench',       1),
  ('Modifications', '#3b82f6', 'refresh-cw',   2),
  ('Suppressions',  '#ef4444', 'trash-2',      3);

-- 3. changelog_versions
CREATE TABLE public.changelog_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  deployment_date timestamptz,
  status public.changelog_version_status NOT NULL DEFAULT 'draft',
  summary text,
  created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. changelog_items
CREATE TABLE public.changelog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.changelog_versions(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.changelog_categories(id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Indexes
CREATE INDEX changelog_versions_status_idx ON public.changelog_versions(status);
CREATE INDEX changelog_versions_deployment_date_idx ON public.changelog_versions(deployment_date);
CREATE INDEX changelog_items_version_id_idx ON public.changelog_items(version_id);
CREATE INDEX changelog_items_category_id_idx ON public.changelog_items(category_id);
CREATE INDEX changelog_categories_position_idx ON public.changelog_categories(position);

-- 6. Enable RLS
ALTER TABLE public.changelog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changelog_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.changelog_items ENABLE ROW LEVEL SECURITY;

-- 7. RLS - changelog_categories
CREATE POLICY "Anyone can view changelog categories"
  ON public.changelog_categories FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Managers can manage changelog categories"
  ON public.changelog_categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.user_id = auth.uid()
        AND (r.permissions->'manager'->>'changelog')::boolean = true
    )
  );

-- 8. RLS - changelog_versions
CREATE POLICY "Users can view published changelog versions"
  ON public.changelog_versions FOR SELECT
  USING (
    status = 'published'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.user_id = auth.uid()
        AND (r.permissions->'manager'->>'changelog')::boolean = true
    )
  );

CREATE POLICY "Managers can insert changelog versions"
  ON public.changelog_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.user_id = auth.uid()
        AND (r.permissions->'changelogs'->>'create')::boolean = true
    )
  );

CREATE POLICY "Managers can update changelog versions"
  ON public.changelog_versions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.user_id = auth.uid()
        AND (r.permissions->'changelogs'->>'edit')::boolean = true
    )
  );

CREATE POLICY "Managers can delete changelog versions"
  ON public.changelog_versions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.user_id = auth.uid()
        AND (r.permissions->'changelogs'->>'delete')::boolean = true
    )
  );

-- 9. RLS - changelog_items
CREATE POLICY "Users can view changelog items of visible versions"
  ON public.changelog_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.changelog_versions v
      WHERE v.id = changelog_items.version_id
        AND (
          v.status = 'published'
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.roles r ON r.id = p.role_id
            WHERE p.user_id = auth.uid()
              AND (r.permissions->'manager'->>'changelog')::boolean = true
          )
        )
    )
  );

CREATE POLICY "Managers can manage changelog items"
  ON public.changelog_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.user_id = auth.uid()
        AND (r.permissions->'manager'->>'changelog')::boolean = true
    )
  );

-- 10. Data migration from old "Changelog" table
DO $$
DECLARE
  rec RECORD;
  new_version_id uuid;
  cat_ajouts_id uuid;
  cat_corrections_id uuid;
  cat_modifications_id uuid;
  cat_suppressions_id uuid;
  item jsonb;
  pos integer;
BEGIN
  SELECT id INTO cat_ajouts_id FROM public.changelog_categories WHERE name = 'Ajouts';
  SELECT id INTO cat_corrections_id FROM public.changelog_categories WHERE name = 'Corrections';
  SELECT id INTO cat_modifications_id FROM public.changelog_categories WHERE name = 'Modifications';
  SELECT id INTO cat_suppressions_id FROM public.changelog_categories WHERE name = 'Suppressions';

  FOR rec IN SELECT * FROM public."Changelog" ORDER BY created_at ASC
  LOOP
    INSERT INTO public.changelog_versions (id, version, deployment_date, status, created_at)
    VALUES (rec.id, rec.version, rec.deployement_date, 'published', rec.created_at)
    RETURNING id INTO new_version_id;

    -- Migrate ajouts
    pos := 0;
    IF rec.content IS NOT NULL AND rec.content->'ajouts' IS NOT NULL THEN
      FOR item IN SELECT * FROM jsonb_array_elements(rec.content->'ajouts')
      LOOP
        INSERT INTO public.changelog_items (version_id, category_id, title, description, position)
        VALUES (new_version_id, cat_ajouts_id, item->>'titre', item->>'contenu', pos);
        pos := pos + 1;
      END LOOP;
    END IF;

    -- Migrate fixes -> Corrections
    pos := 0;
    IF rec.content IS NOT NULL AND rec.content->'fixes' IS NOT NULL THEN
      FOR item IN SELECT * FROM jsonb_array_elements(rec.content->'fixes')
      LOOP
        INSERT INTO public.changelog_items (version_id, category_id, title, description, position)
        VALUES (new_version_id, cat_corrections_id, item->>'titre', item->>'contenu', pos);
        pos := pos + 1;
      END LOOP;
    END IF;

    -- Migrate modifications
    pos := 0;
    IF rec.content IS NOT NULL AND rec.content->'modifications' IS NOT NULL THEN
      FOR item IN SELECT * FROM jsonb_array_elements(rec.content->'modifications')
      LOOP
        INSERT INTO public.changelog_items (version_id, category_id, title, description, position)
        VALUES (new_version_id, cat_modifications_id, item->>'titre', item->>'contenu', pos);
        pos := pos + 1;
      END LOOP;
    END IF;

    -- Migrate suppressions
    pos := 0;
    IF rec.content IS NOT NULL AND rec.content->'suppressions' IS NOT NULL THEN
      FOR item IN SELECT * FROM jsonb_array_elements(rec.content->'suppressions')
      LOOP
        INSERT INTO public.changelog_items (version_id, category_id, title, description, position)
        VALUES (new_version_id, cat_suppressions_id, item->>'titre', item->>'contenu', pos);
        pos := pos + 1;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- 11. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.changelog_versions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.changelog_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.changelog_categories;
