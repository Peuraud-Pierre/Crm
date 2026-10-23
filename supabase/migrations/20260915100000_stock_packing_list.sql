-- ============================================================
-- Stock — packing lists des arrivages manuels
-- Date: 2026-09-15
-- Dépend de : arrivage_manuel, categories_gestion,
--             20260707130000_arrivage_manuel_permissions.sql
--
-- Contexte
-- --------
-- Un arrivage porte un poids et une quantité saisis à la main, faute de
-- détail. La packing list est l'inventaire du conteneur transmis par le
-- fournisseur (fichier Excel). Le parcours :
--
--   1. l'utilisateur dépose le fichier sur un arrivage existant ;
--   2. le service Go le lit, rapproche chaque libellé Excel d'une
--      catégorie de `categories_gestion`, et écrit un BROUILLON
--      (`a_verifier`) — avec le JWT de l'utilisateur, jamais en service
--      role, pour que cette RLS et `imported_by` restent vrais ;
--   3. un humain vérifie groupe par groupe de libellés bruts, corrige,
--      puis valide (`validate_packing_list`).
--
-- Choix structurants
-- ------------------
-- * Tables neuves : `factures` / `items` / `packages` (ancienne API
--   Python) n'ont ni catégorie proposée ni catégorie retenue, et
--   dispersent le poids sur plusieurs colonnes.
-- * Le libellé brut est conservé À CÔTÉ de la catégorie retenue : c'est
--   ce qui permet de vérifier (« PLO RalLrt » proposé en Pull Ralph
--   Lauren alors que ce sont des polos) et, plus tard, d'apprendre des
--   corrections côté Go.
-- * Les totaux ne sont JAMAIS stockés : ils viennent de la vue
--   `v_packing_list_summary`. Les totaux saisis sur l'arrivage restent
--   intacts, l'écran affiche l'écart.
-- * Pas de colonnes de prix : extension ultérieure de la table.
--
-- Permissions : `stock.packing.view|create|update|delete`.
--   view            ← détenteurs de stock.arrivage.view
--   create, update  ← détenteurs de stock.arrivage.update
--   delete          ← PERSONNE (même règle que stock.arrivage.delete)
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

