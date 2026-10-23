-- ============================================================
-- Bibliothèque de réponses — permission de gestion (bibliotheque.manage)
--
-- Jusqu'ici, les tables bibliotheque_* et le bucket Storage 'bibliotheque'
-- accordaient un accès total en écriture à TOUT utilisateur authentifié
-- (aucune permission dédiée). Un audit a relevé que le bucket Storage
-- n'était pas plus restreint que les tables — ce qui rendait tout scoping
-- côté Storage seul cosmétique (un utilisateur bloqué à l'upload pouvait
-- de toute façon modifier image_url/icon_url directement via la table).
--
-- Correctif : introduction de 'bibliotheque.manage', sur le même modèle que
-- 'wiki.manage' (20260629120000_wiki.sql). Octroyée au même périmètre que
-- 'bibliotheque.view' aujourd'hui (tous les rôles/services qui l'ont déjà) —
-- personne ne perd l'accès existant, ce correctif prépare seulement le
-- terrain pour restreindre plus tard via l'admin des rôles, sans casser
-- l'usage actuel.
--
-- Portée : INSERT/UPDATE/DELETE sur les 3 tables ET sur storage.objects
-- (bucket 'bibliotheque'). SELECT reste ouvert à tout authentifié pour les
-- tables (page déjà gatée par bibliotheque.view) et public pour le bucket
-- (bucket public, images doivent être visibles par tous).
--
-- Idempotent (gardes NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================

BEGIN;

-- ── 1. Catalogue ──────────────────────────────────────────────────────────

INSERT INTO public.permissions (code, label, category)
SELECT 'bibliotheque.manage', 'Gérer la Bibliothèque (créer/modifier/supprimer)', 'bibliotheque'
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions WHERE code = 'bibliotheque.manage'
);

-- ── 2. Octroi : même périmètre que bibliotheque.view aujourd'hui ──────────

INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT rp.role_id, target.id
FROM public.roles_permissions rp
JOIN public.permissions view_perm ON view_perm.id = rp.permission_id AND view_perm.code = 'bibliotheque.view'
JOIN public.permissions target    ON target.code  = 'bibliotheque.manage'
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles_permissions x
    WHERE x.role_id = rp.role_id AND x.permission_id = target.id
);

INSERT INTO public.services_permissions (service_id, permission_id)
SELECT sp.service_id, target.id
FROM public.services_permissions sp
JOIN public.permissions view_perm ON view_perm.id = sp.permission_id AND view_perm.code = 'bibliotheque.view'
JOIN public.permissions target    ON target.code  = 'bibliotheque.manage'
WHERE NOT EXISTS (
    SELECT 1 FROM public.services_permissions x
    WHERE x.service_id = sp.service_id AND x.permission_id = target.id
);

-- ── 3. Tables : SELECT ouvert, écriture gatée sur bibliotheque.manage ─────

DROP POLICY IF EXISTS "Authenticated users — thematiques" ON bibliotheque_thematiques;
DROP POLICY IF EXISTS "Authenticated users — qas" ON bibliotheque_questions_reponses;
DROP POLICY IF EXISTS "Authenticated users — format reponses" ON bibliotheque_format_reponses;

DROP POLICY IF EXISTS "bibliotheque.view can read thematiques" ON bibliotheque_thematiques;
DROP POLICY IF EXISTS "bibliotheque.manage can write thematiques" ON bibliotheque_thematiques;
CREATE POLICY "bibliotheque.view can read thematiques"
    ON bibliotheque_thematiques FOR SELECT
    TO authenticated
    USING (true);
CREATE POLICY "bibliotheque.manage can write thematiques"
    ON bibliotheque_thematiques FOR INSERT
    TO authenticated
    WITH CHECK (public.user_has_permission(auth.uid(), 'bibliotheque.manage'));
