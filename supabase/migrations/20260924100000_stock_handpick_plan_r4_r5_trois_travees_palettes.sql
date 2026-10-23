-- ============================================================
-- Stock handpick — R4 / R5 à trois travées, palettes au sol en R2 / R3
-- ============================================================
-- • Les racks R4 et R5 n'ont plus que trois travées (E1…E3), plus larges :
--   leurs étagères E4 et E5 et tous leurs emplacements passent en inactif.
-- • Les travées E1 et E2 du rack double (R2 et R3) ne sont plus des racks
--   mais des palettes au sol : seul H0 reste, leurs emplacements H1 et H2
--   passent en inactif (l'étagère elle-même reste active).
--
-- Rien n'est supprimé : l'historique d'emplacement des balles y fait encore
-- référence. Une balle encore rangée à un emplacement désactivé y reste (la
-- FK est intacte) : la liste est remontée en NOTICE pour qu'elle soit
-- déplacée depuis sa fiche.
--
-- Idempotent : ré-exécutable sans effet de bord.
-- ============================================================

DO $$
DECLARE
    v_shelves      UUID[];
    v_emplacements UUID[];
    v_balle        RECORD;
BEGIN
    -- Étagères retirées : R4 / R5 · E4 / E5.
    SELECT array_agg(s.id) INTO v_shelves
      FROM public.zones_handpick b
      JOIN public.zones_handpick r ON r.parent_id = b.id
      JOIN public.zones_handpick s ON s.parent_id = r.id
     WHERE b.parent_id IS NULL
       AND lower(btrim(b.code)) = 'b'
       AND lower(btrim(r.code)) IN ('r4', 'r5')
       AND s.kind = 'etagere'
       AND lower(btrim(s.code)) IN ('e4', 'e5');

    -- Emplacements à désactiver : tout ce qui est sous ces étagères, plus
    -- H1 / H2 de R2 / R3 · E1 / E2.
    SELECT array_agg(e.id) INTO v_emplacements
      FROM public.emplacements_handpick e
     WHERE e.zone_id = ANY (coalesce(v_shelves, '{}'))
        OR e.id IN (
            SELECT e2.id
              FROM public.zones_handpick b
              JOIN public.zones_handpick r ON r.parent_id = b.id
              JOIN public.zones_handpick s ON s.parent_id = r.id
              JOIN public.emplacements_handpick e2 ON e2.zone_id = s.id
             WHERE b.parent_id IS NULL
               AND lower(btrim(b.code)) = 'b'
               AND lower(btrim(r.code)) IN ('r2', 'r3')
               AND s.kind = 'etagere'
               AND lower(btrim(s.code)) IN ('e1', 'e2')
               AND lower(btrim(e2.code)) IN ('h1', 'h2')
        );

    IF v_shelves IS NULL AND v_emplacements IS NULL THEN
        RAISE NOTICE 'Aucune travée ni hauteur à retirer : rien à faire.';
        RETURN;
    END IF;

    UPDATE public.emplacements_handpick
       SET is_active = false
     WHERE id = ANY (coalesce(v_emplacements, '{}'))
       AND is_active;

    UPDATE public.zones_handpick
       SET is_active = false
     WHERE id = ANY (coalesce(v_shelves, '{}'))
       AND is_active;

    FOR v_balle IN
        SELECT bh.id, bh.raw_name, e.code
          FROM public.balles_handpick bh
          JOIN public.emplacements_handpick e ON e.id = bh.emplacement_id
         WHERE e.id = ANY (coalesce(v_emplacements, '{}'))
    LOOP
        RAISE NOTICE 'Balle encore rangée à un emplacement retiré (à déplacer) : % — % (%)',
            v_balle.id, coalesce(v_balle.raw_name, 'sans libellé'), v_balle.code;
    END LOOP;
END;
$$;
