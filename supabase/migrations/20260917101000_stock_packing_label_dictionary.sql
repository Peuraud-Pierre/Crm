-- ============================================================================
-- Packing lists — tableau de correspondance libellé fournisseur → catégorie
--
-- POURQUOI
-- --------
-- Un conteneur porte 90 à 140 lignes et presque autant de libellés distincts :
-- sur CONTENEUR GR153, 97 lignes pour 88 libellés. Le regroupement par libellé
-- à l'intérieur d'un fichier ne fait donc gagner que 9 % de décisions. Ce qui
-- se répète, c'est le VOCABULAIRE DU FOURNISSEUR d'un conteneur au suivant.
--
-- Mesure faite sur deux packings réelles — dictionnaire appris sur GR153, puis
-- import de GR154 : 47 des 121 groupes de GR154 (55 lignes sur 139, 40 %) sont
-- reconnus à l'identique et ne demandent aucune décision. La couverture monte
-- à chaque conteneur validé, parce que le vocabulaire est fini.
--
-- POURQUOI PAS DE RAPPROCHEMENT FLOU ICI
-- --------------------------------------
-- Mesuré sur les mêmes fichiers : un trigramme à 0,60 porte la couverture à
-- 71 % mais produit des inversions de MARQUE à confiance élevée (0,72 à 0,84)
--     « BRAND FEATHER JACKET » → NF FEATHER JACKET
--     « DENIM JACKET TOMMY »   → LLW DENIM JACKET
--     « COTTON PANTS POLO »    → LVS COTTON PANTS
-- qu'un relecteur ne rattrape pas, puisqu'elles s'affichent comme des
-- propositions sûres. Un rapprochement flou peut donc SUGGÉRER
-- (`suggested_category_id` + `match_confidence`), jamais RETENIR.
-- Seule une correspondance exacte de ce tableau écrit `category_id`, et elle
-- le fait avec `resolution = 'dictionary'`.
--
-- CE QUI ENSEIGNE LE TABLEAU
-- --------------------------
-- Uniquement la VALIDATION d'une packing list. C'est ce qui rend une
-- correspondance exacte digne de se passer de relecture : chaque entrée vient
-- d'un arbitrage humain assumé sur un conteneur entier.
-- ============================================================================

-- ─── 1. Le normaliseur de référence ─────────────────────────────────────
-- Trois implémentations doivent produire la même clé : celle-ci, celle du
-- front (`utils/packingDocument.ts`) et celle du service Go. Cette version
-- est l'arbitre — c'est elle qui permet de re-clé le tableau si les règles
-- changent, au lieu de vivre avec des clés divergentes.
--
-- Les variantes traitées ont toutes été relevées sur GR153/GR154 : ce sont
-- des orthographes flottantes du MÊME article, jamais des rapprochements
-- d'articles différents (vérifié : aucune collision entre les 88 libellés de
-- GR153).
--
-- `translate()` plutôt que `unaccent()` : l'extension n'est pas installée sur
-- ce projet, et la table des accents latins suffit ici.

