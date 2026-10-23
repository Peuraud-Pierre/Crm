-- ============================================================
-- Wiki — réorganisation de l'arborescence des catégories
--
-- Contexte : public.wiki_categories possède déjà `position` (int) et
-- `parent_id` (auto-référent), et le front trie par (position, name).
-- Mais aucune UI n'écrivait ces deux colonnes après la création : une
-- catégorie mal rangée devait être supprimée puis recréée, ce qui
-- détachait ses articles (FK ON DELETE SET NULL).
--
-- Cette migration ajoute l'opération manquante : déplacer un nœud
-- (nouveau parent + nouvelle position) en réécrivant d'un accoup les
-- positions des fratries impactées. Un déplacement touchant N lignes,
-- N updates client seraient non atomiques — on passe donc par une RPC.
--
-- Sécurité : permission 'wiki.manage', via le helper
-- public.has_permission(text) (délégué de user_has_permission, voir
-- 20260717120000_has_permission_delegate.sql).
--
-- Idempotent : CREATE INDEX IF NOT EXISTS / CREATE OR REPLACE FUNCTION.
-- ============================================================

-- ─── 1. Index de tri ───
-- Le tri canonique est (parent_id, position) : un index composite évite
-- un tri en mémoire à chaque listCategories.
CREATE INDEX IF NOT EXISTS wiki_categories_parent_position_idx
    ON public.wiki_categories (parent_id, position);

-- ─── 2. RPC de réorganisation ───
-- p_updates : [{ "id": uuid, "parent_id": uuid|null, "position": int }, ...]
-- Le client n'envoie que les lignes réellement modifiées (fratrie source
-- + fratrie cible renumérotées en 0..n-1).
CREATE OR REPLACE FUNCTION public.wiki_reorder_categories(p_updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count int;
BEGIN
    -- 2.a Garde de permission. SECURITY DEFINER contourne la RLS : le
    -- contrôle doit donc être explicite ici.
    IF NOT (SELECT public.has_permission('wiki.manage'::text)) THEN
        RAISE EXCEPTION 'wiki.manage requis pour réorganiser les catégories'
            USING ERRCODE = '42501';
    END IF;

    IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'array' THEN
        RAISE EXCEPTION 'p_updates doit être un tableau JSON'
            USING ERRCODE = '22023';
    END IF;

    IF jsonb_array_length(p_updates) = 0 THEN
        RETURN;
    END IF;

    -- 2.b Toutes les cibles doivent exister (un id inconnu = bug client,
    -- pas un no-op silencieux).
    SELECT count(*) INTO v_count
    FROM jsonb_to_recordset(p_updates) AS m(id uuid, parent_id uuid, position int)
    WHERE NOT EXISTS (SELECT 1 FROM public.wiki_categories c WHERE c.id = m.id);
    IF v_count > 0 THEN
        RAISE EXCEPTION 'catégorie inconnue dans p_updates'
            USING ERRCODE = '23503';
    END IF;

    -- 2.c Application.
    UPDATE public.wiki_categories c
       SET parent_id = m.parent_id,
           position  = m.position
      FROM jsonb_to_recordset(p_updates)
        AS m(id uuid, parent_id uuid, position int)
     WHERE c.id = m.id;

    -- 2.d Garde anti-cycle, vérifiée sur l'état RÉSULTANT : on remonte la
    -- chaîne des parents depuis chaque nœud déplacé et on lève si l'on
    -- repasse par le point de départ. La transaction est annulée.
    WITH RECURSIVE moved AS (
        SELECT m.id
        FROM jsonb_to_recordset(p_updates) AS m(id uuid, parent_id uuid, position int)
    ),
    ancestors(start_id, node_id, depth) AS (
        SELECT c.id, c.parent_id, 1
        FROM public.wiki_categories c
        JOIN moved m ON m.id = c.id
        WHERE c.parent_id IS NOT NULL
        UNION ALL
        SELECT a.start_id, c.parent_id, a.depth + 1
        FROM ancestors a
        JOIN public.wiki_categories c ON c.id = a.node_id
        WHERE c.parent_id IS NOT NULL
          AND a.depth < 64
    )
    SELECT count(*) INTO v_count
    FROM ancestors
    WHERE node_id = start_id OR depth >= 64;

    IF v_count > 0 THEN
        RAISE EXCEPTION 'cycle : une catégorie ne peut pas devenir sa propre descendante'
            USING ERRCODE = '23514';
    END IF;
END;
$$;

COMMENT ON FUNCTION public.wiki_reorder_categories(jsonb) IS
    'Déplace/réordonne des catégories wiki en une transaction. Requiert wiki.manage. Refuse les cycles parent_id.';

REVOKE ALL ON FUNCTION public.wiki_reorder_categories(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.wiki_reorder_categories(jsonb) TO authenticated;
