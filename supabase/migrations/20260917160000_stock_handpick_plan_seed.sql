-- ============================================================
-- Stock Handpick — structure du plan de l'entrepôt
-- Date: 2026-09-17
-- Dépend de : 20260914142000 (zones / emplacements)
--
-- Reprend le plan dessiné au tableau (IMG_2286) :
--
--   A  Annexe   — zone, un emplacement au sol « SOL »
--   B  Bags     — zone, 5 étagères E1…E5 le long du mur,
--                 chacune sur 3 hauteurs H0 (sol), H1, H2
--   D  Display  — zone, un emplacement au sol « SOL »
--
-- Une balle se range donc en « B · E2 · H2 », « A · SOL », « D · SOL ».
-- L'onglet Plan retrouve ces emplacements par leur CODE : les renommer
-- les fait disparaître du dessin (ils restent utilisables ailleurs).
--
-- Idempotent : n'insère que ce qui manque, ne modifie rien d'existant.
-- ============================================================

DO $$
DECLARE
    v_zone     RECORD;
    v_zone_id  UUID;
    v_shelf_id UUID;
    v_shelf    INT;
    v_level    INT;
BEGIN
    FOR v_zone IN
        SELECT * FROM (VALUES
            ('A', 'Annexe',  1),
            ('B', 'Bags',    0),
            ('D', 'Display', 2)
        ) AS z(code, label, sort_order)
    LOOP
        SELECT id INTO v_zone_id
        FROM public.zones_handpick
        WHERE parent_id IS NULL AND lower(btrim(code)) = lower(v_zone.code);

        IF v_zone_id IS NULL THEN
            INSERT INTO public.zones_handpick (kind, code, label, sort_order)
            VALUES ('zone', v_zone.code, v_zone.label, v_zone.sort_order)
            RETURNING id INTO v_zone_id;
        END IF;

        IF v_zone.code = 'B' THEN
            FOR v_shelf IN 1..5 LOOP
                SELECT id INTO v_shelf_id
                FROM public.zones_handpick
                WHERE parent_id = v_zone_id AND lower(btrim(code)) = lower('E' || v_shelf);

                IF v_shelf_id IS NULL THEN
                    INSERT INTO public.zones_handpick (parent_id, kind, code, label, sort_order)
                    VALUES (v_zone_id, 'etagere', 'E' || v_shelf, 'Étagère ' || v_shelf, v_shelf)
                    RETURNING id INTO v_shelf_id;
                END IF;

                FOR v_level IN 0..2 LOOP
                    INSERT INTO public.emplacements_handpick (zone_id, code, label)
                    SELECT v_shelf_id, 'H' || v_level, 'Hauteur ' || v_level
                    WHERE NOT EXISTS (
                        SELECT 1 FROM public.emplacements_handpick
                        WHERE zone_id = v_shelf_id AND lower(btrim(code)) = lower('H' || v_level)
                    );
                END LOOP;
            END LOOP;
        ELSE
            INSERT INTO public.emplacements_handpick (zone_id, code, label)
            SELECT v_zone_id, 'SOL', 'Au sol'
            WHERE NOT EXISTS (
                SELECT 1 FROM public.emplacements_handpick
                WHERE zone_id = v_zone_id AND lower(btrim(code)) = 'sol'
            );
        END IF;
    END LOOP;
END;
$$;
