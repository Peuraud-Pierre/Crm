-- ============================================================
-- Données de démonstration — Salle de commande (V1 refondue)
--
-- DEV / DÉMO UNIQUEMENT, après 20261001110000_stock_commandes.sql. Il faut
-- au moins trois catégories dans le stock (`categories_gestion`).
--
-- Rejouable : les commandes et livraisons de démonstration (`created_by IS
-- NULL`, celles d'un script) sont d'abord supprimées, puis recréées.
--
-- Couvre, pour essayer les deux espaces :
--   * Vintage Lyon  — une commande en cours dont une livraison est EXPÉDIÉE
--     (6 cartons à réceptionner au scan), et une commande tout juste passée
--     par la boutique (encore modifiable par elle) ;
--   * Vintage Paris — une commande dont la livraison est EN PRÉPARATION à
--     l'entrepôt (cartons ajoutés, pas encore partie).
--
-- ⚠️  RLS : écrit directement en base (SQL Editor, psql) ; les triggers de
--     journal écrivent avec un `user_id` NULL.
-- ============================================================

BEGIN;

INSERT INTO public.boutiques (nom, code, adresse)
SELECT v.nom, v.code, v.adresse
FROM (VALUES
    ('Vintage Lyon',  'LYO', 'Lyon 1er'),
    ('Vintage Paris', 'PAR', 'Paris 11e')
) AS v(nom, code, adresse)
WHERE NOT EXISTS (SELECT 1 FROM public.boutiques b WHERE b.code = v.code);

DELETE FROM public.livraisons_boutique WHERE created_by IS NULL;
DELETE FROM public.commandes_boutique  WHERE created_by IS NULL;

DO $$
DECLARE
    v_lyo   uuid := (SELECT id FROM public.boutiques WHERE code = 'LYO');
    v_par   uuid := (SELECT id FROM public.boutiques WHERE code = 'PAR');
    v_cats  uuid[] := ARRAY(SELECT id FROM public.categories_gestion WHERE name IS NOT NULL ORDER BY name LIMIT 3);
    v_cmd   uuid;
    v_liv   uuid;
    v_p1    uuid;
    v_p2    uuid;
BEGIN
    IF array_length(v_cats, 1) IS DISTINCT FROM 3 THEN
        RAISE EXCEPTION 'il faut au moins trois catégories dans categories_gestion';
    END IF;

    -- Lyon : commande en cours, première livraison partie.
    INSERT INTO public.commandes_boutique (boutique_id, date_souhaitee, note, created_by)
    VALUES (v_lyo, current_date + 2, 'Réassort de rentrée', NULL)
    RETURNING id INTO v_cmd;
    INSERT INTO public.commande_lignes (commande_id, category_id, poids_kg_demande)
    VALUES (v_cmd, v_cats[1], 100), (v_cmd, v_cats[2], 50), (v_cmd, v_cats[3], 30);

    INSERT INTO public.livraisons_boutique (commande_id, boutique_id, date_preparation_prevue,
                                            date_expedition_prevue, date_livraison_prevue, created_by)
    VALUES (v_cmd, v_lyo, current_date - 2, current_date - 1, current_date, NULL)
    RETURNING id INTO v_liv;
    INSERT INTO public.palettes (livraison_id) VALUES (v_liv) RETURNING id INTO v_p1;
    INSERT INTO public.palettes (livraison_id) VALUES (v_liv) RETURNING id INTO v_p2;
    -- Un par un : le numéro du carton vient d'un trigger.
    INSERT INTO public.cartons (livraison_id, palette_id, category_id, poids_kg_prevu) VALUES (v_liv, v_p1, v_cats[1], 25);
    INSERT INTO public.cartons (livraison_id, palette_id, category_id, poids_kg_prevu) VALUES (v_liv, v_p1, v_cats[1], 25);
    INSERT INTO public.cartons (livraison_id, palette_id, category_id, poids_kg_prevu) VALUES (v_liv, v_p1, v_cats[1], 25);
    INSERT INTO public.cartons (livraison_id, palette_id, category_id, poids_kg_prevu) VALUES (v_liv, v_p2, v_cats[1], 25);
    INSERT INTO public.cartons (livraison_id, palette_id, category_id, poids_kg_prevu) VALUES (v_liv, v_p2, v_cats[2], 25);
    INSERT INTO public.cartons (livraison_id, palette_id, category_id, poids_kg_prevu) VALUES (v_liv, v_p2, v_cats[2], 20);

    -- Expédition, comme `expedier_livraison` (sans son contrôle de droits).
    UPDATE public.cartons SET statut = 'expedie' WHERE livraison_id = v_liv;
    PERFORM set_config('app.commande_rpc', 'on', true);
    UPDATE public.livraisons_boutique SET statut = 'expediee', expediee_at = now() - interval '20 hours' WHERE id = v_liv;
    PERFORM set_config('app.commande_rpc', '', true);

    -- Lyon : commande que la boutique vient de passer.
    INSERT INTO public.commandes_boutique (boutique_id, date_souhaitee, created_by)
    VALUES (v_lyo, current_date + 9, NULL)
    RETURNING id INTO v_cmd;
    INSERT INTO public.commande_lignes (commande_id, category_id, poids_kg_demande)
    VALUES (v_cmd, v_cats[2], 40), (v_cmd, v_cats[3], 25);

    -- Paris : livraison en préparation à l'entrepôt.
    INSERT INTO public.commandes_boutique (boutique_id, date_souhaitee, created_by)
    VALUES (v_par, current_date + 5, NULL)
    RETURNING id INTO v_cmd;
    INSERT INTO public.commande_lignes (commande_id, category_id, poids_kg_demande)
    VALUES (v_cmd, v_cats[1], 75), (v_cmd, v_cats[3], 50);

    INSERT INTO public.livraisons_boutique (commande_id, boutique_id, date_preparation_prevue,
                                            date_expedition_prevue, date_livraison_prevue, created_by)
    VALUES (v_cmd, v_par, current_date, current_date + 1, current_date + 2, NULL)
    RETURNING id INTO v_liv;
    INSERT INTO public.cartons (livraison_id, category_id, poids_kg_prevu) VALUES (v_liv, v_cats[1], 25);
    INSERT INTO public.cartons (livraison_id, category_id, poids_kg_prevu) VALUES (v_liv, v_cats[1], 25);
END $$;

COMMIT;
