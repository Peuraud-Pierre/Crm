-- ============================================================
-- Bibliothèque — Format réponses : ajout des colonnes EN
--
-- Ajoute email_en, instagram_en, whatsapp_en à
-- bibliotheque_format_reponses pour stocker les formats EN.
-- Idempotent (ADD COLUMN IF NOT EXISTS).
-- ============================================================

BEGIN;

ALTER TABLE bibliotheque_format_reponses
    ADD COLUMN IF NOT EXISTS email_en     TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS instagram_en TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS whatsapp_en  TEXT NOT NULL DEFAULT '';

COMMIT;
