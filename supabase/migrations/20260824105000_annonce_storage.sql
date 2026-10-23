-- ============================================================
-- Annonces — stockage des images (bucket 'annonces')
-- Date: 2026-08-24
--
-- Contexte
-- --------
-- Les images d'annonce sont aujourd'hui des data-URL base64 poussées
-- dans la colonne `annonce.image` (jsonb) : `AnnonceForm.tsx` lit le
-- fichier avec `FileReader.readAsDataURL` et enregistre la chaîne telle
-- quelle, sans limite de taille. Conséquences : chaque ligne pèse le
-- poids de son image (base64 = +33 %), et la liste des annonces —
-- chargée par TOUS les utilisateurs à l'ouverture de l'application —
-- transporte ces images dans la réponse SQL, sans cache HTTP possible.
--
-- Ce bucket accueille les nouvelles images. La colonne `image` reste en
-- place et continue d'accepter les deux formes :
--   - une data-URL   → annonce historique, rendue telle quelle ;
--   - un chemin      → nouvelle annonce, résolue en URL publique.
-- Aucune reprise de données n'est donc nécessaire, et rien ne casse pour
-- les annonces déjà publiées.
--
-- Sécurité : lecture publique (bucket public, comme 'bibliotheque' :
-- l'URL n'est pas devinable et le contenu est une illustration
-- d'annonce interne), écriture réservée à `manager.annonce` — la
-- permission qui gate déjà la console des annonces.
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
SELECT 'annonces', 'annonces', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'annonces');

DROP POLICY IF EXISTS "Anyone can view annonce media" ON storage.objects;
DROP POLICY IF EXISTS "annonce.manage can upload annonce media" ON storage.objects;
DROP POLICY IF EXISTS "annonce.manage can update annonce media" ON storage.objects;
DROP POLICY IF EXISTS "annonce.manage can delete annonce media" ON storage.objects;

CREATE POLICY "Anyone can view annonce media"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'annonces');

-- Écriture alignée sur la permission de la feature, et non sur « tout
-- utilisateur authentifié » comme le bucket 'bibliotheque' l'avait été
-- au départ (corrigé ensuite par 20260715130000). On part directement
-- du bon niveau.
CREATE POLICY "annonce.manage can upload annonce media"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'annonces'
        AND (SELECT has_permission('manager.annonce'::text))
    );

CREATE POLICY "annonce.manage can update annonce media"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'annonces'
        AND (SELECT has_permission('manager.annonce'::text))
    );

CREATE POLICY "annonce.manage can delete annonce media"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'annonces'
        AND (SELECT has_permission('manager.annonce'::text))
    );
