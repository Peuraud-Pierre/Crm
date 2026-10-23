-- ============================================================================
-- Packing lists — la forme réelle du document fournisseur
--
-- Suite de `20260915100000_stock_packing_list.sql`, qui est DÉJÀ APPLIQUÉE en
-- base de dev : on ne l'amende pas, on la corrige ici.
--
-- POURQUOI
-- --------
-- Le modèle initial portait deux nombres par ligne (`weight_kg`, `quantity`).
-- Deux packings réelles (CONTENEUR GR153, GR154) en portent QUATRE, dans deux
-- régimes d'unité mutuellement exclusifs :
--
--     ITEM # | DESCRIPTION  | (*) | KGS | PCS | QTY | TOTAL PCS/KG
--        1   | POLO T-SHIRT |     |     | 200 |  20 | 4000   ← régime « pcs »
--       12   | LADIES CORSET|     |  25 | KGS |   3 |   75   ← régime « kgs »
--
--   · QTY  = nombre de COLIS. C'est la seule grandeur additive du document,
--     et la seule que le fournisseur totalise lui-même en pied de page
--     (« TOTAL : 548 - PACKAGES »).
--   · PCS ou KGS = contenu d'UN colis, selon le régime de la ligne. Le
--     littéral « KGS » peut se trouver dans la colonne PCS (GR153, ligne 17).
--   · TOTAL PCS/KG mélange pièces et kilos dans une même colonne : il ne se
--     somme pas. Sur GR153, 93 lignes sur 97 ne portent AUCUN poids — d'où un
--     `SUM(weight_kg)` à zéro et un écart de poids faux à chaque import.
--
-- Aucune packing réelle n'a encore été importée : les seules lignes en base
-- viennent du faux import de développement. `weight_kg` et `quantity` sont
-- donc SUPPRIMÉES plutôt que conservées par compatibilité.
--
-- Deux contrôles deviennent possibles, et ce sont eux qui dispensent l'humain
-- de vérifier les nombres de 180 lignes :
--   1. par ligne   : units_per_package × package_count = declared_total ?
--   2. par fichier : Σ package_count = declared_package_count ?
--      (GR153 : 543 calculés contre 548 déclarés — le fichier du fournisseur
--      ne se recoupe pas lui-même. GR154 : 553 = 553.)
--
-- `container_label` (le titre lu en tête de feuille) permet en plus de
-- détecter le mauvais fichier attaché au mauvais arrivage, classe d'erreur
-- que rien ne couvrait.
-- ============================================================================

-- ─── 1. Lignes : les quatre nombres du document ─────────────────────────
-- La vue de synthèse tombe D'ABORD : elle somme `weight_kg` et `quantity`, et
-- Postgres refuse de retirer une colonne dont une vue dépend. Elle est
-- recréée en section 3, sur les nouvelles colonnes.

DROP VIEW IF EXISTS public.v_packing_list_summary;

ALTER TABLE public.packing_list_ligne
    DROP COLUMN IF EXISTS weight_kg,
    DROP COLUMN IF EXISTS quantity;

ALTER TABLE public.packing_list_ligne
    -- Colonne QTY : nombre de colis. La seule grandeur additive.
    ADD COLUMN IF NOT EXISTS package_count integer
        CHECK (package_count IS NULL OR package_count >= 0),
    -- Contenu d'un colis : pièces ou kilos selon `unit_kind`.
    ADD COLUMN IF NOT EXISTS units_per_package numeric
        CHECK (units_per_package IS NULL OR units_per_package >= 0),
    ADD COLUMN IF NOT EXISTS unit_kind text
        CHECK (unit_kind IS NULL OR unit_kind IN ('pcs', 'kgs')),
    -- Colonne TOTAL PCS/KG telle que lue. Nullable : 3 lignes de GR153 ne la
    -- renseignent pas, et c'est précisément ce que le contrôle doit signaler.
    ADD COLUMN IF NOT EXISTS declared_total numeric
        CHECK (declared_total IS NULL OR declared_total >= 0),
    -- N° de ligne dans la feuille, pour pointer l'anomalie dans le fichier
    -- d'origine. `position` ordonne l'écran, `source_row` désigne le document.
    ADD COLUMN IF NOT EXISTS source_row integer,
    -- NULL = simple suggestion, que seul un humain peut retenir.
    -- 'dictionary' = correspondance exacte d'un libellé déjà validé ailleurs.
    -- 'human'      = un humain a tranché.
    ADD COLUMN IF NOT EXISTS resolution text
        CHECK (resolution IS NULL OR resolution IN ('dictionary', 'human')),
    -- Version du normaliseur qui a produit `raw_label_key`. Si le normaliseur
    -- change, les clés périmées cessent de correspondre au lieu de
    -- correspondre à tort.
    ADD COLUMN IF NOT EXISTS normalizer_version smallint NOT NULL DEFAULT 2;

COMMENT ON COLUMN public.packing_list_ligne.package_count IS
    'Colonne QTY du fichier : nombre de colis. Seule grandeur additive.';
