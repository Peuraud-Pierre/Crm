-- ============================================================
-- Bibliothèque de réponses — contrainte d'unicité sur les médias de thématique
--
-- Contexte (revue 2026-07-20) : l'anti-collision de chemin Storage
-- (uploadThematiqueImage/Icon, syncThematiqueMediaNaming côté application,
-- voir bibliothequeMediaService.ts) repose sur un SELECT effectué AVANT
-- l'upload/déplacement — non atomique. L'upload d'un nouveau fichier est
-- protégé par Storage lui-même (upsert: false, conflit détectable), mais le
-- RENOMMAGE (Storage.move) n'a aucune option équivalente côté API : deux
-- renommages concurrents vers le même chemin peuvent silencieusement
-- s'écraser l'un l'autre dans le bucket.
--
-- Cette migration déplace le véritable verrou d'unicité au niveau base :
-- deux thématiques ne peuvent plus jamais référencer le même chemin
-- image_url/icon_url. Une violation de cette contrainte (23505) est
-- interceptée côté application par
-- bibliothequeMediaService.detectMediaConflict() et déclenche une
-- relocalisation + nouvelle tentative — voir
-- bibliothequeService.ts insertThematiqueWithMediaRetry /
-- patchThematiqueWithMediaRetry.
--
-- Index PARTIEL (WHERE ... <> '') : la chaîne vide représente "pas de
-- média" pour une thématique — de nombreuses thématiques peuvent légitimement
-- n'avoir ni image ni icône, la contrainte ne doit donc pas les considérer
-- comme collisionnant entre elles.
--
-- Idempotent : IF NOT EXISTS, ré-exécutable sans effet une fois appliquée.
-- ============================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS bibliotheque_thematiques_image_url_uidx
    ON public.bibliotheque_thematiques (image_url)
    WHERE image_url <> '';

CREATE UNIQUE INDEX IF NOT EXISTS bibliotheque_thematiques_icon_url_uidx
    ON public.bibliotheque_thematiques (icon_url)
    WHERE icon_url <> '';

COMMIT;
