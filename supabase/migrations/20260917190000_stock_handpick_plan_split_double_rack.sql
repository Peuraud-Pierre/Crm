-- ============================================================
-- Stock Handpick — le rack double devient deux rangées
-- Date: 2026-09-17
-- Dépend de : 20260917180000 (rack vertical R4)
--
-- Le rack double du milieu de la réserve est adressé en DEUX rangées,
-- une par face : R2 (face haute) et R3 (face basse). Les racks suivants
-- sont renumérotés :
--
--   avant                     après
--   R2  rack double      →    R2  face haute  +  R3  face basse (nouvelle)
--   R3  rack du bas      →    R4
--   R4  rack vertical    →    R5
--
-- Les rangées existantes sont RENOMMÉES, pas recréées : les balles qui y
-- sont rangées gardent leur emplacement. Seul leur chemin lisible change
-- (« B · R3 · E2 · H1 » devient « B · R4 · E2 · H1 ») ; l'historique
-- conserve les chemins tels qu'ils étaient au moment des mouvements.
--
-- Idempotent : les renommages ne se font que si R5 n'existe pas encore.
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
        RAISE EXCEPTION 'Zone B introuvable : exécuter d''abord les migrations du plan (20260917160000 à 20260917180000)';
    END IF;

    -- Renumérotation, de la fin vers le début pour ne jamais heurter
    -- l'unicité (parent, code).
    IF NOT EXISTS (
        SELECT 1 FROM public.zones_handpick
        WHERE parent_id = v_zone_b AND lower(btrim(code)) = 'r5'
    ) THEN
        UPDATE public.zones_handpick
        SET code = 'R5', label = 'Rack vertical', sort_order = 5
        WHERE parent_id = v_zone_b AND lower(btrim(code)) = 'r4';

        UPDATE public.zones_handpick
        SET code = 'R4', label = 'Rangée du bas', sort_order = 4
        WHERE parent_id = v_zone_b AND lower(btrim(code)) = 'r3';

        UPDATE public.zones_handpick
        SET label = 'Rack double — face haute'
        WHERE parent_id = v_zone_b AND lower(btrim(code)) = 'r2';
    END IF;

    -- Nouvelle rangée R3 : face basse du rack double.
    SELECT id INTO v_row_id
    FROM public.zones_handpick
    WHERE parent_id = v_zone_b AND lower(btrim(code)) = 'r3';

    IF v_row_id IS NULL THEN
        INSERT INTO public.zones_handpick (parent_id, kind, code, label, sort_order)
        VALUES (v_zone_b, 'allee', 'R3', 'Rack double — face basse', 3)
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
