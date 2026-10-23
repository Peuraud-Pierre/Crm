-- ============================================================
-- Stock — Salle de tri : historique des feuilles de tri
-- Date: 2026-10-01 (modèle réécrit le 2026-10-02)
--
-- Contexte
-- --------
-- Les trieurs ouvrent des balles et répartissent le contenu de chacune
-- entre les sorties (MAG, KS, SO3, EXPORT…). Leurs feuilles papier sont
-- centralisées par le responsable de la salle de tri, qui les saisit
-- ici : l'historique de ce qui a été trié évite de racheter alors que le
-- stock trié existe.
--
-- Modèle :
--   FICHE        trieur, date, heure de début et de fin ;
--   BALLE        une ligne de la feuille : fournisseur, catégorie, poids
--                initial, qualité 1 à 3, note. Le fournisseur est celui de
--                la BALLE : une même séance trie des balles de plusieurs
--                fournisseurs, et c'est par balle que l'on juge la qualité
--                de ce qu'envoie chacun ;
--   RÉPARTITION  kilos de la balle par type de sortie. 100 kg de
--                pantalons se RÉPARTISSENT entre MAG, KS, SO3… — ce n'est
--                pas un choix d'une sortie par ligne.
-- Un écart entre poids initial et total réparti est ADMIS (pesée, perte,
-- oubli) : les vues le calculent et l'exposent, la base ne le refuse pas.
-- Les totaux ne sont jamais stockés : `v_fiches_tri` les dérive.
--
-- Réécrite en place le 2026-10-02 : la première version (une ligne =
-- catégorie + UN type de sortie, temps saisi en texte, balle BIN, note de
-- fiche) n'avait été appliquée qu'en dev.
--
-- Les trieurs n'ont PAS de compte : `trieurs` est un référentiel, pas
-- une table de profils.
--
-- L'ancienne feature `sorters` (table `sorting_reports`, non routée)
-- n'est pas reprise : un trieur y saisissait lui-même son rapport
-- (`user_id = auth.uid()`), une ligne par balle, colonnes MAG/KS/SO3
-- à plat, fournisseur sur l'ancienne table `fournisseur`.
--
-- Écriture d'une fiche : UNIQUEMENT par `save_fiche_tri` (RPC). La RLS
-- n'ouvre en écriture directe que la suppression. Deux raisons :
--   * en-tête + balles + répartition en une seule transaction — sinon
--     une balle en échec laisse une fiche à moitié écrite ;
--   * le journal : la RPC écrit UNE entrée par enregistrement ; des
--     triggers par ligne produiraient une rafale illisible (et l'INSERT
--     de l'en-tête ne verrait encore aucune balle).
--
-- ⚠️ AUCUN BACKFILL de permissions (même décision que le handpick) :
-- au déploiement personne ne voit la page, administrateur compris.
-- S'accorder `stock.tri.*` depuis /administration.
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================


-- ─── 1. Permissions ─────────────────────────────────────────────────────────

INSERT INTO public.permissions (code, label, category)
SELECT v.code, v.label, 'stock'
FROM (VALUES
    ('stock.tri.view',   'Voir la salle de tri'),
    ('stock.tri.create', 'Saisir une fiche de tri / ajouter un trieur'),
    ('stock.tri.update', 'Modifier une fiche de tri / un trieur'),
    ('stock.tri.delete', 'Supprimer une fiche de tri / un trieur')
) AS v(code, label)
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions p WHERE p.code = v.code
);


