-- ============================================================
-- Bibliothèque de réponses — restauration des limites du bucket Storage
--
-- Contexte : 20260721120000_bibliotheque_storage_fix_500.sql avait retiré
-- file_size_limit / allowed_mime_types du bucket 'bibliotheque', sur
-- l'hypothèse que ce réglage causait les 500 "Internal Server Error" à la
-- lecture des fichiers existants.
--
-- Cette hypothèse s'est révélée FAUSSE : après avoir retiré ce réglage, les
-- mêmes fichiers renvoyaient toujours 500 (confirmé en re-testant). La cause
-- réelle se situait plus bas — au niveau du stockage physique des anciens
-- objets eux-mêmes (metadata DB saine et identique à un bucket fonctionnel,
-- mais lecture des octets réels en échec), sans lien avec file_size_limit ou
-- allowed_mime_types. Le problème a été résolu en supprimant les anciens
-- objets cassés (voir scripts/cleanup-bibliotheque-storage-orphans.sql) et en
-- réuploadant les médias via l'interface — confirmé fonctionnel.
--
-- Cette migration restaure donc le réglage d'origine : il n'a jamais été la
-- cause du problème, et sert de filet de sécurité serveur (8 Mo max, types
-- MIME limités aux formats réellement utilisés) en complément des
-- vérifications déjà faites côté client (MAX_IMAGE_SIZE_BYTES,
-- MAX_ICON_SIZE_BYTES, contrôle .svg — voir ThematiqueFormDialog.tsx).
--
-- Idempotent : peut être ré-exécutée sans effet.
-- ============================================================

BEGIN;

UPDATE storage.buckets
SET file_size_limit = 512000, -- 500 Ko
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
WHERE id = 'bibliotheque';

COMMIT;
