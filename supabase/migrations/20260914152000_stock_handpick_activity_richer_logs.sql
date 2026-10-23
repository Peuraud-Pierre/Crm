-- ============================================================
-- stock_handpick — un journal aussi lisible que celui du stock
--
-- `log_handpick_activity` (20260914145000) écrivait le strict
-- minimum : `description` toujours NULL, et `changes` renseigné
-- UNIQUEMENT sur un UPDATE. Une création ou une suppression
-- produisait donc une entrée sans phrase, sans détail, et souvent
-- sans libellé — la colonne lue (`raw_name` d'une balle,
-- `balle_label` d'une ligne de colisage, `container_no` d'un
-- départ) est nullable. À l'écran il ne restait qu'un UUID.
--
-- Les triggers du stock principal (20260601_activity_log_full_changes)
-- écrivent, eux, une phrase et un instantané des colonnes à chaque
-- action. C'est ce comportement qui est repris ici, en restant
-- générique : la fonction ne connaît pas le schéma de ses tables.
--
-- Trois changements :
--   1. `changes` porte un instantané des colonnes sur create/delete ;
--   2. `description` est construite depuis le type d'entité ;
--   3. le second argument du trigger accepte PLUSIEURS colonnes de
--      libellé, séparées par des virgules — la première non vide
--      gagne. Un départ sans conteneur retombe sur son n° interne
--      puis sur son n° de facture.
--
-- Les entrées déjà écrites ne sont pas retouchées : leur contenu
-- n'existe plus nulle part pour les entités supprimées, et un
-- rattrapage partiel donnerait un journal à deux vitesses.
--
-- Idempotent : CREATE OR REPLACE + recréation des triggers.
-- ============================================================

-- ─── 1. Colonnes jamais utiles à la lecture d'un journal ────────────────
-- `id` et les horodatages sont portés par la ligne de journal elle-même ;
-- `created_by` double `user_id`. Les exclure ici plutôt que côté client
-- évite de stocker du bruit à chaque écriture.

CREATE OR REPLACE FUNCTION public.handpick_log_snapshot(record JSONB)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT jsonb_object_agg(e.key, e.value)
    FROM jsonb_each(record - ARRAY['id', 'created_at', 'updated_at', 'created_by']) AS e
    WHERE e.value <> 'null'::jsonb
$$;

COMMENT ON FUNCTION public.handpick_log_snapshot(JSONB) IS
    'Instantané lisible d''une ligne : colonnes techniques et valeurs nulles '
    'retirées. Sert de `changes` sur une création ou une suppression, là où un '
    'UPDATE stocke un diff.';

-- ─── 2. Phrase de description ───────────────────────────────────────────
-- Le français impose l'accord : « Balle créée », « Fournisseur créé ». Le
-- genre vit ici plutôt que dans chaque appel de trigger, qui l'oublierait.

CREATE OR REPLACE FUNCTION public.handpick_log_description(
    entity_type TEXT,
    action      TEXT,
    label       TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
    v_noun   TEXT;
    v_female BOOLEAN;
    v_verb   TEXT;
BEGIN
    SELECT n, f INTO v_noun, v_female FROM (VALUES
        ('balle',       'Balle',                 TRUE),
        ('category',    'Catégorie',             TRUE),
        ('fournisseur', 'Fournisseur',           FALSE),
        ('flux',        'Expédition',            TRUE),
        ('mouvement',   'Ligne de colisage',     TRUE),
        ('zone',        'Zone',                  TRUE),
        ('emplacement', 'Emplacement',           FALSE)
    ) AS t(k, n, f) WHERE t.k = entity_type;

    IF v_noun IS NULL THEN
        RETURN NULL;
    END IF;

    v_verb := CASE action
        WHEN 'create' THEN CASE WHEN v_female THEN 'créée'       ELSE 'créé'       END
        WHEN 'update' THEN CASE WHEN v_female THEN 'mise à jour' ELSE 'mis à jour' END
        WHEN 'delete' THEN CASE WHEN v_female THEN 'supprimée'   ELSE 'supprimé'   END
    END;

    IF label IS NULL OR btrim(label) = '' THEN
        RETURN v_noun || ' ' || v_verb;
    END IF;

    RETURN v_noun || ' ' || v_verb || ' : ' || label;
END;
$$;

-- ─── 3. Trigger générique ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_handpick_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_entity_type TEXT := TG_ARGV[0];
    -- Une ou plusieurs colonnes séparées par des virgules : la première
    -- non vide fournit le libellé.
    v_label_cols  TEXT[] := string_to_array(TG_ARGV[1], ',');
    v_col         TEXT;
    v_action      TEXT;
    v_record      JSONB;
    v_entity_id   TEXT;
    v_label       TEXT;
    v_changes     JSONB;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_action  := 'delete';
        v_record  := to_jsonb(OLD);
        v_changes := public.handpick_log_snapshot(v_record);
    ELSIF TG_OP = 'INSERT' THEN
        v_action  := 'create';
        v_record  := to_jsonb(NEW);
        v_changes := public.handpick_log_snapshot(v_record);
    ELSE
        v_action := 'update';
        v_record := to_jsonb(NEW);

        -- Diff générique : toutes les colonnes réellement modifiées.
        -- updated_at est exclue, elle change à chaque UPDATE par
        -- construction et n'apprend rien.
        SELECT jsonb_object_agg(
                   o.key,
                   jsonb_build_object('before', o.value, 'after', n.value)
               )
        INTO v_changes
        FROM jsonb_each(to_jsonb(OLD)) o
        JOIN jsonb_each(to_jsonb(NEW)) n ON n.key = o.key
        WHERE o.value IS DISTINCT FROM n.value
          AND o.key <> 'updated_at';

        -- Rien d'autre que updated_at n'a bougé : pas de bruit dans le feed.
        IF v_changes IS NULL THEN
            RETURN NULL;
        END IF;
    END IF;

    v_entity_id := v_record ->> 'id';

    FOREACH v_col IN ARRAY v_label_cols LOOP
        v_label := btrim(COALESCE(v_record ->> btrim(v_col), ''));
        EXIT WHEN v_label <> '';
    END LOOP;

    IF v_label = '' THEN
        v_label := NULL;
    END IF;

    INSERT INTO public.activity_log_handpick (
        user_id, entity_type, entity_id, entity_label, action, description, changes
    ) VALUES (
        auth.uid(),
        v_entity_type,
        v_entity_id,
        v_label,
        v_action,
        public.handpick_log_description(v_entity_type, v_action, v_label),
        v_changes
    );

    RETURN NULL;  -- trigger AFTER : la valeur de retour est ignorée
END;
$$;

-- ─── 4. Repli de libellé sur les entités qui en manquent souvent ────────
-- Seuls les triggers dont la colonne de libellé est fréquemment vide sont
-- recréés ; les autres gardent leur définition d'origine.

DROP TRIGGER IF EXISTS log_flux_handpick_activity ON public.flux_handpick;
CREATE TRIGGER log_flux_handpick_activity
    AFTER INSERT OR UPDATE OR DELETE ON public.flux_handpick
    FOR EACH ROW EXECUTE FUNCTION
        public.log_handpick_activity('flux', 'container_no,conteneur_no_raw,invoice_no');

DROP TRIGGER IF EXISTS log_mouvements_handpick_activity ON public.mouvements_handpick;
CREATE TRIGGER log_mouvements_handpick_activity
    AFTER INSERT OR UPDATE OR DELETE ON public.mouvements_handpick
    FOR EACH ROW EXECUTE FUNCTION
        public.log_handpick_activity('mouvement', 'balle_label');
