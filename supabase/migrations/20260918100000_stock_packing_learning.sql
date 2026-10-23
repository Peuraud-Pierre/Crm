-- ============================================================================
-- Packing lists — le classement apprend de chaque décision humaine
--
-- Suite de `20260917101000_stock_packing_label_dictionary.sql`.
--
-- POURQUOI
-- --------
-- Le tableau de correspondance ne reconnaît que des libellés IDENTIQUES à
-- ceux déjà validés : 40 % des lignes de GR154 après GR153, et rien de plus
-- tant que le fournisseur varie ses libellés (« POLO MEN SHIRT » puis
-- « POLO LADIES SHIRT »). Il n'apprend en plus qu'à la validation.
--
-- Le service `packing-api` (Python) entraîne désormais un modèle sur les
-- décisions humaines. Pour cela, chaque décision doit être CONSERVÉE avec ce
-- qui avait été proposé au moment où l'humain a tranché : c'est à la fois la
-- donnée d'apprentissage et la mesure de la précision du modèle.
--
-- CE QUE CETTE MIGRATION AJOUTE
-- -----------------------------
--  1. `resolution = 'model'` : une ligne classée seule par le modèle. Il ne le
--     fait que sous une garde calibrée sur sa précision MESURÉE (voir
--     `packing-api/app/classifier/engine.py`). La ligne reste visible et
--     corrigeable ; la corriger la repasse en `human`.
--  2. `suggestion_source` : d'où venait la proposition affichée.
--  3. `packing_label_feedback` : une ligne par décision, écrite par trigger.
--     Le front n'a rien à changer : ses UPDATE `resolution = 'human'`
--     l'alimentent déjà.
--  4. `classifier_meta` : la trace d'audit de chaque import (seuil utilisé,
--     précision mesurée, nombre d'exemples).
--
-- RÈGLES DE RIGUEUR (amendées, pas assouplies)
-- --------------------------------------------
--  · Une ligne classée par le modèle et validée SANS retouche ne devient PAS
--    une entrée du tableau de correspondance, et n'entraîne PAS le modèle : ce
--    serait s'auto-renforcer. Elle sert seulement à MESURER sa précision
--    (`decision = 'implicit'`).
--  · Seul un humain enseigne : `decision = 'explicit'`.
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================================

-- ─── 1. Lignes : la provenance de la catégorie et de la proposition ─────

-- La contrainte d'origine vient d'un `ADD COLUMN ... CHECK` sans nom : on ne
-- se fie pas au nom que Postgres lui a donné. Si elle survivait, elle
-- refuserait silencieusement chaque ligne 'model' et l'import passerait en échec.
DO $$
DECLARE
    v_name text;
BEGIN
    FOR v_name IN
        SELECT c.conname
        FROM pg_constraint c
        WHERE c.conrelid = 'public.packing_list_ligne'::regclass
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) ILIKE '%resolution%'
    LOOP
        EXECUTE format('ALTER TABLE public.packing_list_ligne DROP CONSTRAINT %I', v_name);
    END LOOP;
END;
$$;

ALTER TABLE public.packing_list_ligne
    ADD CONSTRAINT packing_list_ligne_resolution_check
        CHECK (resolution IS NULL OR resolution IN ('dictionary', 'model', 'human'));

COMMENT ON COLUMN public.packing_list_ligne.resolution IS
    'NULL = suggestion non retenue. dictionary = libellé déjà validé. model = classée par le modèle sous garde calibrée. human = arbitrage humain.';

ALTER TABLE public.packing_list_ligne
    ADD COLUMN IF NOT EXISTS suggestion_source text
        CHECK (suggestion_source IS NULL OR suggestion_source IN ('dictionary', 'model', 'name'));

COMMENT ON COLUMN public.packing_list_ligne.suggestion_source IS
    'Provenance de suggested_category_id : dictionary (correspondance exacte), model (appris), name (nom de catégorie, au démarrage).';

-- ─── 2. En-tête : la trace d'audit du classement ────────────────────────

ALTER TABLE public.packing_list
    ADD COLUMN IF NOT EXISTS classifier_meta jsonb;

COMMENT ON COLUMN public.packing_list.classifier_meta IS
    'État du classement au moment de l''import : version, seuil calibré, précision mesurée, exemples, répartition des lignes.';

