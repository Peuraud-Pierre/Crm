-- ============================================================
-- Données de démonstration — Salle de tri (fiches, balles, répartition)
--
-- Pour voir et présenter /salle-de-tri avec des chiffres qui racontent
-- quelque chose. À n'exécuter QUE sur une base de développement ou de
-- démonstration, APRÈS la migration 20261001100000_stock_tri.sql.
-- Prérequis : au moins un fournisseur et une catégorie dans les
-- référentiels du stock (fournisseur_gestion, categories_gestion).
--
-- Produit, sur les 8 dernières semaines (jours ouvrés, dates RELATIVES à
-- aujourd'hui) :
--   - 6 trieurs (complète ceux de entrepot_tri_commandes_demo.sql) ;
--   - ~40 fiches de 2 à 6 balles, avec horaires pour la plupart ;
--   - des répartitions réalistes (MAG dominant, d'autant plus que la balle
--     est bonne) et ~10 % de balles en écart ;
--   - une qualité propre à chaque fournisseur, pour que la statistique
--     « Par fournisseur » les distingue.
--
-- Rejouable : les fiches de démonstration sont celles SANS auteur
-- (`created_by IS NULL` — une saisie par l'application passe par
-- `save_fiche_tri` et porte toujours `auth.uid()`). Les rejouer les
-- remplace, avec des dates recalées sur aujourd'hui : à relancer la
-- veille d'une présentation. Le tirage est fixe (setseed) : mêmes
-- chiffres à chaque exécution, le même jour.
--
-- ⚠️  RLS : ce script écrit directement en base. Le SQL Editor Supabase et
--     psql (rôle service) contournent la RLS. Le remplacement des fiches
--     de démonstration passe par le trigger de suppression : il laisse
--     une entrée par fiche dans le journal, avec un `user_id` NULL.
-- ============================================================

BEGIN;

INSERT INTO public.trieurs (nom)
SELECT v.nom FROM (VALUES ('Karim'), ('Lina'), ('Moussa'), ('Inès'), ('Théo'), ('Awa')) AS v(nom)
WHERE NOT EXISTS (SELECT 1 FROM public.trieurs t WHERE lower(btrim(t.nom)) = lower(v.nom));

DO $$
DECLARE
    v_trieurs  uuid[];
    v_fourn    uuid[];
    v_cats     uuid[];
    -- Dans l'ordre du référentiel : MAG, KS, SO3, EXPORT.
    v_sorties  uuid[];
    -- Qualité de base de chaque fournisseur (cyclique) : un excellent, des
    -- moyens, un médiocre.
    v_profils  numeric[] := ARRAY[2.8, 2.2, 1.9, 1.3, 2.5];
    v_notes    text[] := ARRAY[
        'Humide au fond de la balle',
        'Beaucoup de taches',
        'Mélange été / hiver',
        'Très belle balle, beaucoup de marques',
        'Cintres et plastiques à retirer',
        'Pièces abîmées (trous, zips)'
    ];
    v_day      date;
    v_nb       int;
    v_fiche    uuid;
    v_balle    uuid;
    v_total    numeric;
    v_minutes  int;
    v_debut    time;
    k          int;
    b          int;
    v_fi       int;
    v_poids    numeric;
    v_qualite  int;
    v_mag      numeric;
    v_ks       numeric;
    v_so3      numeric;
    v_export   numeric;
    v_ecart    numeric;
    v_parts    numeric[];
BEGIN
    PERFORM setseed(0.42);

    SELECT array_agg(id ORDER BY nom) INTO v_trieurs FROM public.trieurs WHERE actif;
    SELECT array_agg(id ORDER BY name) INTO v_fourn
        FROM (SELECT id, name FROM public.fournisseur_gestion ORDER BY name LIMIT 5) f;
    SELECT array_agg(id ORDER BY name) INTO v_cats
        FROM (SELECT id, name FROM public.categories_gestion WHERE name IS NOT NULL ORDER BY name LIMIT 8) c;
    SELECT array_agg(id ORDER BY ordre) INTO v_sorties
        FROM public.tri_sorties WHERE upper(code) IN ('MAG', 'KS', 'SO3', 'EXPORT');

    IF v_fourn IS NULL OR v_cats IS NULL THEN
        RAISE EXCEPTION 'Démo salle de tri : il faut au moins un fournisseur et une catégorie dans le stock.';
    END IF;
    IF coalesce(array_length(v_sorties, 1), 0) <> 4 THEN
        RAISE EXCEPTION 'Démo salle de tri : types MAG, KS, SO3 et EXPORT attendus (posés par la migration).';
    END IF;

    DELETE FROM public.fiches_tri WHERE created_by IS NULL;

    FOR v_day IN SELECT generate_series(current_date - 55, current_date, interval '1 day')::date LOOP
        CONTINUE WHEN extract(isodow FROM v_day) >= 6;
        -- 0, 1 ou 2 feuilles ce jour-là.
        v_nb := CASE WHEN random() < 0.25 THEN 0 WHEN random() < 0.75 THEN 1 ELSE 2 END;

        FOR k IN 1..v_nb LOOP
            INSERT INTO public.fiches_tri (date_tri, trieur_id, created_by)
            VALUES (v_day, v_trieurs[1 + floor(random() * array_length(v_trieurs, 1))::int], NULL)
            RETURNING id INTO v_fiche;

            v_total := 0;
            FOR b IN 1..(2 + floor(random() * 5)::int) LOOP
                v_fi      := 1 + floor(random() * array_length(v_fourn, 1))::int;
                v_poids   := round((35 + random() * 75)::numeric, 1);
                v_qualite := greatest(1, least(3, round(v_profils[1 + (v_fi - 1) % array_length(v_profils, 1)] + (random()::numeric - 0.5) * 1.4)))::int;

                INSERT INTO public.fiches_tri_balles (fiche_id, ordre, fournisseur_id, category_id, poids_initial_kg, qualite, note)
                VALUES (
                    v_fiche, b - 1, v_fourn[v_fi],
                    v_cats[1 + floor(random() * array_length(v_cats, 1))::int],
                    v_poids, v_qualite,
                    CASE WHEN random() < 0.2 THEN v_notes[1 + floor(random() * array_length(v_notes, 1))::int] END
                )
                RETURNING id INTO v_balle;

                -- Une bonne balle part davantage en magasin.
                v_mag    := round(v_poids * (0.30 + 0.12 * v_qualite + random()::numeric * 0.10), 1);
                v_ks     := round(v_poids * (0.12 + random()::numeric * 0.15), 1);
                v_so3    := round(v_poids * (0.03 + random()::numeric * 0.08), 1);
                v_export := v_poids - v_mag - v_ks - v_so3;
                IF v_export < 0 THEN
                    v_mag := v_mag + v_export;
                    v_export := 0;
                END IF;
                -- ~10 % des balles ne retombent pas juste : il manque (le
                -- plus souvent) ou il y a trop de kilos.
                IF random() < 0.10 THEN
                    v_ecart := round((0.5 + random() * 4)::numeric, 1) * CASE WHEN random() < 0.75 THEN -1 ELSE 1 END;
                    IF v_export + v_ecart > 0 THEN v_export := v_export + v_ecart; ELSE v_mag := v_mag + v_ecart; END IF;
                END IF;

                v_parts := ARRAY[v_mag, v_ks, v_so3, v_export];
                INSERT INTO public.fiches_tri_repartition (balle_id, sortie_id, poids_kg)
                SELECT v_balle, v_sorties[i], v_parts[i]
                FROM generate_series(1, 4) AS i
                WHERE v_parts[i] > 0;

                v_total := v_total + v_poids;
            END LOOP;

            -- Horaires sur 85 % des feuilles, à 90-160 kg/h, au quart d'heure.
            IF random() < 0.85 THEN
                v_minutes := greatest(30, round(v_total / (90 + random()::numeric * 70) * 4) * 15)::int;
                v_debut   := time '07:30' + make_interval(mins => 15 * floor(random() * 10)::int);
                UPDATE public.fiches_tri
                SET heure_debut = v_debut, heure_fin = v_debut + make_interval(mins => v_minutes)
                WHERE id = v_fiche;
            END IF;
        END LOOP;
    END LOOP;
END $$;

COMMIT;

-- Contrôle : fiches, balles, balles en écart, kilos.
SELECT count(*)                                   AS fiches,
       sum(nb_balles)                             AS balles,
       sum(nb_balles_ecart)                       AS balles_en_ecart,
       round(sum(poids_initial_kg))               AS kg_tries
FROM public.v_fiches_tri
WHERE created_by IS NULL;
