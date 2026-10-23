-- ============================================================
-- Stock handpick — travée E4 du rack R1 démontée
-- ============================================================
-- Le rack R1 perd sa travée E4 : sa place reste un trou entre E3 et E5
-- (même géométrie, E5 garde son nom). R2 à R5 gardent leurs cinq travées.
--
-- Les emplacements de B / R1 / E4 (H0..H2) et l'étagère elle-même passent
-- en inactif : le sélecteur d'emplacement ne les propose
-- plus, plus rien ne peut y être rangé. Rien n'est supprimé : l'historique
-- d'emplacement des balles y fait encore référence.
--
-- Une balle encore rangée en R1/E4 y reste (la FK est intacte) : la liste est
-- remontée en NOTICE pour qu'elle soit déplacée depuis sa fiche.
--
-- Idempotent : ré-exécutable sans effet de bord.
-- ============================================================

DO $$
DECLARE
    v_shelves UUID[];
    v_balle   RECORD;
BEGIN
    SELECT array_agg(s.id) INTO v_shelves
      FROM public.zones_handpick b
      JOIN public.zones_handpick r ON r.parent_id = b.id
      JOIN public.zones_handpick s ON s.parent_id = r.id
     WHERE b.parent_id IS NULL
       AND lower(btrim(b.code)) = 'b'
       AND lower(btrim(r.code)) = 'r1'
       AND s.kind = 'etagere'
       AND lower(btrim(s.code)) = 'e4';

    IF v_shelves IS NULL THEN
        RAISE NOTICE 'Étagère R1/E4 introuvable : rien à faire.';
        RETURN;
    END IF;

    UPDATE public.emplacements_handpick
       SET is_active = false
     WHERE zone_id = ANY (v_shelves)
       AND is_active;

    UPDATE public.zones_handpick
       SET is_active = false
     WHERE id = ANY (v_shelves)
       AND is_active;

    FOR v_balle IN
        SELECT bh.id, bh.raw_name, e.code
          FROM public.balles_handpick bh
          JOIN public.emplacements_handpick e ON e.id = bh.emplacement_id
         WHERE e.zone_id = ANY (v_shelves)
    LOOP
        RAISE NOTICE 'Balle encore rangée en R1/E4 (à déplacer) : % — % (%)',
            v_balle.id, coalesce(v_balle.raw_name, 'sans libellé'), v_balle.code;
    END LOOP;
END;
$$;