COMMENT ON COLUMN public.packing_list_ligne.units_per_package IS
    'Contenu d''un colis : pièces si unit_kind = pcs, kilos si unit_kind = kgs.';
COMMENT ON COLUMN public.packing_list_ligne.declared_total IS
    'Colonne TOTAL PCS/KG telle que lue, sans recalcul. NULL = absente du fichier.';
COMMENT ON COLUMN public.packing_list_ligne.resolution IS
    'NULL = suggestion non retenue. dictionary = libellé déjà validé. human = arbitrage humain.';

-- `fetchLignes` trie sur `position` : l'index manquait.
CREATE INDEX IF NOT EXISTS idx_packing_list_ligne_position
    ON public.packing_list_ligne (packing_list_id, position);

-- ─── 2. En-tête : ce que le fichier déclare de lui-même ─────────────────

ALTER TABLE public.packing_list
    -- Total de colis annoncé en pied de page. Le juge de paix du fichier.
    ADD COLUMN IF NOT EXISTS declared_package_count integer
        CHECK (declared_package_count IS NULL OR declared_package_count >= 0),
    -- Titre lu en tête de feuille (« CONTENEUR GR 153 »), à comparer au
    -- container_no de l'arrivage : détecte un fichier mal attaché.
    ADD COLUMN IF NOT EXISTS container_label text,
    -- Nom de la feuille lue. GR153 dit « Invoice », GR154 dit « Sheet1 » :
    -- la feuille ne se devine pas par son nom, on trace celle qu'on a prise.
    ADD COLUMN IF NOT EXISTS source_sheet text;

COMMENT ON COLUMN public.packing_list.declared_package_count IS
    'Total de colis annoncé par le fichier lui-même (pied de page).';
COMMENT ON COLUMN public.packing_list.container_label IS
    'Titre lu en tête du fichier, à rapprocher de arrivage_manuel.container_no.';

-- ─── 3. Vue de synthèse ─────────────────────────────────────────────────
-- `lines_to_review` et `lines_unmatched` comptaient deux choses différentes
-- parce que l'import pré-remplissait `category_id` avec ses propositions.
-- Désormais seule une correspondance exacte le fait, donc les deux comptes se
-- confondent : `lines_unmatched` reste seul, et il dit le travail restant.
--
-- Les totaux ne se mélangent plus : les colis d'un côté, les pièces et les
-- kilos chacun dans leur régime.

CREATE VIEW public.v_packing_list_summary
WITH (security_invoker = true) AS
SELECT
    p.*,
    COUNT(l.id)::int                                                      AS line_count,
    COUNT(l.id) FILTER (WHERE l.category_id IS NULL)::int                 AS lines_unmatched,
    COUNT(l.id) FILTER (WHERE l.resolution = 'dictionary')::int           AS lines_from_dictionary,
    COUNT(l.id) FILTER (WHERE l.resolution = 'human')::int                AS lines_reviewed,
    COALESCE(SUM(l.package_count), 0)::int                                AS total_packages,
    COALESCE(SUM(l.declared_total) FILTER (WHERE l.unit_kind = 'pcs'), 0) AS total_pieces,
    COALESCE(SUM(l.declared_total) FILTER (WHERE l.unit_kind = 'kgs'), 0) AS total_weight_kg,
    -- Lignes dont l'arithmétique du fichier ne tombe pas juste, total absent
    -- compris : c'est la courte liste à faire relire, au lieu des 180 lignes.
    COUNT(l.id) FILTER (
        WHERE l.package_count IS NOT NULL
          AND l.units_per_package IS NOT NULL
          AND (l.declared_total IS NULL
               OR l.declared_total <> l.units_per_package * l.package_count)
    )::int                                                                AS rows_failing_math,
    -- Positif : le fichier contient plus de colis qu'il n'en annonce.
    -- NULL quand le fichier n'annonce aucun total : pas d'écart sans référence.
    CASE
        WHEN p.declared_package_count IS NULL THEN NULL
        ELSE COALESCE(SUM(l.package_count), 0)::int - p.declared_package_count
    END                                                                   AS package_count_gap
FROM public.packing_list p
LEFT JOIN public.packing_list_ligne l ON l.packing_list_id = p.id
GROUP BY p.id;

-- ─── 4. Validation : ne pas signer à la place de l'humain ───────────────
-- L'ancienne version estampillait `reviewed_at` sur toutes les lignes non
-- vérifiées au moment de valider. Une ligne venue du dictionnaire se faisait
-- ainsi passer pour une vérification humaine. On distingue désormais les deux
-- provenances : valider vaut arbitrage humain pour les lignes qui n'en avaient
-- aucun, les lignes du dictionnaire gardent la leur.

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

    UPDATE public.packing_list_ligne
    SET resolution  = 'human',
        reviewed_at = now()
    WHERE packing_list_id = p_id AND resolution IS NULL;

    UPDATE public.packing_list
    SET status = 'validee', validated_at = now(), validated_by = auth.uid()
    WHERE id = p_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_packing_list(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.validate_packing_list(uuid) TO authenticated;
