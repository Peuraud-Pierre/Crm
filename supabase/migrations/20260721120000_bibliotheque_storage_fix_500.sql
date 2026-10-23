-- ============================================================
-- Bibliothèque de réponses — correctif : lecture des médias en 500
--
-- Constat (2026-07-21) : depuis que le bucket 'bibliotheque' a reçu
-- file_size_limit / allowed_mime_types (20260715130000_bibliotheque_manage_
-- permission.sql §5), toute LECTURE d'un fichier RÉELLEMENT existant dans ce
-- bucket échoue en 500 "Internal Server Error" — vérifié en interrogeant
-- directement l'API Storage (curl-équivalent), hors navigateur :
--   - fichier inexistant  → 404 "Object not found" (normal)
--   - fichier existant    → 500 (systématique, images ET SVG)
--   - même test sur le bucket 'wiki' (pas de allowed_mime_types) → normal
--
-- Cause probable : certaines versions de storage-api (auto-hébergé) tentent
-- de revalider le type MIME réel du fichier à CHAQUE lecture dès qu'un bucket
-- a allowed_mime_types de renseigné, pas seulement à l'upload — et cette
-- revalidation plante en 500 sur ce fichier. Aucune autre différence de
-- configuration n'existe entre 'bibliotheque' (cassé) et 'wiki' (fonctionnel).
--
-- Correctif : retirer ces deux réglages, pour repasser le bucket
-- 'bibliotheque' sur la même configuration que 'wiki'. La limite de taille et
-- de type de fichier reste appliquée côté client (ThematiqueFormDialog.tsx :
-- MAX_IMAGE_SIZE_BYTES, MAX_ICON_SIZE_BYTES, vérification .svg) — la
-- protection côté serveur perd juste sa couche supplémentaire, jugée moins
-- importante que d'avoir un bucket qui fonctionne.
--
-- Idempotent : peut être ré-exécutée sans effet.
-- ============================================================

BEGIN;

UPDATE storage.buckets
SET file_size_limit = NULL,
    allowed_mime_types = NULL
WHERE id = 'bibliotheque';

COMMIT;
