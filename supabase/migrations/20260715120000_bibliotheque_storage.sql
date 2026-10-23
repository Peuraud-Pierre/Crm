-- ============================================================
-- Bibliothèque de réponses — stockage des médias de thématique
--
-- Bucket public 'bibliotheque' pour les images d'illustration et icônes
-- SVG des thématiques, téléversées depuis ThematiqueFormDialog.tsx :
--   - <slug-du-nom>.<ext>       : images d'illustration (racine du bucket)
--   - icons/<slug-du-nom>.svg   : icônes SVG (sidebar)
-- (nommage par slug, anti-collision, voir bibliothequeService.ts — le nommage
-- par uuid initialement prévu ici a été remplacé pour rester lisible)
--
-- Sécurité : accès en écriture initialement ouvert à tout utilisateur
-- authentifié, restreint depuis à la permission 'bibliotheque.manage'
-- (voir 20260715130000_bibliotheque_manage_permission.sql), lecture publique
-- (bucket public).
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
SELECT 'bibliotheque', 'bibliotheque', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'bibliotheque');

DROP POLICY IF EXISTS "Anyone can view bibliotheque media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload bibliotheque media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update bibliotheque media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete bibliotheque media" ON storage.objects;

CREATE POLICY "Anyone can view bibliotheque media"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'bibliotheque');

CREATE POLICY "Authenticated users can upload bibliotheque media"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'bibliotheque');

CREATE POLICY "Authenticated users can update bibliotheque media"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'bibliotheque');

CREATE POLICY "Authenticated users can delete bibliotheque media"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'bibliotheque');
