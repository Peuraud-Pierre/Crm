-- ============================================================
-- Bibliothèque — Renommage des colonnes reponse → brief_qr
--
-- Renomme les colonnes de la table bibliotheque_questions_reponses :
--   reponse    → brief_qr
--   reponse_en → brief_qr_en
-- ============================================================

BEGIN;

ALTER TABLE bibliotheque_questions_reponses
    RENAME COLUMN reponse    TO brief_qr;

ALTER TABLE bibliotheque_questions_reponses
    RENAME COLUMN reponse_en TO brief_qr_en;

COMMIT;
