-- DEV UNIQUEMENT — remplace l'ancien modèle de la salle de tri (lignes à un
-- seul type de sortie) par le nouveau (balles + répartition).
-- Les fiches de tri saisies en dev sont PERDUES ; trieurs et types de sortie
-- sont conservés. Exécuter ce script, puis le contenu de
-- supabase/migrations/20261001100000_stock_tri.sql (la version reste
-- enregistrée dans l'historique des migrations : aucun repair nécessaire).
BEGIN;
DROP VIEW IF EXISTS public.v_fiches_tri;
DROP VIEW IF EXISTS public.v_fiches_tri_balles;
DROP FUNCTION IF EXISTS public.save_fiche_tri(jsonb, jsonb);
DROP TABLE IF EXISTS public.fiches_tri_repartition;
DROP TABLE IF EXISTS public.fiches_tri_balles;
DROP TABLE IF EXISTS public.fiches_tri_lignes;
DROP TABLE IF EXISTS public.fiches_tri;
COMMIT;
