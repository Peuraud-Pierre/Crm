-- ============================================================
-- Stock Handpick — rack vertical R4 (plan IMG_2287)
-- Date: 2026-09-17
-- Dépend de : 20260917170000 (rangées R1…R3)
--
-- Le plan d'étage relevé au tableau ajoute, entre la réserve et
-- l'escalier, un rack disposé verticalement. Il devient la rangée R4 de
-- la zone B : cinq travées E1…E5, trois hauteurs H0…H2.
--
-- Idempotent : n'insère que ce qui manque.
-- ============================================================

DO $$
DECLARE
    v_zone_b   UUID;
    v_row_id   UUID;
    v_shelf_id UUID;
    v_shelf    INT;
    v_level    INT;
BEGIN
    SELECT id INTO v_zone_b
    FROM public.zones_handpick
    WHERE parent_id IS NULL AND lower(btrim(code)) = 'b';

    IF v_zone_b IS NULL THEN
        RAISE EXCEPTION 'Zone B introuvable : exécuter d''abord 20260917160000 et 20260917170000';
    END IF;

    SELECT id INTO v_row_id
    FROM public.zones_handpick
    WHERE parent_id = v_zone_b AND lower(btrim(code)) = 'r4';

    IF v_row_id IS NULL THEN
        INSERT INTO public.zones_handpick (parent_id, kind, code, label, sort_order)
        VALUES (v_zone_b, 'allee', 'R4', 'Rack vertical', 4)
        RETURNING id INTO v_row_id;
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
END;
$$;

NOTIFY pgrst, 'reload schema';
