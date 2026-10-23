-- ============================================================
-- Bibliothèque — Brief : ajout des colonnes chiffres de référence
--
-- Ajoute chiffres et chiffres_en à bibliotheque_brief.
-- Idempotent (ADD COLUMN IF NOT EXISTS).
-- ============================================================

BEGIN;

ALTER TABLE bibliotheque_brief
    ADD COLUMN IF NOT EXISTS chiffres    TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS chiffres_en TEXT NOT NULL DEFAULT '';

COMMIT;
