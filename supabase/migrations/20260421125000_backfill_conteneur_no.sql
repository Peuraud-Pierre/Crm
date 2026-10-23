-- ============================================================
-- Backfill: conteneur_no ← n_conteneur pour les lignes existantes
-- Date: 2026-04-21
--
-- Historique : le parser tableau_gestion.py ne remplissait pas la
-- colonne `conteneur_no` (col M' de l'Excel) quand elle était vide,
-- alors que le numéro était présent dans `n_conteneur` (col M).
-- Résultat : toutes les lignes existantes ont conteneur_no = NULL.
--
-- Le parser est désormais corrigé (fallback sur n_conteneur). Cette
-- migration aligne les anciennes données pour que la clé UNIQUE
-- `conteneur_no` soit exploitable directement (sans COALESCE).
--
-- Contrainte : `conteneur_no TEXT UNIQUE`. L'UPDATE échouerait si
-- plusieurs lignes avaient le même n_conteneur non NULL. On regarde
-- d'abord les doublons (informatif) puis on met à jour uniquement les
-- valeurs actuellement uniques.
-- ============================================================

-- Backfill : seulement pour les n_conteneur non ambigus (pas de doublon).
UPDATE public.arrivees_departs AS target
SET    conteneur_no = UPPER(TRIM(target.n_conteneur))
WHERE  target.conteneur_no IS NULL
  AND  target.n_conteneur IS NOT NULL
  AND  TRIM(target.n_conteneur) <> ''
  AND  NOT EXISTS (
           -- Un autre row a déjà cette valeur dans conteneur_no
           SELECT 1 FROM public.arrivees_departs o
            WHERE o.id <> target.id
              AND UPPER(TRIM(o.conteneur_no)) = UPPER(TRIM(target.n_conteneur))
       )
  AND  (
           -- Le n_conteneur de ce row est unique parmi les lignes encore à backfill
           SELECT COUNT(*) FROM public.arrivees_departs c
            WHERE c.conteneur_no IS NULL
              AND UPPER(TRIM(c.n_conteneur)) = UPPER(TRIM(target.n_conteneur))
       ) = 1;
