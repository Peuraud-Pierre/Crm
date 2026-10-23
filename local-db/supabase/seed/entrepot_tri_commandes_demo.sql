-- ============================================================
-- Données de démonstration — Salle de tri et Salle de commande
--
-- Pour la présentation aux équipes (V1). À n'exécuter QUE sur une base de
-- démonstration ou de développement, APRÈS les migrations
-- 20261001100000_stock_tri.sql et 20261001110000_stock_commandes.sql.
--
-- Couvre :
--   - 3 trieurs ;
--   - 2 boutiques.
--
-- Les commandes portent des catégories du stock (`categories_gestion`) :
-- rien à ajouter ici. Commandes et livraisons de démonstration :
-- dev_demo_commandes.sql.
--
-- Idempotent : rien n'est réinséré si le code / le nom existe déjà.
--
-- ⚠️  RLS : ce script écrit directement en base. Le SQL Editor Supabase et
--     psql (rôle service) contournent la RLS. Les triggers de journal
--     écrivent avec un `user_id` NULL.
-- ============================================================

BEGIN;

INSERT INTO public.trieurs (nom)
SELECT v.nom FROM (VALUES ('Karim'), ('Lina'), ('Moussa')) AS v(nom)
WHERE NOT EXISTS (SELECT 1 FROM public.trieurs t WHERE lower(btrim(t.nom)) = lower(v.nom));

INSERT INTO public.boutiques (nom, code, adresse)
SELECT v.nom, v.code, v.adresse
FROM (VALUES
    ('Vintage Lyon',  'LYO', 'Lyon 1er'),
    ('Vintage Paris', 'PAR', 'Paris 11e')
) AS v(nom, code, adresse)
WHERE NOT EXISTS (SELECT 1 FROM public.boutiques b WHERE b.code = v.code);

COMMIT;