CREATE POLICY "bibliotheque.manage can update thematiques"
    ON bibliotheque_thematiques FOR UPDATE
    TO authenticated
    USING (public.user_has_permission(auth.uid(), 'bibliotheque.manage'))
    WITH CHECK (public.user_has_permission(auth.uid(), 'bibliotheque.manage'));
CREATE POLICY "bibliotheque.manage can delete thematiques"
    ON bibliotheque_thematiques FOR DELETE
    TO authenticated
    USING (public.user_has_permission(auth.uid(), 'bibliotheque.manage'));

DROP POLICY IF EXISTS "bibliotheque.view can read qas" ON bibliotheque_questions_reponses;
CREATE POLICY "bibliotheque.view can read qas"
    ON bibliotheque_questions_reponses FOR SELECT
    TO authenticated
    USING (true);
CREATE POLICY "bibliotheque.manage can insert qas"
    ON bibliotheque_questions_reponses FOR INSERT
    TO authenticated
    WITH CHECK (public.user_has_permission(auth.uid(), 'bibliotheque.manage'));
CREATE POLICY "bibliotheque.manage can update qas"
    ON bibliotheque_questions_reponses FOR UPDATE
    TO authenticated
    USING (public.user_has_permission(auth.uid(), 'bibliotheque.manage'))
    WITH CHECK (public.user_has_permission(auth.uid(), 'bibliotheque.manage'));
CREATE POLICY "bibliotheque.manage can delete qas"
    ON bibliotheque_questions_reponses FOR DELETE
    TO authenticated
    USING (public.user_has_permission(auth.uid(), 'bibliotheque.manage'));

DROP POLICY IF EXISTS "bibliotheque.view can read format reponses" ON bibliotheque_format_reponses;
CREATE POLICY "bibliotheque.view can read format reponses"
    ON bibliotheque_format_reponses FOR SELECT
    TO authenticated
    USING (true);
CREATE POLICY "bibliotheque.manage can insert format reponses"
    ON bibliotheque_format_reponses FOR INSERT
    TO authenticated
    WITH CHECK (public.user_has_permission(auth.uid(), 'bibliotheque.manage'));
CREATE POLICY "bibliotheque.manage can update format reponses"
    ON bibliotheque_format_reponses FOR UPDATE
    TO authenticated
    USING (public.user_has_permission(auth.uid(), 'bibliotheque.manage'))
    WITH CHECK (public.user_has_permission(auth.uid(), 'bibliotheque.manage'));
CREATE POLICY "bibliotheque.manage can delete format reponses"
    ON bibliotheque_format_reponses FOR DELETE
    TO authenticated
    USING (public.user_has_permission(auth.uid(), 'bibliotheque.manage'));

-- ── 4. Bucket Storage : SELECT public, écriture gatée sur bibliotheque.manage ──

DROP POLICY IF EXISTS "Authenticated users can upload bibliotheque media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update bibliotheque media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete bibliotheque media" ON storage.objects;
-- "Anyone can view bibliotheque media" (SELECT, bucket public) : inchangée, pas de DROP nécessaire.

CREATE POLICY "bibliotheque.manage can upload bibliotheque media"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'bibliotheque'
        AND public.user_has_permission(auth.uid(), 'bibliotheque.manage')
    );

CREATE POLICY "bibliotheque.manage can update bibliotheque media"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'bibliotheque'
        AND public.user_has_permission(auth.uid(), 'bibliotheque.manage')
    );

CREATE POLICY "bibliotheque.manage can delete bibliotheque media"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'bibliotheque'
        AND public.user_has_permission(auth.uid(), 'bibliotheque.manage')
    );

-- ── 5. Bucket Storage : limite de taille + types MIME autorisés ───────────
-- Filet de sécurité serveur en complément des vérifications côté client
-- (ThematiqueFormDialog.tsx) : 8 Mo par fichier, images usuelles + SVG.

UPDATE storage.buckets
SET file_size_limit = 8388608, -- 8 Mo
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
WHERE id = 'bibliotheque';

COMMIT;
