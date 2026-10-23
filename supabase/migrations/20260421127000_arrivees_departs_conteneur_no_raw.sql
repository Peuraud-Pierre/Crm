-- ============================================================
-- Ajout: arrivees_departs.conteneur_no_raw
-- Date: 2026-04-21
--
-- Le parser distingue désormais :
--   - conteneur_no     = code BIC/ISO 6346 validé (clé unique propre, NULL
--                        si la saisie Excel n'est pas un vrai container)
--   - conteneur_no_raw = valeur brute de la col M' telle que saisie dans
--                        l'Excel (conservée même quand non conforme :
--                        "COMPLET", "LIVRÉ PAR THOMAS", nombres simples…)
--
-- Ne rien perdre de l'Excel source reste la règle, seule la clé de
-- jointure factures ↔ arrivees_departs est désormais stricte.
-- ============================================================

ALTER TABLE public.arrivees_departs
    ADD COLUMN IF NOT EXISTS conteneur_no_raw TEXT;

COMMENT ON COLUMN public.arrivees_departs.conteneur_no_raw IS
    'Col M'' de l''Excel source, valeur brute. Contrairement à conteneur_no, '
    'elle conserve les saisies non conformes (notes, statuts) pour tracer ce '
    'qu''il y avait dans le fichier original.';

-- Backfill : pour les lignes déjà présentes, copier conteneur_no actuel
-- (avant normalisation future) dans conteneur_no_raw si vide.
-- Utile si le parser a été exécuté avant l'ajout de la colonne.
UPDATE public.arrivees_departs
SET    conteneur_no_raw = conteneur_no
WHERE  conteneur_no_raw IS NULL
  AND  conteneur_no IS NOT NULL;
