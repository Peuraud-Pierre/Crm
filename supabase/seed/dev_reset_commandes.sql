-- FACULTATIF depuis le 2026-10-05 : la migration fait elle-même ce nettoyage
-- quand elle détecte l'ancien modèle (section 0). Gardé pour un reset manuel.
--
-- DEV UNIQUEMENT — remplace l'ancien modèle de la salle de commande
-- (catalogue d'articles, pastilles de prix, EAN) par le nouveau (catégories
-- du stock + kg bruts, permission `stock.commandes.boutique`).
-- Commandes, livraisons, palettes et cartons saisis en dev sont PERDUS ;
-- les boutiques sont conservées. Exécuter ce script, puis le contenu de
-- supabase/migrations/20261001110000_stock_commandes.sql (la version reste
-- enregistrée dans l'historique des migrations : aucun repair nécessaire),
-- puis réaccorder `stock.commandes.boutique` depuis /administration.
BEGIN;
DROP VIEW IF EXISTS public.v_commandes_boutique;
DROP VIEW IF EXISTS public.v_commande_avancement;
DROP VIEW IF EXISTS public.v_livraisons_boutique;
DROP VIEW IF EXISTS public.v_cartons;
DROP FUNCTION IF EXISTS public.receptionner_carton(uuid, numeric, text, boolean, text);
DROP TABLE IF EXISTS public.cartons;
DROP TABLE IF EXISTS public.palettes;
DROP TABLE IF EXISTS public.livraisons_boutique;
DROP TABLE IF EXISTS public.commande_lignes;
DROP TABLE IF EXISTS public.commandes_boutique;
DROP TABLE IF EXISTS public.articles;
DROP TABLE IF EXISTS public.pastilles_prix;
DROP FUNCTION IF EXISTS public.ean13_valide(text);
-- L'ancienne permission de réception devient `stock.commandes.boutique`.
DELETE FROM public.roles_permissions    WHERE permission_id IN (SELECT id FROM public.permissions WHERE code = 'stock.commandes.receive');
DELETE FROM public.services_permissions WHERE permission_id IN (SELECT id FROM public.permissions WHERE code = 'stock.commandes.receive');
DELETE FROM public.users_permissions    WHERE permission_id IN (SELECT id FROM public.permissions WHERE code = 'stock.commandes.receive');
DELETE FROM public.permissions WHERE code = 'stock.commandes.receive';
COMMIT;