-- ─── 1. Tables ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.packing_list (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    arrivage_manuel_id  uuid NOT NULL UNIQUE
                        REFERENCES public.arrivage_manuel(id) ON DELETE CASCADE,
    status              text NOT NULL DEFAULT 'en_traitement'
                        CHECK (status IN ('en_traitement', 'a_verifier', 'validee', 'echec')),
    source_filename     text,
    error_message       text,
    imported_by         uuid DEFAULT auth.uid(),
    imported_at         timestamptz NOT NULL DEFAULT now(),
    validated_by        uuid,
    validated_at        timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    -- Une packing validée porte toujours son horodatage : l'écran s'en sert
    -- pour dire QUAND la vérification a été close.
    CONSTRAINT packing_list_validated_consistency
        CHECK ((status = 'validee') = (validated_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.packing_list_ligne (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    packing_list_id        uuid NOT NULL
                           REFERENCES public.packing_list(id) ON DELETE CASCADE,
    position               integer NOT NULL DEFAULT 0,
    raw_label              text NOT NULL,
    raw_label_key          text NOT NULL,
    raw_row                jsonb,
    weight_kg              numeric CHECK (weight_kg IS NULL OR weight_kg >= 0),
    quantity               numeric CHECK (quantity IS NULL OR quantity >= 0),
    suggested_category_id  uuid REFERENCES public.categories_gestion(id) ON DELETE SET NULL,
    match_confidence       numeric CHECK (match_confidence IS NULL OR match_confidence BETWEEN 0 AND 1),
    category_id            uuid REFERENCES public.categories_gestion(id) ON DELETE SET NULL,
    reviewed_at            timestamptz,
    reviewed_by            uuid,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_packing_list_ligne_group
    ON public.packing_list_ligne (packing_list_id, raw_label_key);

-- ─── 2. updated_at ──────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_packing_list_updated_at ON public.packing_list;
CREATE TRIGGER update_packing_list_updated_at
    BEFORE UPDATE ON public.packing_list
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_packing_list_ligne_updated_at ON public.packing_list_ligne;
CREATE TRIGGER update_packing_list_ligne_updated_at
    BEFORE UPDATE ON public.packing_list_ligne
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- L'auteur d'une vérification est posé par la base, pas par le client :
-- le front n'envoie que `reviewed_at`, il ne peut donc pas usurper
-- `reviewed_by`.
CREATE OR REPLACE FUNCTION public.packing_list_ligne_set_reviewer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.reviewed_at IS NULL THEN
        NEW.reviewed_by := NULL;
    ELSIF OLD.reviewed_at IS DISTINCT FROM NEW.reviewed_at THEN
        NEW.reviewed_by := auth.uid();
    ELSE
        NEW.reviewed_by := OLD.reviewed_by;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS packing_list_ligne_set_reviewer ON public.packing_list_ligne;
CREATE TRIGGER packing_list_ligne_set_reviewer
    BEFORE UPDATE ON public.packing_list_ligne
    FOR EACH ROW EXECUTE FUNCTION public.packing_list_ligne_set_reviewer();

-- ─── 3. Vue de synthèse ─────────────────────────────────────────────────
-- security_invoker : la vue lit avec les droits de l'appelant, la RLS des
-- deux tables s'applique donc telle quelle.

CREATE OR REPLACE VIEW public.v_packing_list_summary
WITH (security_invoker = true) AS
SELECT
    p.*,
    COUNT(l.id)::int                                                   AS line_count,
    COUNT(l.id) FILTER (WHERE l.category_id IS NULL
                           OR l.reviewed_at IS NULL)::int              AS lines_to_review,
    COUNT(l.id) FILTER (WHERE l.category_id IS NULL)::int              AS lines_unmatched,
    COALESCE(SUM(l.weight_kg), 0)                                      AS total_weight_kg,
    COALESCE(SUM(l.quantity), 0)                                       AS total_qty
FROM public.packing_list p
LEFT JOIN public.packing_list_ligne l ON l.packing_list_id = p.id
GROUP BY p.id;

-- ─── 4. Permissions ─────────────────────────────────────────────────────

INSERT INTO public.permissions (code, label, category)
SELECT v.code, v.label, 'stock'
FROM (VALUES
    ('stock.packing.view',   'Voir les packing lists des arrivages'),
    ('stock.packing.create', 'Importer une packing list'),
    ('stock.packing.update', 'Vérifier et valider une packing list'),
    ('stock.packing.delete', 'Supprimer une packing list')
) AS v(code, label)
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions p WHERE p.code = v.code
);

-- Backfill : (source → cible). delete n'est attribuée à personne.
WITH mapping(src, target) AS (
    VALUES
        ('stock.arrivage.view',   'stock.packing.view'),
        ('stock.arrivage.update', 'stock.packing.create'),
        ('stock.arrivage.update', 'stock.packing.update')
)
INSERT INTO public.roles_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, tp.id
FROM mapping m
JOIN public.permissions sp ON sp.code = m.src
JOIN public.roles_permissions rp ON rp.permission_id = sp.id
JOIN public.permissions tp ON tp.code = m.target
WHERE NOT EXISTS (
    SELECT 1 FROM public.roles_permissions x
    WHERE x.role_id = rp.role_id AND x.permission_id = tp.id
);

WITH mapping(src, target) AS (
    VALUES
        ('stock.arrivage.view',   'stock.packing.view'),
        ('stock.arrivage.update', 'stock.packing.create'),
        ('stock.arrivage.update', 'stock.packing.update')
)
INSERT INTO public.services_permissions (service_id, permission_id)
SELECT DISTINCT spm.service_id, tp.id
FROM mapping m
JOIN public.permissions sp ON sp.code = m.src
JOIN public.services_permissions spm ON spm.permission_id = sp.id
JOIN public.permissions tp ON tp.code = m.target
WHERE NOT EXISTS (
    SELECT 1 FROM public.services_permissions x
    WHERE x.service_id = spm.service_id AND x.permission_id = tp.id
);

-- ─── 5. RLS ─────────────────────────────────────────────────────────────
-- Format de 20260914153000 : TO authenticated, has_permission en InitPlan,
-- session AAL2 exigée.

ALTER TABLE public.packing_list       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packing_list_ligne ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "packing_list_select" ON public.packing_list;
CREATE POLICY "packing_list_select" ON public.packing_list
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('stock.packing.view'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "packing_list_insert" ON public.packing_list;
CREATE POLICY "packing_list_insert" ON public.packing_list
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT has_permission('stock.packing.create'::text))
        AND (SELECT auth_session_is_aal2())
    );

-- UPDATE ouvert à create : le service Go, agissant pour l'importateur,
-- fait passer le statut de `en_traitement` à `a_verifier` ou `echec`.
DROP POLICY IF EXISTS "packing_list_update" ON public.packing_list;
CREATE POLICY "packing_list_update" ON public.packing_list
    FOR UPDATE TO authenticated
    USING (
        ((SELECT has_permission('stock.packing.update'::text))
            OR (SELECT has_permission('stock.packing.create'::text)))
        AND (SELECT auth_session_is_aal2())
    )
    WITH CHECK (
        ((SELECT has_permission('stock.packing.update'::text))
            OR (SELECT has_permission('stock.packing.create'::text)))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "packing_list_delete" ON public.packing_list;
CREATE POLICY "packing_list_delete" ON public.packing_list
    FOR DELETE TO authenticated
    USING (
        (SELECT has_permission('stock.packing.delete'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "packing_list_ligne_select" ON public.packing_list_ligne;
CREATE POLICY "packing_list_ligne_select" ON public.packing_list_ligne
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('stock.packing.view'::text))
        AND (SELECT auth_session_is_aal2())
    );

-- Insérer des lignes n'a de sens que dans une packing encore en brouillon.
DROP POLICY IF EXISTS "packing_list_ligne_insert" ON public.packing_list_ligne;
CREATE POLICY "packing_list_ligne_insert" ON public.packing_list_ligne
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT has_permission('stock.packing.create'::text))
        AND (SELECT auth_session_is_aal2())
        AND EXISTS (
            SELECT 1 FROM public.packing_list p
            WHERE p.id = packing_list_id
              AND p.status IN ('en_traitement', 'a_verifier')
        )
    );

-- Réattribuer une catégorie : seulement tant que la packing n'est pas
-- validée. La rouvrir (`reopen_packing_list`) est le chemin explicite.
DROP POLICY IF EXISTS "packing_list_ligne_update" ON public.packing_list_ligne;
CREATE POLICY "packing_list_ligne_update" ON public.packing_list_ligne
    FOR UPDATE TO authenticated
    USING (
        (SELECT has_permission('stock.packing.update'::text))
        AND (SELECT auth_session_is_aal2())
        AND EXISTS (
            SELECT 1 FROM public.packing_list p
            WHERE p.id = packing_list_id AND p.status = 'a_verifier'
        )
    )
    WITH CHECK (
        (SELECT has_permission('stock.packing.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "packing_list_ligne_delete" ON public.packing_list_ligne;
CREATE POLICY "packing_list_ligne_delete" ON public.packing_list_ligne
    FOR DELETE TO authenticated
    USING (
        (SELECT has_permission('stock.packing.delete'::text))
        AND (SELECT auth_session_is_aal2())
    );

-- ─── 6. RPC de cycle de vie ─────────────────────────────────────────────
-- SECURITY INVOKER : la RLS ci-dessus reste le seul arbitre des droits.

CREATE OR REPLACE FUNCTION public.validate_packing_list(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_status    text;
    v_unmatched int;
BEGIN
    SELECT status INTO v_status FROM public.packing_list WHERE id = p_id FOR UPDATE;
    IF v_status IS NULL THEN
        RAISE EXCEPTION 'packing list introuvable' USING ERRCODE = 'P0002';
    END IF;
    IF v_status <> 'a_verifier' THEN
        RAISE EXCEPTION 'seule une packing list à vérifier peut être validée (statut : %)', v_status
            USING ERRCODE = 'P0001';
    END IF;

    SELECT COUNT(*) INTO v_unmatched
    FROM public.packing_list_ligne
    WHERE packing_list_id = p_id AND category_id IS NULL;

    IF v_unmatched > 0 THEN
        RAISE EXCEPTION '% ligne(s) sans catégorie', v_unmatched USING ERRCODE = 'P0001';
    END IF;

    -- Valider d'un coup vaut vérification des lignes restantes.
    UPDATE public.packing_list_ligne
    SET reviewed_at = now(), reviewed_by = auth.uid()
    WHERE packing_list_id = p_id AND reviewed_at IS NULL;

    UPDATE public.packing_list
    SET status = 'validee', validated_at = now(), validated_by = auth.uid()
    WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reopen_packing_list(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    UPDATE public.packing_list
    SET status = 'a_verifier', validated_at = NULL, validated_by = NULL
    WHERE id = p_id AND status = 'validee';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'seule une packing list validée peut être rouverte' USING ERRCODE = 'P0001';
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_packing_list(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reopen_packing_list(uuid)   FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.validate_packing_list(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.reopen_packing_list(uuid)   TO authenticated;

-- ─── 7. Realtime ────────────────────────────────────────────────────────
-- Un traitement asynchrone côté Go fait passer `en_traitement` →
-- `a_verifier` : la sheet ouverte doit le voir sans rechargement.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname    = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename  = 'packing_list'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.packing_list;
    END IF;
END;
$$;
