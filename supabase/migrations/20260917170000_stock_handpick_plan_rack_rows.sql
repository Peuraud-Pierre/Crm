-- ============================================================
-- Stock Handpick — zone B en trois rangées de racks
-- Date: 2026-09-17
-- Dépend de : 20260917160000 (structure du plan)
--
-- La zone B (Bags) compte trois rangées de racks à palettes — haut (R1),
-- milieu (R2), bas (R3) — de cinq travées E1…E5 chacune, sur trois
-- hauteurs H0…H2 :
--
--   B · R2 · E3 · H1   = rangée du milieu, 3e travée, 1er niveau
--
-- Les étagères E1…E5 créées directement sous B par 20260917160000
-- deviennent la rangée du haut (R1) : elles sont DÉPLACÉES, pas
-- recréées, si bien que les balles qui y sont rangées gardent leur
-- emplacement (seul son chemin lisible change).
--
-- Idempotent : n'insère que ce qui manque.
-- ============================================================

DO $$
DECLARE
    v_zone_b   UUID;
    v_row_id   UUID;
    v_shelf_id UUID;
    v_row      INT;
    v_shelf    INT;
    v_level    INT;
BEGIN
    SELECT id INTO v_zone_b
    FROM public.zones_handpick
    WHERE parent_id IS NULL AND lower(btrim(code)) = 'b';

    IF v_zone_b IS NULL THEN
        RAISE EXCEPTION 'Zone B introuvable : exécuter d''abord 20260917160000_stock_handpick_plan_seed';
    END IF;

    FOR v_row IN 1..3 LOOP
        SELECT id INTO v_row_id
        FROM public.zones_handpick
        WHERE parent_id = v_zone_b AND lower(btrim(code)) = lower('R' || v_row);

        IF v_row_id IS NULL THEN
            INSERT INTO public.zones_handpick (parent_id, kind, code, label, sort_order)
            VALUES (
                v_zone_b, 'allee', 'R' || v_row,
                CASE v_row WHEN 1 THEN 'Rangée du haut' WHEN 2 THEN 'Rangée du milieu' ELSE 'Rangée du bas' END,
                v_row
            )
            RETURNING id INTO v_row_id;
        END IF;

        -- Rangée du haut : on y rattache les étagères posées directement
        -- sous B par la migration précédente.
        IF v_row = 1 THEN
            UPDATE public.zones_handpick s
            SET parent_id = v_row_id
            WHERE s.parent_id = v_zone_b
              AND s.kind = 'etagere'
              AND lower(btrim(s.code)) IN ('e1', 'e2', 'e3', 'e4', 'e5')
              AND NOT EXISTS (
                  SELECT 1 FROM public.zones_handpick t
                  WHERE t.parent_id = v_row_id
                    AND lower(btrim(t.code)) = lower(btrim(s.code))
              );
        END IF;

        FOR v_shelf IN 1..5 LOOP
            SELECT id INTO v_shelf_id
            FROM public.zones_handpick
            WHERE parent_id = v_row_id AND lower(btrim(code)) = lower('E' || v_shelf);

            IF v_shelf_id IS NULL THEN
                INSERT INTO public.zones_handpick (parent_id, kind, code, label, sort_order)
                VALUES (v_row_id, 'etagere', 'E' || v_shelf, 'Travée ' || v_shelf, v_shelf)
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
    END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