-- ─── 2. Référentiels ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trieurs (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    nom        text        NOT NULL CHECK (btrim(nom) <> ''),
    actif      boolean     NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Deux « Karim » distincts fausseraient les statistiques par trieur.
CREATE UNIQUE INDEX IF NOT EXISTS trieurs_nom_unique
    ON public.trieurs (lower(btrim(nom)));

-- Type de sortie : référentiel éditable plutôt qu'enum. L'ancienne
-- feature distinguait déjà KS été / KS hiver et un type « Client » ;
-- les équipes en redemanderont, sans migration ce jour-là. Son `ordre`
-- fixe sa colonne dans la saisie et sa couleur dans les graphiques.
CREATE TABLE IF NOT EXISTS public.tri_sorties (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    code       text        NOT NULL CHECK (btrim(code) <> ''),
    libelle    text        NOT NULL CHECK (btrim(libelle) <> ''),
    ordre      integer     NOT NULL DEFAULT 0,
    actif      boolean     NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tri_sorties_code_unique
    ON public.tri_sorties (upper(btrim(code)));

INSERT INTO public.tri_sorties (code, libelle, ordre)
SELECT v.code, v.libelle, v.ordre
FROM (VALUES
    ('MAG',    'Magasin',  1),
    ('KS',     'Kilo shop', 2),
    ('SO3',    'SO3',      3),
    ('EXPORT', 'Export',   4)
) AS v(code, libelle, ordre)
WHERE NOT EXISTS (
    SELECT 1 FROM public.tri_sorties s WHERE upper(btrim(s.code)) = v.code
);


-- ─── 3. Fiches, balles et répartition ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fiches_tri (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Numéro lisible, affiché « T-0142 ». Jamais réutilisé.
    numero         bigint      GENERATED ALWAYS AS IDENTITY UNIQUE,
    date_tri       date        NOT NULL DEFAULT current_date,
    trieur_id      uuid        NOT NULL REFERENCES public.trieurs(id) ON DELETE RESTRICT,
    -- Plage de travail recopiée de la feuille. Facultative, mais entière :
    -- un début sans fin ne donne aucune durée exploitable.
    heure_debut    time,
    heure_fin      time,
    -- Dérivée, jamais saisie : les statistiques (kg/h) la lisent telle quelle.
    duree_minutes  integer     GENERATED ALWAYS AS (
        (EXTRACT(EPOCH FROM (heure_fin - heure_debut)) / 60)::integer
    ) STORED,
    created_by     uuid        DEFAULT auth.uid(),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fiches_tri_horaires_check CHECK (
        (heure_debut IS NULL AND heure_fin IS NULL)
        OR (heure_debut IS NOT NULL AND heure_fin IS NOT NULL AND heure_fin > heure_debut)
    )
);

CREATE INDEX IF NOT EXISTS fiches_tri_date_idx        ON public.fiches_tri (date_tri DESC);
CREATE INDEX IF NOT EXISTS fiches_tri_trieur_idx      ON public.fiches_tri (trieur_id);

-- Une ligne de la feuille = une balle ouverte par le trieur.
CREATE TABLE IF NOT EXISTS public.fiches_tri_balles (
    id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    fiche_id         uuid          NOT NULL REFERENCES public.fiches_tri(id) ON DELETE CASCADE,
    ordre            integer       NOT NULL DEFAULT 0,
    fournisseur_id   uuid          NOT NULL REFERENCES public.fournisseur_gestion(id) ON DELETE RESTRICT,
    category_id      uuid          NOT NULL REFERENCES public.categories_gestion(id) ON DELETE RESTRICT,
    poids_initial_kg numeric(10,2) NOT NULL CHECK (poids_initial_kg > 0),
    qualite          smallint      NOT NULL CHECK (qualite BETWEEN 1 AND 3),
    note             text
);

CREATE INDEX IF NOT EXISTS fiches_tri_balles_fiche_idx    ON public.fiches_tri_balles (fiche_id);
CREATE INDEX IF NOT EXISTS fiches_tri_balles_category_idx    ON public.fiches_tri_balles (category_id);
CREATE INDEX IF NOT EXISTS fiches_tri_balles_fournisseur_idx ON public.fiches_tri_balles (fournisseur_id);

-- Kilos d'une balle par type de sortie. Une sortie à zéro n'a pas de ligne.
CREATE TABLE IF NOT EXISTS public.fiches_tri_repartition (
    balle_id  uuid          NOT NULL REFERENCES public.fiches_tri_balles(id) ON DELETE CASCADE,
    sortie_id uuid          NOT NULL REFERENCES public.tri_sorties(id) ON DELETE RESTRICT,
    poids_kg  numeric(10,2) NOT NULL CHECK (poids_kg > 0),
    PRIMARY KEY (balle_id, sortie_id)
);

CREATE INDEX IF NOT EXISTS fiches_tri_repartition_sortie_idx ON public.fiches_tri_repartition (sortie_id);


-- ─── 4. Vues : balles et fiches, totaux dérivés ─────────────────────────────
-- `security_invoker` : les vues appliquent la RLS de l'appelant. Sans cette
-- option, elles s'exécuteraient avec les droits de leur propriétaire et
-- exposeraient toutes les fiches à quiconque peut les lire.
--
-- Écart = réparti − initial : négatif quand il manque des kilos. Une balle
-- est « en écart » dès 0,01 kg (les poids ont deux décimales).
--
-- Ordre des DROP : la vue des fiches dépend de celle des balles.

DROP VIEW IF EXISTS public.v_fiches_tri;
DROP VIEW IF EXISTS public.v_fiches_tri_balles;

-- Jointure GAUCHE sur les fournisseurs : sans droit de lecture sur le
-- référentiel, le nom est NULL mais la balle reste.
CREATE VIEW public.v_fiches_tri_balles
WITH (security_invoker = true) AS
SELECT
    b.*,
    fo.name                                        AS fournisseur_nom,
    COALESCE(r.reparti_kg, 0)                      AS poids_reparti_kg,
    COALESCE(r.reparti_kg, 0) - b.poids_initial_kg AS ecart_kg
FROM public.fiches_tri_balles b
LEFT JOIN public.fournisseur_gestion fo ON fo.id = b.fournisseur_id
LEFT JOIN LATERAL (
    SELECT SUM(rp.poids_kg) AS reparti_kg
    FROM public.fiches_tri_repartition rp
    WHERE rp.balle_id = b.id
) r ON true;

CREATE VIEW public.v_fiches_tri
WITH (security_invoker = true) AS
SELECT
    f.*,
    'T-' || lpad(f.numero::text, 4, '0')            AS code,
    t.nom                                            AS trieur_nom,
    -- Fournisseurs des balles de la fiche, sans doublon.
    COALESCE(agg.fournisseur_ids, '{}')              AS fournisseur_ids,
    agg.fournisseurs_noms                            AS fournisseurs_noms,
    COALESCE(agg.poids_initial_kg, 0)                AS poids_initial_kg,
    COALESCE(agg.poids_reparti_kg, 0)                AS poids_reparti_kg,
    COALESCE(agg.ecart_kg, 0)                        AS ecart_kg,
    COALESCE(agg.nb_balles, 0)                       AS nb_balles,
    COALESCE(agg.nb_balles_ecart, 0)                 AS nb_balles_ecart,
    -- Moyenne pondérée par le poids initial : une balle de 20 kg en 1★ ne
    -- pèse pas autant qu'une balle de 80 kg en 3★.
    agg.qualite_moyenne                              AS qualite_moyenne
FROM public.fiches_tri f
JOIN public.trieurs t ON t.id = f.trieur_id
LEFT JOIN LATERAL (
    SELECT
        array_agg(DISTINCT b.fournisseur_id)                      AS fournisseur_ids,
        string_agg(DISTINCT b.fournisseur_nom, ', ')              AS fournisseurs_noms,
        SUM(b.poids_initial_kg)                                   AS poids_initial_kg,
        SUM(b.poids_reparti_kg)                                   AS poids_reparti_kg,
        SUM(b.ecart_kg)                                           AS ecart_kg,
        COUNT(*)                                                  AS nb_balles,
        COUNT(*) FILTER (WHERE abs(b.ecart_kg) >= 0.01)           AS nb_balles_ecart,
        ROUND(SUM(b.poids_initial_kg * b.qualite) / NULLIF(SUM(b.poids_initial_kg), 0), 2) AS qualite_moyenne
    FROM public.v_fiches_tri_balles b
    WHERE b.fiche_id = f.id
) agg ON true;


-- ─── 5. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE public.trieurs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tri_sorties            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiches_tri             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiches_tri_balles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiches_tri_repartition ENABLE ROW LEVEL SECURITY;

-- Référentiels : lecture sur `view`, écriture sur create/update/delete.
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['trieurs', 'tri_sorties'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);

        EXECUTE format($p$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
            USING ((SELECT has_permission('stock.tri.view'::text)) AND (SELECT auth_session_is_aal2()))$p$,
            t || '_select', t);
        EXECUTE format($p$CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
            WITH CHECK ((SELECT has_permission('stock.tri.create'::text)) AND (SELECT auth_session_is_aal2()))$p$,
            t || '_insert', t);
        EXECUTE format($p$CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
            USING ((SELECT has_permission('stock.tri.update'::text)) AND (SELECT auth_session_is_aal2()))
            WITH CHECK ((SELECT has_permission('stock.tri.update'::text)) AND (SELECT auth_session_is_aal2()))$p$,
            t || '_update', t);
        EXECUTE format($p$CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
            USING ((SELECT has_permission('stock.tri.delete'::text)) AND (SELECT auth_session_is_aal2()))$p$,
            t || '_delete', t);
    END LOOP;
END $$;

-- Fiches : lecture et suppression directes ; l'écriture passe par la RPC.
DROP POLICY IF EXISTS fiches_tri_select ON public.fiches_tri;
CREATE POLICY fiches_tri_select ON public.fiches_tri FOR SELECT TO authenticated
    USING ((SELECT has_permission('stock.tri.view'::text)) AND (SELECT auth_session_is_aal2()));

DROP POLICY IF EXISTS fiches_tri_delete ON public.fiches_tri;
CREATE POLICY fiches_tri_delete ON public.fiches_tri FOR DELETE TO authenticated
    USING ((SELECT has_permission('stock.tri.delete'::text)) AND (SELECT auth_session_is_aal2()));

DROP POLICY IF EXISTS fiches_tri_balles_select ON public.fiches_tri_balles;
CREATE POLICY fiches_tri_balles_select ON public.fiches_tri_balles FOR SELECT TO authenticated
    USING ((SELECT has_permission('stock.tri.view'::text)) AND (SELECT auth_session_is_aal2()));

DROP POLICY IF EXISTS fiches_tri_repartition_select ON public.fiches_tri_repartition;
CREATE POLICY fiches_tri_repartition_select ON public.fiches_tri_repartition FOR SELECT TO authenticated
    USING ((SELECT has_permission('stock.tri.view'::text)) AND (SELECT auth_session_is_aal2()));


-- ─── 6. Journal ─────────────────────────────────────────────────────────────

-- Résumé d'une fiche, pour le journal : totaux et une phrase par balle,
-- « 100 kg Pantalons ★★ (Fourn A) → MAG 60 · KS 30 · SO3 6 (écart -4 kg) ».
CREATE OR REPLACE FUNCTION public.fiche_tri_resume(p_fiche_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    WITH balles AS (
        SELECT
            b.ordre,
            b.poids_initial_kg,
            b.poids_reparti_kg,
            trim(trailing '.' from to_char(b.poids_initial_kg, 'FM999990.99')) || ' kg '
                || COALESCE(c.name, '?') || ' ' || repeat('★', b.qualite)
                || ' (' || COALESCE(b.fournisseur_nom, '?') || ')'
                || COALESCE(' → ' || (
                    SELECT string_agg(
                        s.code || ' ' || trim(trailing '.' from to_char(r.poids_kg, 'FM999990.99')),
                        ' · ' ORDER BY s.ordre, s.code)
                    FROM public.fiches_tri_repartition r
                    JOIN public.tri_sorties s ON s.id = r.sortie_id
                    WHERE r.balle_id = b.id
                ), '')
                || CASE WHEN abs(b.ecart_kg) >= 0.01
                        THEN ' (écart ' || trim(trailing '.' from to_char(b.ecart_kg, 'FMS999990.99')) || ' kg)'
                        ELSE '' END
                AS phrase
        FROM public.v_fiches_tri_balles b
        LEFT JOIN public.categories_gestion c ON c.id = b.category_id
        WHERE b.fiche_id = p_fiche_id
    )
    SELECT jsonb_build_object(
        'poids_initial_kg', COALESCE(SUM(poids_initial_kg), 0),
        'poids_reparti_kg', COALESCE(SUM(poids_reparti_kg), 0),
        'nb_balles',        COUNT(*),
        'detail',           COALESCE(string_agg(phrase, ' | ' ORDER BY ordre), '')
    )
    FROM balles
$$;

REVOKE EXECUTE ON FUNCTION public.fiche_tri_resume(uuid) FROM PUBLIC, anon, authenticated;

-- Libellé journal d'une fiche : « T-0142 · Karim ».
CREATE OR REPLACE FUNCTION public.fiche_tri_label(p_numero bigint, p_trieur_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 'T-' || lpad(p_numero::text, 4, '0') || COALESCE(' · ' || (SELECT nom FROM public.trieurs WHERE id = p_trieur_id), '')
$$;

REVOKE EXECUTE ON FUNCTION public.fiche_tri_label(bigint, uuid) FROM PUBLIC, anon, authenticated;

-- Suppression : BEFORE, pour lire les balles avant la cascade.
CREATE OR REPLACE FUNCTION public.log_fiche_tri_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_resume jsonb := public.fiche_tri_resume(OLD.id);
    v_label  text  := public.fiche_tri_label(OLD.numero, OLD.trieur_id);
BEGIN
    INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
    VALUES (auth.uid(), 'fiche_tri', OLD.id::text, v_label, 'delete',
            'Fiche de tri supprimée : ' || v_label,
            jsonb_build_object(
                'date_tri',         OLD.date_tri,
                'poids_initial_kg', v_resume->'poids_initial_kg',
                'balles',           v_resume->>'detail'
            ));
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS fiche_tri_delete_log ON public.fiches_tri;
CREATE TRIGGER fiche_tri_delete_log
    BEFORE DELETE ON public.fiches_tri
    FOR EACH ROW EXECUTE FUNCTION public.log_fiche_tri_delete();

-- Trieurs : trigger classique, comme les autres référentiels du stock.
CREATE OR REPLACE FUNCTION public.log_trieur_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'trieur', NEW.id::text, NEW.nom, 'create',
                'Trieur ajouté : ' || NEW.nom,
                jsonb_build_object('nom', NEW.nom, 'actif', NEW.actif));
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'trieur', NEW.id::text, NEW.nom, 'update',
                'Trieur modifié : ' || NEW.nom,
                public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW)));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'trieur', OLD.id::text, OLD.nom, 'delete',
                'Trieur supprimé : ' || OLD.nom,
                jsonb_build_object('nom', OLD.nom));
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trieur_activity_trigger ON public.trieurs;
CREATE TRIGGER trieur_activity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.trieurs
    FOR EACH ROW EXECUTE FUNCTION public.log_trieur_activity();


