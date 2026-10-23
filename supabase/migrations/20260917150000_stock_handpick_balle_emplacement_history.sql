-- ============================================================
-- Stock Handpick — historique d'emplacement et emprunt des balles
-- Date: 2026-09-17
-- Dépend de : 20260914142000 (plan), 20260914143000 (balles),
--             20260914153000 (policies alignées prod)
--
-- 1. Emprunt : `borrowed_by` / `borrowed_at` sur la balle. Emprunter
--    sort la balle de son emplacement ; la rendre la replace dans un
--    emplacement. Une balle est empruntée ssi `borrowed_by` est renseigné.
--
-- 2. Historique : `balles_emplacements_handpick`, une ligne par
--    changement d'emplacement ou d'état d'emprunt. Alimentée
--    EXCLUSIVEMENT par trigger (aucune policy d'écriture) : le client ne
--    peut ni l'inventer ni la réécrire.
--
--    Chaque ligne garde les ids d'emplacement ET un instantané du chemin
--    lisible (« B1 · E2 · H2 ») : un emplacement renommé ou supprimé
--    n'efface pas ce qu'on lisait au moment du mouvement. Le séparateur
--    est celui du front (EMPLACEMENT_PATH_SEPARATOR).
--
-- Idempotent : ré-exécutable sans effet de bord.
-- ============================================================

-- ─── 1. Emprunt ─────────────────────────────────────────────────────────

ALTER TABLE public.balles_handpick
    ADD COLUMN IF NOT EXISTS borrowed_by UUID NULL,
    ADD COLUMN IF NOT EXISTS borrowed_at TIMESTAMPTZ NULL;

ALTER TABLE public.balles_handpick
    DROP CONSTRAINT IF EXISTS balles_handpick_borrowed_by_fkey;
ALTER TABLE public.balles_handpick
    ADD CONSTRAINT balles_handpick_borrowed_by_fkey
    FOREIGN KEY (borrowed_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_balles_handpick_borrowed
    ON public.balles_handpick (borrowed_at DESC)
    WHERE borrowed_by IS NOT NULL;

-- ─── 2. Chemin lisible d'un emplacement ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.handpick_emplacement_path(p_emplacement_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    WITH RECURSIVE chain AS (
        SELECT z.id, z.parent_id, z.code, 1 AS depth
        FROM public.emplacements_handpick e
        JOIN public.zones_handpick z ON z.id = e.zone_id
        WHERE e.id = p_emplacement_id
        UNION ALL
        SELECT z.id, z.parent_id, z.code, c.depth + 1
        FROM public.zones_handpick z
        JOIN chain c ON z.id = c.parent_id
        WHERE c.depth < 32 -- garde-fou contre un cycle résiduel
    )
    SELECT concat_ws(
        ' · ',
        (SELECT string_agg(code, ' · ' ORDER BY depth DESC) FROM chain),
        (SELECT code FROM public.emplacements_handpick WHERE id = p_emplacement_id)
    )
    WHERE p_emplacement_id IS NOT NULL;
$$;

-- ─── 3. Historique ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.balles_emplacements_handpick (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    balle_id            UUID        NOT NULL REFERENCES public.balles_handpick(id) ON DELETE CASCADE,
    event               TEXT        NOT NULL,
    emplacement_from_id UUID        NULL REFERENCES public.emplacements_handpick(id) ON DELETE SET NULL,
    emplacement_to_id   UUID        NULL REFERENCES public.emplacements_handpick(id) ON DELETE SET NULL,
    from_path           TEXT        NULL,
    to_path             TEXT        NULL,
    user_id             UUID        NULL REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT balles_emplacements_handpick_event_valid CHECK (
        event IN ('placed', 'moved', 'removed', 'borrowed', 'returned')
    )
);

CREATE INDEX IF NOT EXISTS idx_balles_emplacements_handpick_balle
    ON public.balles_emplacements_handpick (balle_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_balle_emplacement_handpick()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_from  UUID := CASE WHEN TG_OP = 'UPDATE' THEN OLD.emplacement_id END;
    v_was_borrowed BOOLEAN := TG_OP = 'UPDATE' AND OLD.borrowed_by IS NOT NULL;
    v_event TEXT;
BEGIN
    IF NOT v_was_borrowed AND NEW.borrowed_by IS NOT NULL THEN
        v_event := 'borrowed';
    ELSIF v_was_borrowed AND NEW.borrowed_by IS NULL THEN
        v_event := 'returned';
    ELSIF v_from IS NOT DISTINCT FROM NEW.emplacement_id THEN
        RETURN NULL; -- rien ne concerne l'emplacement
    ELSIF v_from IS NULL THEN
        v_event := 'placed';
    ELSIF NEW.emplacement_id IS NULL THEN
        v_event := 'removed';
    ELSE
        v_event := 'moved';
    END IF;

    INSERT INTO public.balles_emplacements_handpick (
        balle_id, event,
        emplacement_from_id, emplacement_to_id,
        from_path, to_path,
        user_id
    ) VALUES (
        NEW.id, v_event,
        v_from, NEW.emplacement_id,
        public.handpick_emplacement_path(v_from),
        public.handpick_emplacement_path(NEW.emplacement_id),
        auth.uid()
    );

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS log_balle_emplacement_handpick ON public.balles_handpick;
CREATE TRIGGER log_balle_emplacement_handpick
    AFTER INSERT OR UPDATE OF emplacement_id, borrowed_by ON public.balles_handpick
    FOR EACH ROW
    EXECUTE FUNCTION public.log_balle_emplacement_handpick();

-- Une balle créée sans emplacement ni emprunt ne produit rien : la
-- fonction sort sur `v_from IS NOT DISTINCT FROM NEW.emplacement_id`.

-- ─── 4. RLS : lecture seule ─────────────────────────────────────────────

ALTER TABLE public.balles_emplacements_handpick ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "balles_emplacements_handpick_select" ON public.balles_emplacements_handpick;
CREATE POLICY "balles_emplacements_handpick_select" ON public.balles_emplacements_handpick
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('stock_handpick.inventaire.view'::text))
        AND (SELECT auth_session_is_aal2())
    );

NOTIFY pgrst, 'reload schema';
