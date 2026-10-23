-- Magasins : plan importé (PDF ou photo) à décalquer.
-- Dépend de 20261007100000_magasins. Mêmes droits que le reste du module
-- (magasin.view / update, session MFA). Idempotent.

-- ─── 1. Plan importé et son calage, sur le magasin ──────────────────────
-- Image du bucket `magasin-plans` (un PDF est converti en PNG par le
-- navigateur avant l'envoi), calée en mètres dans le repère du plan.
ALTER TABLE public.magasins
    ADD COLUMN IF NOT EXISTS fond_path TEXT,
    ADD COLUMN IF NOT EXISTS fond_x NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS fond_y NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS fond_largeur NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS fond_profondeur NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS fond_opacite NUMERIC(3,2) NOT NULL DEFAULT 0.5;

-- ─── 2. Retrait du plan d'évacuation ────────────────────────────────────
-- Une première version de cette migration créait un plan d'évacuation,
-- abandonné le 2026-10-08 avant toute mise en service. Sur une base où elle
-- a été exécutée, on retire ses objets ; ailleurs, ces lignes ne font rien.
DROP TABLE IF EXISTS public.securite_magasin;
DROP TABLE IF EXISTS public.cheminements_magasin;
ALTER TABLE public.magasins
    DROP COLUMN IF EXISTS point_rassemblement,
    DROP COLUMN IF EXISTS consignes_evacuation;

-- ─── 3. Bucket des plans importés ───────────────────────────────────────
-- Privé : lecture par URL signée. Chemin « <magasin_id>/fond-<horodatage>.png ».
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('magasin-plans', 'magasin-plans', false, 10485760,
        ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE
    SET public = false,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "magasin_plans_select" ON storage.objects;
CREATE POLICY "magasin_plans_select" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'magasin-plans'
           AND (SELECT has_permission('magasin.view'::text)) AND (SELECT auth_session_is_aal2()));
DROP POLICY IF EXISTS "magasin_plans_insert" ON storage.objects;
CREATE POLICY "magasin_plans_insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'magasin-plans'
                AND (SELECT has_permission('magasin.update'::text)) AND (SELECT auth_session_is_aal2()));
DROP POLICY IF EXISTS "magasin_plans_delete" ON storage.objects;
CREATE POLICY "magasin_plans_delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'magasin-plans'
           AND (SELECT has_permission('magasin.update'::text)) AND (SELECT auth_session_is_aal2()));

NOTIFY pgrst, 'reload schema';