-- ─── 7. RPC d'enregistrement ────────────────────────────────────────────────
-- p_fiche  : { id?, date_tri, trieur_id, heure_debut?, heure_fin? }
-- p_balles : [ { fournisseur_id, category_id, poids_initial_kg, qualite, note?,
--                repartition: [ { sortie_id, poids_kg }, … ] }, … ]
-- Création si `id` est absent, sinon remplacement complet des balles.
-- Une part de répartition nulle ou absente est ignorée ; l'écart entre
-- poids initial et réparti est admis (signalé par les vues).
-- Renvoie l'id de la fiche.

CREATE OR REPLACE FUNCTION public.save_fiche_tri(p_fiche jsonb, p_balles jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id         uuid := NULLIF(p_fiche->>'id', '')::uuid;
    v_old        public.fiches_tri;
    v_new        public.fiches_tri;
    v_old_resume jsonb;
    v_new_resume jsonb;
    v_changes    jsonb;
    v_label      text;
    v_balle      record;
    v_balle_id   uuid;
BEGIN
    IF NOT (SELECT auth_session_is_aal2()) THEN
        RAISE EXCEPTION 'double authentification requise' USING ERRCODE = '42501';
    END IF;
    IF v_id IS NULL AND NOT has_permission('stock.tri.create') THEN
        RAISE EXCEPTION 'droit manquant : stock.tri.create' USING ERRCODE = '42501';
    END IF;
    IF v_id IS NOT NULL AND NOT has_permission('stock.tri.update') THEN
        RAISE EXCEPTION 'droit manquant : stock.tri.update' USING ERRCODE = '42501';
    END IF;
    IF jsonb_typeof(p_balles) <> 'array' OR jsonb_array_length(p_balles) = 0 THEN
        RAISE EXCEPTION 'une fiche de tri porte au moins une balle' USING ERRCODE = 'P0001';
    END IF;

    IF v_id IS NULL THEN
        INSERT INTO public.fiches_tri (date_tri, trieur_id, heure_debut, heure_fin)
        VALUES (
            COALESCE((p_fiche->>'date_tri')::date, current_date),
            (p_fiche->>'trieur_id')::uuid,
            NULLIF(p_fiche->>'heure_debut', '')::time,
            NULLIF(p_fiche->>'heure_fin', '')::time
        )
        RETURNING * INTO v_new;
        v_id := v_new.id;
    ELSE
        SELECT * INTO v_old FROM public.fiches_tri WHERE id = v_id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'fiche de tri introuvable' USING ERRCODE = 'P0002';
        END IF;
        v_old_resume := public.fiche_tri_resume(v_id);

        UPDATE public.fiches_tri SET
            date_tri       = COALESCE((p_fiche->>'date_tri')::date, date_tri),
            trieur_id      = (p_fiche->>'trieur_id')::uuid,
            heure_debut    = NULLIF(p_fiche->>'heure_debut', '')::time,
            heure_fin      = NULLIF(p_fiche->>'heure_fin', '')::time,
            updated_at     = now()
        WHERE id = v_id
        RETURNING * INTO v_new;

        -- La cascade emporte la répartition.
        DELETE FROM public.fiches_tri_balles WHERE fiche_id = v_id;
    END IF;

    FOR v_balle IN
        SELECT b.value, b.ord FROM jsonb_array_elements(p_balles) WITH ORDINALITY AS b(value, ord)
    LOOP
        INSERT INTO public.fiches_tri_balles (fiche_id, ordre, fournisseur_id, category_id, poids_initial_kg, qualite, note)
        VALUES (
            v_id,
            (v_balle.ord - 1)::integer,
            (v_balle.value->>'fournisseur_id')::uuid,
            (v_balle.value->>'category_id')::uuid,
            (v_balle.value->>'poids_initial_kg')::numeric,
            (v_balle.value->>'qualite')::smallint,
            NULLIF(btrim(v_balle.value->>'note'), '')
        )
        RETURNING id INTO v_balle_id;

        INSERT INTO public.fiches_tri_repartition (balle_id, sortie_id, poids_kg)
        SELECT v_balle_id, (r.value->>'sortie_id')::uuid, (r.value->>'poids_kg')::numeric
        FROM jsonb_array_elements(COALESCE(v_balle.value->'repartition', '[]'::jsonb)) AS r(value)
        WHERE COALESCE((r.value->>'poids_kg')::numeric, 0) > 0;
    END LOOP;

    v_new_resume := public.fiche_tri_resume(v_id);
    v_label      := public.fiche_tri_label(v_new.numero, v_new.trieur_id);

    IF v_old.id IS NULL THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'fiche_tri', v_id::text, v_label, 'create',
                'Fiche de tri saisie : ' || v_label,
                jsonb_build_object(
                    'date_tri',         v_new.date_tri,
                    'heure_debut',      v_new.heure_debut,
                    'heure_fin',        v_new.heure_fin,
                    'poids_initial_kg', v_new_resume->'poids_initial_kg',
                    'poids_reparti_kg', v_new_resume->'poids_reparti_kg',
                    'balles',           v_new_resume->>'detail'
                ));
    ELSE
        -- `duree_minutes` est dérivée des horaires : leur diff suffit.
        v_changes := public.jsonb_diff(to_jsonb(v_old), to_jsonb(v_new),
                                       ARRAY['id', 'numero', 'created_at', 'updated_at', 'created_by', 'duree_minutes']);
        IF v_old_resume->>'detail' IS DISTINCT FROM v_new_resume->>'detail' THEN
            v_changes := v_changes || jsonb_build_object(
                'balles',           jsonb_build_object('before', v_old_resume->>'detail', 'after', v_new_resume->>'detail'),
                'poids_initial_kg', jsonb_build_object('before', v_old_resume->'poids_initial_kg', 'after', v_new_resume->'poids_initial_kg')
            );
        END IF;
        -- Un enregistrement sans aucune différence n'est pas une action.
        IF v_changes <> '{}'::jsonb THEN
            INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
            VALUES (auth.uid(), 'fiche_tri', v_id::text, v_label, 'update',
                    'Fiche de tri modifiée : ' || v_label, v_changes);
        END IF;
    END IF;

    RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_fiche_tri(jsonb, jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.save_fiche_tri(jsonb, jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.log_fiche_tri_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_trieur_activity()  FROM PUBLIC, anon, authenticated;


-- ─── 8. Realtime ────────────────────────────────────────────────────────────
-- Le responsable saisit pendant qu'un collègue consulte : la liste suit.
-- Balles et répartition ne sont pas publiées : la RPC touche toujours
-- l'en-tête (`updated_at`), dont l'événement suffit à recharger.

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['fiches_tri', 'trieurs', 'tri_sorties'] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;