CREATE OR REPLACE FUNCTION public.normalize_packing_label(p_label text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    WITH base AS (
        SELECT translate(
                   lower(coalesce(p_label, '')),
                   'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
                   'aaaaaaceeeeiiiinooooouuuuyy'
               ) AS s
    ),
    cleaned AS (
        -- Tout ce qui n'est ni lettre ni chiffre devient un espace.
        SELECT regexp_replace(s, '[^a-z0-9]+', ' ', 'g') AS s FROM base
    ),
    synonyms AS (
        -- Orthographes flottantes du fournisseur, dans cet ordre.
        SELECT regexp_replace(
               regexp_replace(
               regexp_replace(
               regexp_replace(
               regexp_replace(
               regexp_replace(
               regexp_replace(
               regexp_replace(
               regexp_replace(
               regexp_replace(s,
                   '\ytshirt\y',    't shirt',   'g'),
                   '\ysweatshirt\y','sweat shirt','g'),
                   '\yjkt\y',       'jacket',    'g'),
                   '\ynaylon\y',    'nylon',     'g'),
                   '\ycolumb\y',    'colum',     'g'),
                   '\yhensen\y',    'hansen',    'g'),
                   '\ybrohers?\y',  'brother',   'g'),
                   '\y3button\y',   '3 button',  'g'),
                   '\ypolyster\y',  'poly',      'g'),
                   '\yreyon\y',     'rayon',     'g') AS s
        FROM cleaned
    ),
    tokens AS (
        SELECT t.tok, t.ord
        FROM synonyms,
             LATERAL unnest(string_to_array(btrim(synonyms.s), ' '))
                     WITH ORDINALITY AS t(tok, ord)
        WHERE t.tok <> ''
          -- Jetons sans valeur discriminante relevés sur les deux fichiers :
          -- « (A) », « (DXB) », « U.S.A. », « 45KG ».
          AND t.tok NOT IN ('a', 'dxb', 'usa', 'kg', 'kgs')
          AND t.tok !~ '^[0-9]+kg$'
    )
    SELECT coalesce(
        (SELECT string_agg(
                    -- Dépluralisation : « PANTS »/« PANT », « SHORTS »/« SHORT »
                    -- désignent le même article chez ce fournisseur.
                    CASE WHEN length(tok) > 1 AND right(tok, 1) = 's'
                         THEN left(tok, length(tok) - 1)
                         ELSE tok END,
                    ' ' ORDER BY ord)
         FROM tokens),
        '');
$$;

COMMENT ON FUNCTION public.normalize_packing_label(text) IS
    'Clé de regroupement d''un libellé de packing list (normaliseur v2). Le front et le service Go doivent produire la même valeur.';

-- ─── 2. Le tableau de correspondance ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.packing_label_category (
    raw_label_key        text PRIMARY KEY,
    -- Version du normaliseur qui a produit la clé : une clé d'une autre
    -- version ne doit pas être consultée comme si elle était comparable.
    normalizer_version   smallint NOT NULL DEFAULT 2,
    -- L'orthographe humaine la plus récente, pour l'affichage. La clé, elle,
    -- n'est pas lisible.
    raw_label_sample     text NOT NULL,
    category_id          uuid NOT NULL
                         REFERENCES public.categories_gestion(id) ON DELETE CASCADE,
    -- Combien de packings validées ont confirmé cette correspondance.
    hit_count            integer NOT NULL DEFAULT 1 CHECK (hit_count >= 0),
    -- « déjà validé sur GR 153 » : le signal qui rend l'auto-résolution
    -- vérifiable par l'utilisateur au lieu de magique.
    last_container_label text,
    created_by           uuid DEFAULT auth.uid(),
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.packing_label_category IS
    'Libellé fournisseur normalisé → catégorie. Alimenté par la validation d''une packing list ; consulté à l''import pour retenir une catégorie sans relecture.';

CREATE INDEX IF NOT EXISTS idx_packing_label_category_category
    ON public.packing_label_category (category_id);

DROP TRIGGER IF EXISTS update_packing_label_category_updated_at
    ON public.packing_label_category;
CREATE TRIGGER update_packing_label_category_updated_at
    BEFORE UPDATE ON public.packing_label_category
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 3. RLS ─────────────────────────────────────────────────────────────
-- Même format que 20260915100000 : TO authenticated, has_permission en
-- InitPlan, session AAL2 exigée.

ALTER TABLE public.packing_label_category ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "packing_label_category_select" ON public.packing_label_category;
CREATE POLICY "packing_label_category_select" ON public.packing_label_category
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('stock.packing.view'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "packing_label_category_insert" ON public.packing_label_category;
CREATE POLICY "packing_label_category_insert" ON public.packing_label_category
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT has_permission('stock.packing.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

DROP POLICY IF EXISTS "packing_label_category_update" ON public.packing_label_category;
CREATE POLICY "packing_label_category_update" ON public.packing_label_category
    FOR UPDATE TO authenticated
    USING (
        (SELECT has_permission('stock.packing.update'::text))
        AND (SELECT auth_session_is_aal2())
    )
    WITH CHECK (
        (SELECT has_permission('stock.packing.update'::text))
        AND (SELECT auth_session_is_aal2())
    );

-- Purger une correspondance est aussi lourd que supprimer une packing :
-- même droit, attribué à personne par défaut.
DROP POLICY IF EXISTS "packing_label_category_delete" ON public.packing_label_category;
CREATE POLICY "packing_label_category_delete" ON public.packing_label_category
    FOR DELETE TO authenticated
    USING (
        (SELECT has_permission('stock.packing.delete'::text))
        AND (SELECT auth_session_is_aal2())
    );

-- ─── 4. La validation enseigne le tableau ───────────────────────────────
-- Remplace la version de 20260917100000 : même corps, plus l'UPSERT final.
-- SECURITY INVOKER : c'est la RLS ci-dessus qui arbitre, donc valider une
-- packing exige bien `stock.packing.update`.

CREATE OR REPLACE FUNCTION public.validate_packing_list(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_status    text;
    v_label     text;
    v_unmatched int;
BEGIN
    SELECT status, container_label INTO v_status, v_label
    FROM public.packing_list WHERE id = p_id FOR UPDATE;

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

    UPDATE public.packing_list_ligne
    SET resolution  = 'human',
        reviewed_at = now()
    WHERE packing_list_id = p_id AND resolution IS NULL;

    UPDATE public.packing_list
    SET status = 'validee', validated_at = now(), validated_by = auth.uid()
    WHERE id = p_id;

    -- Le tableau apprend de cette validation. `DISTINCT ON` parce qu'un même
    -- libellé peut couvrir plusieurs lignes : une seule entrée par clé, sinon
    -- l'UPSERT se heurte à lui-même dans la même commande.
    INSERT INTO public.packing_label_category AS d (
        raw_label_key, normalizer_version, raw_label_sample,
        category_id, last_container_label
    )
    SELECT DISTINCT ON (l.raw_label_key)
        l.raw_label_key, l.normalizer_version, l.raw_label, l.category_id, v_label
    FROM public.packing_list_ligne l
    WHERE l.packing_list_id = p_id
      AND l.category_id IS NOT NULL
      AND l.raw_label_key <> ''
    ORDER BY l.raw_label_key, l.position
    ON CONFLICT (raw_label_key) DO UPDATE
    SET category_id          = EXCLUDED.category_id,
        raw_label_sample     = EXCLUDED.raw_label_sample,
        normalizer_version   = EXCLUDED.normalizer_version,
        last_container_label = EXCLUDED.last_container_label,
        -- Le compteur ne repart pas de zéro : il dit la confiance accumulée.
        hit_count            = d.hit_count + 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.normalize_packing_label(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.normalize_packing_label(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_packing_list(uuid)   FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.validate_packing_list(uuid)   TO authenticated;