-- ─── 3. Le journal des décisions ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.packing_label_feedback (
    -- Une décision par ligne : une correction REMPLACE la décision précédente.
    packing_list_ligne_id  uuid PRIMARY KEY
                           REFERENCES public.packing_list_ligne(id) ON DELETE CASCADE,
    packing_list_id        uuid NOT NULL
                           REFERENCES public.packing_list(id) ON DELETE CASCADE,
    raw_label_key          text NOT NULL,
    normalizer_version     smallint NOT NULL,
    -- Ce que l'humain a retenu.
    category_id            uuid NOT NULL
                           REFERENCES public.categories_gestion(id) ON DELETE CASCADE,
    -- Ce qui était proposé au moment où il a tranché : c'est ce qui permet
    -- de mesurer si le modèle avait raison.
    suggested_category_id  uuid REFERENCES public.categories_gestion(id) ON DELETE SET NULL,
    suggestion_source      text
                           CHECK (suggestion_source IS NULL OR suggestion_source IN ('dictionary', 'model', 'name')),
    suggested_confidence   numeric
                           CHECK (suggested_confidence IS NULL OR suggested_confidence BETWEEN 0 AND 1),
    -- explicit = un humain a choisi la catégorie : donnée d'apprentissage.
    -- implicit = classée par le modèle, validée sans retouche : mesure seule.
    decision               text NOT NULL CHECK (decision IN ('explicit', 'implicit')),
    decided_by             uuid DEFAULT auth.uid(),
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.packing_label_feedback IS
    'Décisions humaines sur les lignes de packing, avec la proposition affichée à ce moment. Entraîne et calibre le classement de packing-api. Écrite par trigger uniquement.';

CREATE INDEX IF NOT EXISTS idx_packing_label_feedback_packing
    ON public.packing_label_feedback (packing_list_id);
CREATE INDEX IF NOT EXISTS idx_packing_label_feedback_key
    ON public.packing_label_feedback (raw_label_key);

DROP TRIGGER IF EXISTS update_packing_label_feedback_updated_at
    ON public.packing_label_feedback;
CREATE TRIGGER update_packing_label_feedback_updated_at
    BEFORE UPDATE ON public.packing_label_feedback
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lecture seule pour les utilisateurs. Aucune politique d'écriture : seuls
-- les triggers ci-dessous (SECURITY DEFINER) écrivent, ce qui garantit que
-- chaque décision correspond à un UPDATE réellement accepté par la RLS de
-- `packing_list_ligne`.
ALTER TABLE public.packing_label_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "packing_label_feedback_select" ON public.packing_label_feedback;
CREATE POLICY "packing_label_feedback_select" ON public.packing_label_feedback
    FOR SELECT TO authenticated
    USING (
        (SELECT has_permission('stock.packing.view'::text))
        AND (SELECT auth_session_is_aal2())
    );

-- ─── 4. Chaque décision humaine est journalisée ─────────────────────────
-- Le front écrit `category_id` + `resolution = 'human'` (assignGroup,
-- assignGroupUnmatched, assignManyUnmatched, assignLigne) : c'est le seul
-- signal nécessaire.

CREATE OR REPLACE FUNCTION public.packing_label_feedback_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.category_id IS NULL THEN
        -- Décision retirée : elle ne doit plus rien enseigner.
        DELETE FROM public.packing_label_feedback
        WHERE packing_list_ligne_id = NEW.id;
    ELSIF NEW.resolution = 'human' THEN
        INSERT INTO public.packing_label_feedback AS f (
            packing_list_ligne_id, packing_list_id, raw_label_key, normalizer_version,
            category_id, suggested_category_id, suggestion_source, suggested_confidence,
            decision, decided_by
        ) VALUES (
            NEW.id, NEW.packing_list_id, NEW.raw_label_key, NEW.normalizer_version,
            NEW.category_id, NEW.suggested_category_id, NEW.suggestion_source, NEW.match_confidence,
            'explicit', auth.uid()
        )
        ON CONFLICT (packing_list_ligne_id) DO UPDATE
        SET category_id = EXCLUDED.category_id,
            decision    = 'explicit',
            decided_by  = EXCLUDED.decided_by;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS packing_label_feedback_record ON public.packing_list_ligne;
CREATE TRIGGER packing_label_feedback_record
    AFTER UPDATE OF category_id, resolution ON public.packing_list_ligne
    FOR EACH ROW
    WHEN (OLD.category_id IS DISTINCT FROM NEW.category_id
          OR OLD.resolution IS DISTINCT FROM NEW.resolution)
    EXECUTE FUNCTION public.packing_label_feedback_record();

-- ─── 5. Valider une packing mesure le modèle ────────────────────────────
-- Sans cela, seules les ERREURS du modèle (corrigées par un humain) seraient
-- journalisées, jamais ses réussites : sa précision mesurée s'effondrerait et
-- l'auto se couperait d'elle-même. Rouvrir la packing retire ces mesures ;
-- la valider à nouveau les repose.

CREATE OR REPLACE FUNCTION public.packing_label_feedback_on_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'validee' AND OLD.status IS DISTINCT FROM 'validee' THEN
        INSERT INTO public.packing_label_feedback (
            packing_list_ligne_id, packing_list_id, raw_label_key, normalizer_version,
            category_id, suggested_category_id, suggestion_source, suggested_confidence,
            decision, decided_by
        )
        SELECT l.id, l.packing_list_id, l.raw_label_key, l.normalizer_version,
               l.category_id, l.suggested_category_id, l.suggestion_source, l.match_confidence,
               'implicit', auth.uid()
        FROM public.packing_list_ligne l
        WHERE l.packing_list_id = NEW.id
          AND l.resolution = 'model'
          AND l.category_id IS NOT NULL
        ON CONFLICT (packing_list_ligne_id) DO NOTHING;
    ELSIF OLD.status = 'validee' AND NEW.status IS DISTINCT FROM 'validee' THEN
        DELETE FROM public.packing_label_feedback
        WHERE packing_list_id = NEW.id AND decision = 'implicit';
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS packing_label_feedback_on_status ON public.packing_list;
CREATE TRIGGER packing_label_feedback_on_status
    AFTER UPDATE OF status ON public.packing_list
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.packing_label_feedback_on_status();

REVOKE EXECUTE ON FUNCTION public.packing_label_feedback_record()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.packing_label_feedback_on_status() FROM PUBLIC, anon, authenticated;

-- ─── 6. Rattrapage : les décisions déjà prises en base ──────────────────
-- Les lignes tranchées avant cette migration (faux import de dev compris)
-- deviennent des exemples. Leur proposition d'origine n'a pas été tracée :
-- `suggestion_source` reste NULL, elles n'entrent donc pas dans la mesure
-- de précision du modèle.

INSERT INTO public.packing_label_feedback (
    packing_list_ligne_id, packing_list_id, raw_label_key, normalizer_version,
    category_id, suggested_category_id, suggestion_source, suggested_confidence,
    decision, decided_by
)
SELECT l.id, l.packing_list_id, l.raw_label_key, l.normalizer_version,
       l.category_id, l.suggested_category_id, NULL, l.match_confidence,
       'explicit', l.reviewed_by
FROM public.packing_list_ligne l
WHERE l.resolution = 'human'
  AND l.category_id IS NOT NULL
ON CONFLICT (packing_list_ligne_id) DO NOTHING;

-- ─── 7. Validation : le modèle n'écrit pas dans le tableau ──────────────
-- Remplace la version de 20260917101000 : même corps, mais l'UPSERT du
-- tableau de correspondance exclut les lignes classées par le modèle. Une
-- supposition, même juste, ne devient pas une vérité exacte sans qu'un
-- humain l'ait choisie.

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
      AND l.resolution IS DISTINCT FROM 'model'
    ORDER BY l.raw_label_key, l.position
    ON CONFLICT (raw_label_key) DO UPDATE
    SET category_id          = EXCLUDED.category_id,
        raw_label_sample     = EXCLUDED.raw_label_sample,
        normalizer_version   = EXCLUDED.normalizer_version,
        last_container_label = EXCLUDED.last_container_label,
        hit_count            = d.hit_count + 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_packing_list(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.validate_packing_list(uuid) TO authenticated;

-- ─── 8. Vue de synthèse ─────────────────────────────────────────────────
-- Recréée : `p.*` est figé à la création de la vue, il faut la reconstruire
-- pour qu'elle porte `classifier_meta`, et elle compte désormais les lignes
-- classées par le modèle.

DROP VIEW IF EXISTS public.v_packing_list_summary;

CREATE VIEW public.v_packing_list_summary
WITH (security_invoker = true) AS
SELECT
    p.*,
    COUNT(l.id)::int                                                      AS line_count,
    COUNT(l.id) FILTER (WHERE l.category_id IS NULL)::int                 AS lines_unmatched,
    COUNT(l.id) FILTER (WHERE l.resolution = 'dictionary')::int           AS lines_from_dictionary,
    COUNT(l.id) FILTER (WHERE l.resolution = 'model')::int                AS lines_from_model,
    COUNT(l.id) FILTER (WHERE l.resolution = 'human')::int                AS lines_reviewed,
    COALESCE(SUM(l.package_count), 0)::int                                AS total_packages,
    COALESCE(SUM(l.declared_total) FILTER (WHERE l.unit_kind = 'pcs'), 0) AS total_pieces,
    COALESCE(SUM(l.declared_total) FILTER (WHERE l.unit_kind = 'kgs'), 0) AS total_weight_kg,
    COUNT(l.id) FILTER (
        WHERE l.package_count IS NOT NULL
          AND l.units_per_package IS NOT NULL
          AND (l.declared_total IS NULL
               OR l.declared_total <> l.units_per_package * l.package_count)
    )::int                                                                AS rows_failing_math,
    CASE
        WHEN p.declared_package_count IS NULL THEN NULL
        ELSE COALESCE(SUM(l.package_count), 0)::int - p.declared_package_count
    END                                                                   AS package_count_gap
FROM public.packing_list p
LEFT JOIN public.packing_list_ligne l ON l.packing_list_id = p.id
GROUP BY p.id;
