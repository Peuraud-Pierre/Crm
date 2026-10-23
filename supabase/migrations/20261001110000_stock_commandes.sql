-- ============================================================
-- Stock — Salle de commande : commandes boutiques, livraisons
-- partielles, palettes, cartons, réception carton par carton
-- Date: 2026-10-01
--
-- Contexte
-- --------
-- Aujourd'hui un humain valide la réception d'une commande en bloc :
-- les erreurs (carton manquant, mauvaise catégorie, poids) passent et se
-- paient en logistique et en finance. Cet outil devient la source de
-- vérité de ce qui part de l'entrepôt et de ce que la boutique reçoit.
--
-- Hiérarchie :
--   commande (ce que la boutique demande : des kg BRUTS par catégorie de
--   vêtements — vêtements seuls, sans cintre ni antivol)
--     └─ livraison(s) PARTIELLES — tout part et tout arrive, mais ni en
--        une fois ni en même temps
--          └─ palette(s)
--               └─ carton(s) — UNE catégorie par carton, en kg
--
-- Pas de catalogue d'articles ni de prix : les catégories sont celles du
-- stock (`categories_gestion`), et le code couleur / le prix au kilo
-- relèvent de la boutique (réécrit le 2026-10-05). Chaque carton porte une
-- étiquette logistique QR (`LIV-0042-C07`) que la boutique scanne à la
-- réception.
--
-- Principes :
--   * Les totaux et l'avancement ne sont JAMAIS stockés : les cartons
--     font foi, les vues dérivent tout.
--   * Les changements de statut passent par des RPC (expédier,
--     réceptionner, clôturer). Un garde-fou en trigger refuse tout
--     changement de statut direct, hors annulation d'une livraison non
--     partie.
--   * Une fois expédiée, le contenu d'une livraison est figé (RLS).
--
-- Deux espaces sur la même page :
--   * entrepôt (`stock.commandes.manage`) : prépare, expédie, gère les
--     boutiques, et peut saisir une commande pour une boutique ;
--   * boutique (`stock.commandes.boutique`) : passe ses commandes tant
--     qu'aucune livraison n'est partie, et réceptionne au scan. Simulée
--     dans nokk_project en V1 ; la console retail prendra le relais en V2
--     (`boutiques.retail_shop_id`, voir docs/commandes-retail.md).
-- La lecture reste sur `stock.commandes.view` : la boutique la détient aussi.
--
-- ⚠️ AUCUN BACKFILL de permissions : s'accorder `stock.commandes.*`
-- depuis /administration après application.
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================


-- ─── 0. Remplacement du premier modèle (articles / pastilles / EAN) ────────
-- La première version de cette migration (même numéro, appliquée en dev
-- seulement) créait un catalogue d'articles. Les `CREATE TABLE IF NOT
-- EXISTS` ci-dessous garderaient ses tables et échoueraient sur
-- `category_id` : si on la détecte, ses objets sont retirés ici (les
-- boutiques sont conservées). Équivalent de seed/dev_reset_commandes.sql.
-- Sur une base neuve ou déjà migrée, ce bloc ne fait rien.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name IN ('cartons', 'commande_lignes') AND column_name = 'article_id'
    ) OR to_regclass('public.articles') IS NOT NULL THEN
        RAISE NOTICE 'Ancien modèle de la salle de commande détecté : commandes, livraisons et cartons de test supprimés.';
        DROP VIEW IF EXISTS public.v_commandes_boutique;
        DROP VIEW IF EXISTS public.v_commande_avancement;
        DROP VIEW IF EXISTS public.v_livraisons_boutique;
        DROP VIEW IF EXISTS public.v_cartons;
        DROP FUNCTION IF EXISTS public.receptionner_carton(uuid, numeric, text, boolean, text);
        DROP TABLE IF EXISTS public.cartons;
        DROP TABLE IF EXISTS public.palettes;
        DROP TABLE IF EXISTS public.livraisons_boutique;
        DROP TABLE IF EXISTS public.commande_lignes;
        DROP TABLE IF EXISTS public.commandes_boutique;
        DROP TABLE IF EXISTS public.articles;
        DROP TABLE IF EXISTS public.pastilles_prix;
        DROP FUNCTION IF EXISTS public.ean13_valide(text);
    END IF;
END $$;

-- L'ancienne permission de réception devient `stock.commandes.boutique`
-- (à réaccorder : pas de backfill). Les attributions suivent la suppression
-- par la clé étrangère quand elle est en cascade ; sinon, elles sont
-- retirées explicitement d'abord.
DO $$
DECLARE
    v_id uuid := (SELECT id FROM public.permissions WHERE code = 'stock.commandes.receive');
    t    text;
BEGIN
    IF v_id IS NULL THEN RETURN; END IF;
    FOREACH t IN ARRAY ARRAY['roles_permissions', 'services_permissions', 'users_permissions'] LOOP
        IF to_regclass('public.' || t) IS NOT NULL THEN
            EXECUTE format('DELETE FROM public.%I WHERE permission_id = $1', t) USING v_id;
        END IF;
    END LOOP;
    DELETE FROM public.permissions WHERE id = v_id;
END $$;


-- ─── 1. Permissions ─────────────────────────────────────────────────────────

INSERT INTO public.permissions (code, label, category)
SELECT v.code, v.label, 'stock'
FROM (VALUES
    ('stock.commandes.view',    'Voir la salle de commande'),
    ('stock.commandes.manage',   'Préparer et expédier les commandes boutiques, gérer les boutiques'),
    ('stock.commandes.boutique', 'Passer les commandes d''une boutique et réceptionner ses cartons')
) AS v(code, label)
WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions p WHERE p.code = v.code
);


-- ─── 2. Outils ──────────────────────────────────────────────────────────────

-- Code lisible d'une livraison et de ses unités. Miroir :
-- src/features/commandes/utils/commandeCode.ts
CREATE OR REPLACE FUNCTION public.code_livraison(p_numero bigint)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT 'LIV-' || lpad(p_numero::text, 4, '0')
$$;

CREATE OR REPLACE FUNCTION public.code_commande(p_numero bigint)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
    SELECT 'CMD-' || lpad(p_numero::text, 4, '0')
$$;


-- ─── 3. Référentiels ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.boutiques (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    nom            text        NOT NULL CHECK (btrim(nom) <> ''),
    code           text        NOT NULL CHECK (code ~ '^[A-Z0-9]{2,4}$'),
    adresse        text,
    actif          boolean     NOT NULL DEFAULT true,
    -- Clé de rapprochement avec `shops.id` de la console retail (V2).
    retail_shop_id uuid        UNIQUE,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS boutiques_code_unique ON public.boutiques (code);


-- ─── 4. Commandes ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.commandes_boutique (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    numero         bigint      GENERATED ALWAYS AS IDENTITY UNIQUE,
    boutique_id    uuid        NOT NULL REFERENCES public.boutiques(id) ON DELETE RESTRICT,
    date_souhaitee date,
    -- `en_cours` et `soldee` sont DÉRIVÉS de l'avancement
    -- (refresh_commande_statut). Seules l'annulation et la clôture d'un
    -- reliquat (`motif_cloture`) sont des décisions humaines.
    statut         text        NOT NULL DEFAULT 'ouverte'
                               CHECK (statut IN ('ouverte', 'en_cours', 'soldee', 'annulee')),
    motif_cloture  text,
    note           text,
    created_by     uuid        DEFAULT auth.uid(),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commandes_boutique_boutique_idx ON public.commandes_boutique (boutique_id);

CREATE TABLE IF NOT EXISTS public.commande_lignes (
    id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    commande_id      uuid          NOT NULL REFERENCES public.commandes_boutique(id) ON DELETE CASCADE,
    category_id      uuid          NOT NULL REFERENCES public.categories_gestion(id) ON DELETE RESTRICT,
    -- Poids BRUT demandé : vêtements seuls, sans cintre ni antivol.
    poids_kg_demande numeric(10,2) NOT NULL CHECK (poids_kg_demande > 0),
    note             text,
    UNIQUE (commande_id, category_id)
);


-- ─── 5. Livraisons, palettes, cartons ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.livraisons_boutique (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    numero                  bigint      GENERATED ALWAYS AS IDENTITY UNIQUE,
    -- NULL : livraison hors commande (réassort spontané).
    commande_id             uuid        REFERENCES public.commandes_boutique(id) ON DELETE RESTRICT,
    boutique_id             uuid        NOT NULL REFERENCES public.boutiques(id) ON DELETE RESTRICT,
    statut                  text        NOT NULL DEFAULT 'planifiee'
                                        CHECK (statut IN ('planifiee', 'preparation', 'expediee',
                                                          'en_reception', 'receptionnee', 'litige', 'annulee')),
    -- Planning (prévu) …
    date_preparation_prevue date,
    date_expedition_prevue  date,
    date_livraison_prevue   date,
    -- … et réel.
    expediee_at             timestamptz,
    expediee_par            uuid,
    receptionnee_at         timestamptz,
    note                    text,
    created_by              uuid        DEFAULT auth.uid(),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS livraisons_boutique_commande_idx ON public.livraisons_boutique (commande_id);
CREATE INDEX IF NOT EXISTS livraisons_boutique_planning_idx ON public.livraisons_boutique (date_expedition_prevue);

CREATE TABLE IF NOT EXISTS public.palettes (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    livraison_id uuid        NOT NULL REFERENCES public.livraisons_boutique(id) ON DELETE CASCADE,
    numero       integer     NOT NULL CHECK (numero > 0),
    note         text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (livraison_id, numero)
);

CREATE TABLE IF NOT EXISTS public.cartons (
    id             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    livraison_id   uuid          NOT NULL REFERENCES public.livraisons_boutique(id) ON DELETE CASCADE,
    -- NULL : carton hors palette. Le code du carton ne contient PAS la
    -- palette : un carton déplacé garderait sinon un code faux.
    palette_id     uuid          REFERENCES public.palettes(id) ON DELETE SET NULL,
    numero         integer       NOT NULL CHECK (numero > 0),
    category_id    uuid          NOT NULL REFERENCES public.categories_gestion(id) ON DELETE RESTRICT,
    poids_kg_prevu numeric(10,2) NOT NULL CHECK (poids_kg_prevu > 0),
    statut         text          NOT NULL DEFAULT 'prepare'
                                 CHECK (statut IN ('prepare', 'expedie', 'recu_conforme', 'recu_ecart', 'manquant')),
    -- Constat de réception.
    etat           text          CHECK (etat IS NULL OR etat IN
                                       ('conforme', 'ecart_poids', 'endommage', 'mauvaise_categorie', 'manquant')),
    poids_kg_recu  numeric(10,2) CHECK (poids_kg_recu IS NULL OR poids_kg_recu >= 0),
    recu_at        timestamptz,
    recu_par       uuid,
    note_reception text,
    created_at     timestamptz   NOT NULL DEFAULT now(),
    UNIQUE (livraison_id, numero)
);

CREATE INDEX IF NOT EXISTS cartons_livraison_idx ON public.cartons (livraison_id);
CREATE INDEX IF NOT EXISTS cartons_category_idx  ON public.cartons (category_id);


-- ─── 6. Cohérence (triggers) ────────────────────────────────────────────────

-- Une livraison rattachée à une commande va à SA boutique.
CREATE OR REPLACE FUNCTION public.livraison_boutique_coherence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_boutique uuid;
BEGIN
    IF NEW.commande_id IS NOT NULL THEN
        SELECT boutique_id INTO v_boutique FROM public.commandes_boutique WHERE id = NEW.commande_id;
        IF v_boutique IS DISTINCT FROM NEW.boutique_id THEN
            RAISE EXCEPTION 'la livraison doit aller à la boutique de sa commande' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Un changement de statut passe par les RPC (expédier,
        -- réceptionner, clôturer), qui lèvent ce verrou pour leur
        -- transaction. Seule l'annulation d'une livraison non partie
        -- reste un geste direct.
        IF NEW.statut IS DISTINCT FROM OLD.statut
           AND COALESCE(current_setting('app.commande_rpc', true), '') <> 'on'
           AND NOT (NEW.statut = 'annulee' AND OLD.statut IN ('planifiee', 'preparation'))
        THEN
            RAISE EXCEPTION 'statut de livraison modifiable uniquement par les actions dédiées' USING ERRCODE = '42501';
        END IF;
        NEW.updated_at := now();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS livraison_boutique_coherence_trigger ON public.livraisons_boutique;
CREATE TRIGGER livraison_boutique_coherence_trigger
    BEFORE INSERT OR UPDATE ON public.livraisons_boutique
    FOR EACH ROW EXECUTE FUNCTION public.livraison_boutique_coherence();

-- Numérotation par livraison, palette de la même livraison, et passage
-- automatique `planifiee` → `preparation` au premier carton.
CREATE OR REPLACE FUNCTION public.palette_numerotation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NEW.numero IS NULL THEN
        SELECT COALESCE(MAX(numero), 0) + 1 INTO NEW.numero
        FROM public.palettes WHERE livraison_id = NEW.livraison_id;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS palette_numerotation_trigger ON public.palettes;
CREATE TRIGGER palette_numerotation_trigger
    BEFORE INSERT ON public.palettes
    FOR EACH ROW EXECUTE FUNCTION public.palette_numerotation();

CREATE OR REPLACE FUNCTION public.carton_coherence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_palette_livraison uuid;
BEGIN
    IF TG_OP = 'INSERT' AND NEW.numero IS NULL THEN
        SELECT COALESCE(MAX(numero), 0) + 1 INTO NEW.numero
        FROM public.cartons WHERE livraison_id = NEW.livraison_id;
    END IF;

    IF NEW.palette_id IS NOT NULL THEN
        SELECT livraison_id INTO v_palette_livraison FROM public.palettes WHERE id = NEW.palette_id;
        IF v_palette_livraison IS DISTINCT FROM NEW.livraison_id THEN
            RAISE EXCEPTION 'la palette appartient à une autre livraison' USING ERRCODE = 'P0001';
        END IF;
    END IF;

    IF TG_OP = 'INSERT' THEN
        PERFORM set_config('app.commande_rpc', 'on', true);
        UPDATE public.livraisons_boutique
        SET statut = 'preparation'
        WHERE id = NEW.livraison_id AND statut = 'planifiee';
        PERFORM set_config('app.commande_rpc', '', true);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS carton_coherence_trigger ON public.cartons;
CREATE TRIGGER carton_coherence_trigger
    BEFORE INSERT OR UPDATE ON public.cartons
    FOR EACH ROW EXECUTE FUNCTION public.carton_coherence();


-- ─── 7. Vues ────────────────────────────────────────────────────────────────
-- Toutes en `security_invoker` : la RLS de l'appelant s'applique.
-- Supprimées d'abord dans l'ordre inverse de leurs dépendances
-- (v_livraisons_boutique lit v_cartons, v_commandes_boutique lit
-- v_commande_avancement) : sinon le second passage de la migration échoue.

DROP VIEW IF EXISTS public.v_commandes_boutique;
DROP VIEW IF EXISTS public.v_commande_avancement;
DROP VIEW IF EXISTS public.v_livraisons_boutique;
DROP VIEW IF EXISTS public.v_cartons;

-- Cartons enrichis : code lisible, catégorie, livraison.
-- Écart d'un carton, en kg (miroir : utils/commandeAvancement.ts) :
--   ecart_poids                               → |prévu − reçu|
--   manquant / mauvaise_categorie / endommagé → tout le prévu
--   conforme ou pas encore reçu               → 0
CREATE VIEW public.v_cartons
WITH (security_invoker = true) AS
SELECT
    c.*,
    public.code_livraison(l.numero) || '-C' || lpad(c.numero::text, 2, '0') AS code,
    CASE WHEN p.id IS NULL THEN NULL
         ELSE public.code_livraison(l.numero) || '-P' || p.numero END        AS palette_code,
    p.numero                                                                 AS palette_numero,
    l.numero                                                                 AS livraison_numero,
    l.statut                                                                 AS livraison_statut,
    l.boutique_id,
    l.commande_id,
    COALESCE(cat.name, '?')                                                  AS category_nom,
    CASE
        WHEN c.etat = 'ecart_poids' THEN abs(c.poids_kg_prevu - COALESCE(c.poids_kg_recu, c.poids_kg_prevu))
        WHEN c.etat IN ('manquant', 'mauvaise_categorie', 'endommage') THEN c.poids_kg_prevu
        ELSE 0
    END                                                                      AS ecart_kg
FROM public.cartons c
JOIN public.livraisons_boutique l  ON l.id = c.livraison_id
JOIN public.categories_gestion cat ON cat.id = c.category_id
LEFT JOIN public.palettes p        ON p.id = c.palette_id;

CREATE VIEW public.v_livraisons_boutique
WITH (security_invoker = true) AS
SELECT
    l.*,
    public.code_livraison(l.numero)  AS code,
    b.nom                            AS boutique_nom,
    b.code                           AS boutique_code,
    CASE WHEN cmd.id IS NULL THEN NULL ELSE public.code_commande(cmd.numero) END AS commande_code,
    COALESCE(pal.nb, 0)              AS nb_palettes,
    COALESCE(agg.nb_cartons, 0)      AS nb_cartons,
    COALESCE(agg.nb_recus, 0)        AS nb_recus,
    COALESCE(agg.nb_ecarts, 0)       AS nb_ecarts,
    COALESCE(agg.kg_prevu, 0)        AS kg_prevu,
    COALESCE(agg.kg_recu, 0)         AS kg_recu,
    COALESCE(agg.kg_ecart, 0)        AS kg_ecart
FROM public.livraisons_boutique l
JOIN public.boutiques b ON b.id = l.boutique_id
LEFT JOIN public.commandes_boutique cmd ON cmd.id = l.commande_id
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS nb FROM public.palettes p WHERE p.livraison_id = l.id
) pal ON true
LEFT JOIN LATERAL (
    SELECT
        COUNT(*)                                                              AS nb_cartons,
        COUNT(*) FILTER (WHERE vc.statut IN ('recu_conforme', 'recu_ecart'))  AS nb_recus,
        COUNT(*) FILTER (WHERE vc.statut IN ('recu_ecart', 'manquant'))       AS nb_ecarts,
        SUM(vc.poids_kg_prevu)                                                AS kg_prevu,
        SUM(COALESCE(vc.poids_kg_recu, vc.poids_kg_prevu))
            FILTER (WHERE vc.statut IN ('recu_conforme', 'recu_ecart')
                      AND vc.etat <> 'mauvaise_categorie')                    AS kg_recu,
        SUM(vc.ecart_kg)                                                      AS kg_ecart
    FROM public.v_cartons vc
    WHERE vc.livraison_id = l.id
) agg ON true;

-- Avancement par ligne de commande : demandé / préparé / expédié (en
-- transit) / reçu / manquant, et le reste à servir. Les livraisons
-- annulées ne comptent pas. Un carton de la mauvaise catégorie ne sert pas
-- la ligne : il compte en manquant.
CREATE VIEW public.v_commande_avancement
WITH (security_invoker = true) AS
SELECT
    cl.id                                AS ligne_id,
    cl.commande_id,
    cl.category_id,
    COALESCE(cat.name, '?')              AS category_nom,
    cl.poids_kg_demande                  AS kg_demande,
    COALESCE(m.kg_prepare, 0)            AS kg_prepare,
    COALESCE(m.kg_expedie, 0)            AS kg_expedie,
    COALESCE(m.kg_recu, 0)               AS kg_recu,
    COALESCE(m.kg_manquant, 0)           AS kg_manquant,
    GREATEST(cl.poids_kg_demande
             - COALESCE(m.kg_prepare, 0) - COALESCE(m.kg_expedie, 0) - COALESCE(m.kg_recu, 0), 0) AS kg_reste
FROM public.commande_lignes cl
JOIN public.categories_gestion cat ON cat.id = cl.category_id
LEFT JOIN LATERAL (
    SELECT
        SUM(c.poids_kg_prevu) FILTER (WHERE c.statut = 'prepare')                         AS kg_prepare,
        SUM(c.poids_kg_prevu) FILTER (WHERE c.statut = 'expedie')                         AS kg_expedie,
        SUM(COALESCE(c.poids_kg_recu, c.poids_kg_prevu))
            FILTER (WHERE c.statut IN ('recu_conforme', 'recu_ecart')
                      AND c.etat IS DISTINCT FROM 'mauvaise_categorie')                   AS kg_recu,
        SUM(c.poids_kg_prevu)
            FILTER (WHERE c.statut = 'manquant' OR c.etat = 'mauvaise_categorie')         AS kg_manquant
    FROM public.cartons c
    JOIN public.livraisons_boutique l ON l.id = c.livraison_id
    WHERE l.commande_id = cl.commande_id
      AND l.statut <> 'annulee'
      AND c.category_id = cl.category_id
) m ON true;

CREATE VIEW public.v_commandes_boutique
WITH (security_invoker = true) AS
SELECT
    cmd.*,
    public.code_commande(cmd.numero)   AS code,
    b.nom                              AS boutique_nom,
    b.code                             AS boutique_code,
    COALESCE(av.kg_demande, 0)         AS kg_demande,
    COALESCE(av.kg_prepare, 0)         AS kg_prepare,
    COALESCE(av.kg_expedie, 0)         AS kg_expedie,
    COALESCE(av.kg_recu, 0)            AS kg_recu,
    COALESCE(av.kg_reste, 0)           AS kg_reste,
    COALESCE(av.nb_lignes, 0)          AS nb_lignes,
    COALESCE(lv.nb_livraisons, 0)      AS nb_livraisons,
    lv.derniere_livraison_at
FROM public.commandes_boutique cmd
JOIN public.boutiques b ON b.id = cmd.boutique_id
LEFT JOIN LATERAL (
    SELECT
        SUM(v.kg_demande) AS kg_demande, SUM(v.kg_prepare) AS kg_prepare,
        SUM(v.kg_expedie) AS kg_expedie, SUM(v.kg_recu)    AS kg_recu,
        SUM(v.kg_reste)   AS kg_reste,   COUNT(*)          AS nb_lignes
    FROM public.v_commande_avancement v
    WHERE v.commande_id = cmd.id
) av ON true
LEFT JOIN LATERAL (
    SELECT COUNT(*) AS nb_livraisons, MAX(COALESCE(l.expediee_at, l.created_at)) AS derniere_livraison_at
    FROM public.livraisons_boutique l
    WHERE l.commande_id = cmd.id AND l.statut <> 'annulee'
) lv ON true;


-- ─── 8. Statut dérivé d'une commande ────────────────────────────────────────
-- Soldée quand chaque ligne a reçu au moins 98 % du demandé (tolérance
-- de pesée, la même que PACKING_GAP_TOLERANCE — à valider avec le
-- service commande) ; en cours dès qu'un carton existe ; ouverte sinon.
-- Une commande annulée ou clôturée à la main n'est plus recalculée.

CREATE OR REPLACE FUNCTION public.refresh_commande_statut(p_commande_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_statut  text;
    v_motif   text;
    v_new     text;
    v_soldee  boolean;
    v_cartons boolean;
BEGIN
    IF p_commande_id IS NULL THEN RETURN; END IF;
    SELECT statut, motif_cloture INTO v_statut, v_motif
    FROM public.commandes_boutique WHERE id = p_commande_id;
    IF NOT FOUND OR v_statut = 'annulee' OR v_motif IS NOT NULL THEN RETURN; END IF;

    -- Aucune ligne : bool_and rend NULL, la commande n'est pas soldée.
    SELECT bool_and(kg_recu >= kg_demande * 0.98)
    INTO v_soldee
    FROM public.v_commande_avancement WHERE commande_id = p_commande_id;

    SELECT EXISTS (
        SELECT 1 FROM public.cartons c
        JOIN public.livraisons_boutique l ON l.id = c.livraison_id
        WHERE l.commande_id = p_commande_id AND l.statut <> 'annulee'
    ) INTO v_cartons;

    v_new := CASE WHEN COALESCE(v_soldee, false) THEN 'soldee'
                  WHEN v_cartons THEN 'en_cours'
                  ELSE 'ouverte' END;

    IF v_new IS DISTINCT FROM v_statut THEN
        UPDATE public.commandes_boutique SET statut = v_new, updated_at = now() WHERE id = p_commande_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.carton_refresh_commande()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.refresh_commande_statut(
        (SELECT commande_id FROM public.livraisons_boutique WHERE id = COALESCE(NEW.livraison_id, OLD.livraison_id))
    );
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS carton_refresh_commande_trigger ON public.cartons;
CREATE TRIGGER carton_refresh_commande_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.cartons
    FOR EACH ROW EXECUTE FUNCTION public.carton_refresh_commande();

CREATE OR REPLACE FUNCTION public.livraison_refresh_commande()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.refresh_commande_statut(OLD.commande_id);
    -- Livraison rattachée à une autre commande : les deux bougent.
    IF TG_OP = 'UPDATE' THEN
        IF NEW.commande_id IS DISTINCT FROM OLD.commande_id THEN
            PERFORM public.refresh_commande_statut(NEW.commande_id);
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS livraison_refresh_commande_trigger ON public.livraisons_boutique;
CREATE TRIGGER livraison_refresh_commande_trigger
    AFTER UPDATE OF statut, commande_id OR DELETE ON public.livraisons_boutique
    FOR EACH ROW EXECUTE FUNCTION public.livraison_refresh_commande();

-- Une ligne de commande ajoutée ou modifiée peut solder ou rouvrir.
CREATE OR REPLACE FUNCTION public.commande_ligne_refresh()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.refresh_commande_statut(COALESCE(NEW.commande_id, OLD.commande_id));
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS commande_ligne_refresh_trigger ON public.commande_lignes;
CREATE TRIGGER commande_ligne_refresh_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.commande_lignes
    FOR EACH ROW EXECUTE FUNCTION public.commande_ligne_refresh();


-- ─── 9. Notifications ───────────────────────────────────────────────────────
-- Les notifications sont adressées aux SERVICES (`notification.user_id`
-- = service_id), comme celles des arrivages : chaque service dont un
-- membre détient la permission est prévenu. Dédoublonnage sur 1 h.

CREATE OR REPLACE FUNCTION public.notify_commandes(p_permission text, p_title text, p_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_service RECORD;
BEGIN
    FOR v_service IN
        SELECT DISTINCT pr.service_id
        FROM public.profiles pr
        WHERE pr.service_id IS NOT NULL
          AND public.user_has_permission(pr.user_id, p_permission)
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.notification
            WHERE user_id = v_service.service_id
              AND title = p_title
              AND created_at > now() - interval '1 hour'
        ) THEN
            INSERT INTO public.notification(user_id, type, title, url)
            VALUES (v_service.service_id, 'system', p_title, p_url);
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.livraison_boutique_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_label text;
    v_url   text := '/commandes/' || NEW.id || '?vue=livraisons';
BEGIN
    IF NEW.statut IS NOT DISTINCT FROM OLD.statut THEN RETURN NULL; END IF;
    v_label := public.code_livraison(NEW.numero) || ' → '
               || COALESCE((SELECT nom FROM public.boutiques WHERE id = NEW.boutique_id), '?');

    IF NEW.statut = 'expediee' THEN
        PERFORM public.notify_commandes('stock.commandes.boutique', 'Livraison expédiée : ' || v_label,
                                        '/commandes/' || NEW.id || '?vue=reception');
    ELSIF NEW.statut = 'litige' THEN
        PERFORM public.notify_commandes('stock.commandes.manage', 'Livraison en litige : ' || v_label, v_url);
    ELSIF NEW.statut = 'receptionnee' THEN
        PERFORM public.notify_commandes('stock.commandes.manage', 'Livraison réceptionnée : ' || v_label, v_url);
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS livraison_boutique_notify_trigger ON public.livraisons_boutique;
CREATE TRIGGER livraison_boutique_notify_trigger
    AFTER UPDATE OF statut ON public.livraisons_boutique
    FOR EACH ROW EXECUTE FUNCTION public.livraison_boutique_notify();

CREATE OR REPLACE FUNCTION public.commande_boutique_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_label text := public.code_commande(NEW.numero) || ' · '
                    || COALESCE((SELECT nom FROM public.boutiques WHERE id = NEW.boutique_id), '?');
    v_url   text := '/commandes/' || NEW.id || '?vue=commandes';
BEGIN
    -- Une commande passée (le plus souvent par la boutique) arrive à
    -- l'entrepôt, qui la préparera.
    IF TG_OP = 'INSERT' THEN
        PERFORM public.notify_commandes('stock.commandes.manage', 'Nouvelle commande : ' || v_label, v_url);
    ELSIF NEW.statut = 'soldee' AND OLD.statut IS DISTINCT FROM 'soldee' THEN
        PERFORM public.notify_commandes('stock.commandes.manage', 'Commande soldée : ' || v_label, v_url);
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS commande_boutique_notify_trigger ON public.commandes_boutique;
CREATE TRIGGER commande_boutique_notify_trigger
    AFTER INSERT OR UPDATE OF statut ON public.commandes_boutique
    FOR EACH ROW EXECUTE FUNCTION public.commande_boutique_notify();


-- ─── 10. Journal ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_commande_boutique_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r       public.commandes_boutique := COALESCE(NEW, OLD);
    v_label text := public.code_commande(r.numero) || ' · '
                    || COALESCE((SELECT nom FROM public.boutiques WHERE id = r.boutique_id), '?');
    v_diff  jsonb;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'commande', NEW.id::text, v_label, 'create', 'Commande créée : ' || v_label,
                jsonb_build_object('date_souhaitee', NEW.date_souhaitee, 'note', NEW.note));
    ELSIF TG_OP = 'UPDATE' THEN
        v_diff := public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW), ARRAY['id', 'created_at', 'updated_at']);
        IF v_diff <> '{}'::jsonb THEN
            INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
            VALUES (auth.uid(), 'commande', NEW.id::text, v_label, 'update', 'Commande modifiée : ' || v_label, v_diff);
        END IF;
    ELSE
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'commande', OLD.id::text, v_label, 'delete', 'Commande supprimée : ' || v_label,
                jsonb_build_object('statut', OLD.statut));
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS commande_boutique_activity_trigger ON public.commandes_boutique;
CREATE TRIGGER commande_boutique_activity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.commandes_boutique
    FOR EACH ROW EXECUTE FUNCTION public.log_commande_boutique_activity();

CREATE OR REPLACE FUNCTION public.log_livraison_boutique_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r       public.livraisons_boutique := COALESCE(NEW, OLD);
    v_label text := public.code_livraison(r.numero) || ' · '
                    || COALESCE((SELECT nom FROM public.boutiques WHERE id = r.boutique_id), '?');
    v_diff  jsonb;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'livraison_boutique', NEW.id::text, v_label, 'create', 'Livraison créée : ' || v_label,
                jsonb_build_object('date_expedition_prevue', NEW.date_expedition_prevue,
                                   'date_livraison_prevue',  NEW.date_livraison_prevue));
    ELSIF TG_OP = 'UPDATE' THEN
        v_diff := public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW), ARRAY['id', 'created_at', 'updated_at']);
        IF v_diff <> '{}'::jsonb THEN
            INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
            VALUES (auth.uid(), 'livraison_boutique', NEW.id::text, v_label, 'update',
                    CASE WHEN NEW.statut IS DISTINCT FROM OLD.statut
                         THEN 'Livraison ' || replace(NEW.statut, '_', ' ') || ' : ' || v_label
                         ELSE 'Livraison modifiée : ' || v_label END,
                    v_diff);
        END IF;
    ELSE
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'livraison_boutique', OLD.id::text, v_label, 'delete', 'Livraison supprimée : ' || v_label,
                jsonb_build_object('statut', OLD.statut));
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS livraison_boutique_activity_trigger ON public.livraisons_boutique;
CREATE TRIGGER livraison_boutique_activity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.livraisons_boutique
    FOR EACH ROW EXECUTE FUNCTION public.log_livraison_boutique_activity();

-- Cartons : création, suppression et RÉCEPTION. Les passages en masse
-- `prepare` → `expedie` à l'expédition ne sont pas journalisés carton par
-- carton : l'entrée de la livraison les couvre.
CREATE OR REPLACE FUNCTION public.log_carton_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r       public.cartons := COALESCE(NEW, OLD);
    v_label text;
BEGIN
    -- Suppression en cascade d'une livraison : sa ligne de journal suffit.
    IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.livraisons_boutique WHERE id = OLD.livraison_id) THEN
        RETURN NULL;
    END IF;
    v_label := COALESCE((SELECT public.code_livraison(numero) FROM public.livraisons_boutique WHERE id = r.livraison_id), 'LIV-?')
               || '-C' || lpad(r.numero::text, 2, '0');

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'carton', NEW.id::text, v_label, 'create', 'Carton préparé : ' || v_label,
                jsonb_build_object(
                    'categorie',      (SELECT name FROM public.categories_gestion WHERE id = NEW.category_id),
                    'poids_kg_prevu', NEW.poids_kg_prevu));
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.recu_at IS NOT NULL AND OLD.recu_at IS NULL OR (NEW.statut = 'manquant' AND OLD.statut <> 'manquant') THEN
            INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
            VALUES (auth.uid(), 'carton', NEW.id::text, v_label, 'update',
                    CASE NEW.etat
                        WHEN 'conforme'           THEN 'Carton reçu conforme : '
                        WHEN 'ecart_poids'        THEN 'Carton reçu avec écart de poids : '
                        WHEN 'endommage'          THEN 'Carton reçu endommagé : '
                        WHEN 'mauvaise_categorie' THEN 'Carton reçu — mauvaise catégorie : '
                        ELSE                           'Carton manquant : '
                    END || v_label,
                    jsonb_build_object(
                        'etat',           NEW.etat,
                        'poids_kg_prevu', NEW.poids_kg_prevu,
                        'poids_kg_recu',  NEW.poids_kg_recu,
                        'note_reception', NEW.note_reception));
        ELSIF NEW.statut = OLD.statut THEN
            -- Modification pendant la préparation (palette, poids, catégorie).
            INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
            SELECT auth.uid(), 'carton', NEW.id::text, v_label, 'update', 'Carton modifié : ' || v_label, d
            FROM (SELECT public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW), ARRAY['id', 'created_at']) AS d) x
            WHERE d <> '{}'::jsonb;
        END IF;
    ELSE
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'carton', OLD.id::text, v_label, 'delete', 'Carton retiré : ' || v_label,
                jsonb_build_object('poids_kg_prevu', OLD.poids_kg_prevu));
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS carton_activity_trigger ON public.cartons;
CREATE TRIGGER carton_activity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.cartons
    FOR EACH ROW EXECUTE FUNCTION public.log_carton_activity();


-- ─── 11. RPC de transition ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.commandes_exiger(p_permission text)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
    IF NOT (SELECT auth_session_is_aal2()) THEN
        RAISE EXCEPTION 'double authentification requise' USING ERRCODE = '42501';
    END IF;
    IF NOT has_permission(p_permission) THEN
        RAISE EXCEPTION 'droit manquant : %', p_permission USING ERRCODE = '42501';
    END IF;
END;
$$;

-- Clôture d'une livraison dont plus aucun carton n'est en transit :
-- réceptionnée si tout est conforme, en litige sinon.
CREATE OR REPLACE FUNCTION public.finaliser_livraison(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_restants int;
    v_ecarts   int;
BEGIN
    SELECT COUNT(*) FILTER (WHERE statut = 'expedie'),
           COUNT(*) FILTER (WHERE statut IN ('recu_ecart', 'manquant'))
    INTO v_restants, v_ecarts
    FROM public.cartons WHERE livraison_id = p_id;

    PERFORM set_config('app.commande_rpc', 'on', true);
    IF v_restants = 0 THEN
        UPDATE public.livraisons_boutique
        SET statut = CASE WHEN v_ecarts > 0 THEN 'litige' ELSE 'receptionnee' END,
            receptionnee_at = now()
        WHERE id = p_id AND statut IN ('expediee', 'en_reception');
    ELSE
        UPDATE public.livraisons_boutique SET statut = 'en_reception'
        WHERE id = p_id AND statut = 'expediee';
    END IF;
    PERFORM set_config('app.commande_rpc', '', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finaliser_livraison(uuid) FROM PUBLIC, anon, authenticated;

-- Expédier : refuse une livraison vide ; le contenu est figé ensuite (RLS).
CREATE OR REPLACE FUNCTION public.expedier_livraison(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_statut text;
BEGIN
    PERFORM public.commandes_exiger('stock.commandes.manage');

    SELECT statut INTO v_statut FROM public.livraisons_boutique WHERE id = p_id FOR UPDATE;
    IF v_statut IS NULL THEN
        RAISE EXCEPTION 'livraison introuvable' USING ERRCODE = 'P0002';
    END IF;
    IF v_statut NOT IN ('planifiee', 'preparation') THEN
        RAISE EXCEPTION 'livraison déjà expédiée (statut : %)', v_statut USING ERRCODE = 'P0001';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.cartons WHERE livraison_id = p_id) THEN
        RAISE EXCEPTION 'une livraison sans carton ne peut pas partir' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.cartons SET statut = 'expedie' WHERE livraison_id = p_id;

    PERFORM set_config('app.commande_rpc', 'on', true);
    UPDATE public.livraisons_boutique
    SET statut = 'expediee', expediee_at = now(), expediee_par = auth.uid()
    WHERE id = p_id;
    PERFORM set_config('app.commande_rpc', '', true);
END;
$$;

-- Réceptionner un carton. Le verdict est calculé ICI, pas par l'écran :
--   endommagé déclaré                        → endommage
--   catégorie déclarée fausse (à l'œil)      → mauvaise_categorie
--   poids pesé hors tolérance de 2 %         → ecart_poids
--   sinon (pas de pesée : le prévu fait foi) → conforme
-- Renvoie l'état retenu.
DROP FUNCTION IF EXISTS public.receptionner_carton(uuid, numeric, text, boolean, text);
CREATE OR REPLACE FUNCTION public.receptionner_carton(
    p_carton_id          uuid,
    p_poids_recu         numeric DEFAULT NULL,
    p_endommage          boolean DEFAULT false,
    p_mauvaise_categorie boolean DEFAULT false,
    p_note               text    DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_carton public.cartons;
    v_etat   text;
BEGIN
    PERFORM public.commandes_exiger('stock.commandes.boutique');

    SELECT * INTO v_carton FROM public.cartons WHERE id = p_carton_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'carton introuvable' USING ERRCODE = 'P0002';
    END IF;
    IF v_carton.statut <> 'expedie' THEN
        RAISE EXCEPTION 'carton déjà traité (statut : %)', v_carton.statut USING ERRCODE = 'P0001';
    END IF;
    IF p_poids_recu IS NOT NULL AND p_poids_recu < 0 THEN
        RAISE EXCEPTION 'poids reçu négatif' USING ERRCODE = 'P0001';
    END IF;

    v_etat := CASE
        WHEN p_endommage THEN 'endommage'
        WHEN p_mauvaise_categorie THEN 'mauvaise_categorie'
        WHEN p_poids_recu IS NOT NULL
             AND abs(p_poids_recu - v_carton.poids_kg_prevu) > v_carton.poids_kg_prevu * 0.02 THEN 'ecart_poids'
        ELSE 'conforme'
    END;

    UPDATE public.cartons SET
        etat           = v_etat,
        statut         = CASE WHEN v_etat = 'conforme' THEN 'recu_conforme' ELSE 'recu_ecart' END,
        poids_kg_recu  = p_poids_recu,
        recu_at        = now(),
        recu_par       = auth.uid(),
        note_reception = NULLIF(btrim(p_note), '')
    WHERE id = p_carton_id;

    PERFORM public.finaliser_livraison(v_carton.livraison_id);
    RETURN v_etat;
END;
$$;

-- Clôturer la réception : les cartons jamais scannés sont déclarés
-- manquants. Ouvert à la boutique comme à l'entrepôt.
CREATE OR REPLACE FUNCTION public.cloturer_livraison(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_statut text;
BEGIN
    IF NOT (has_permission('stock.commandes.boutique') OR has_permission('stock.commandes.manage')) THEN
        RAISE EXCEPTION 'droit manquant : stock.commandes.boutique' USING ERRCODE = '42501';
    END IF;
    IF NOT (SELECT auth_session_is_aal2()) THEN
        RAISE EXCEPTION 'double authentification requise' USING ERRCODE = '42501';
    END IF;

    SELECT statut INTO v_statut FROM public.livraisons_boutique WHERE id = p_id FOR UPDATE;
    IF v_statut IS NULL THEN
        RAISE EXCEPTION 'livraison introuvable' USING ERRCODE = 'P0002';
    END IF;
    IF v_statut NOT IN ('expediee', 'en_reception') THEN
        RAISE EXCEPTION 'seule une livraison en cours de réception se clôture (statut : %)', v_statut
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.cartons
    SET statut = 'manquant', etat = 'manquant'
    WHERE livraison_id = p_id AND statut = 'expedie';

    PERFORM public.finaliser_livraison(p_id);
END;
$$;

-- Clôturer le reliquat d'une commande : la soldée sans tout livrer.
CREATE OR REPLACE FUNCTION public.cloturer_commande(p_id uuid, p_motif text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.commandes_exiger('stock.commandes.manage');
    IF NULLIF(btrim(p_motif), '') IS NULL THEN
        RAISE EXCEPTION 'le motif de clôture est obligatoire' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.commandes_boutique
    SET statut = 'soldee', motif_cloture = btrim(p_motif), updated_at = now()
    WHERE id = p_id AND statut IN ('ouverte', 'en_cours');
    IF NOT FOUND THEN
        RAISE EXCEPTION 'commande introuvable ou déjà close' USING ERRCODE = 'P0001';
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expedier_livraison(uuid)                                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.receptionner_carton(uuid, numeric, boolean, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cloturer_livraison(uuid)                                 FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cloturer_commande(uuid, text)                            FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.expedier_livraison(uuid)                                 TO authenticated;
GRANT  EXECUTE ON FUNCTION public.receptionner_carton(uuid, numeric, boolean, boolean, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.cloturer_livraison(uuid)                                 TO authenticated;
GRANT  EXECUTE ON FUNCTION public.cloturer_commande(uuid, text)                            TO authenticated;

-- Fonctions internes : appelées par triggers ou par les RPC, jamais
-- directement depuis le client.
REVOKE EXECUTE ON FUNCTION public.refresh_commande_statut(uuid)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_commandes(text, text, text)       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.carton_coherence()                       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.livraison_boutique_coherence()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.carton_refresh_commande()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.livraison_refresh_commande()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.commande_ligne_refresh()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.livraison_boutique_notify()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.commande_boutique_notify()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_commande_boutique_activity()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_livraison_boutique_activity()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_carton_activity()                    FROM PUBLIC, anon, authenticated;


-- ─── 12. RLS ────────────────────────────────────────────────────────────────

ALTER TABLE public.boutiques           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commandes_boutique  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commande_lignes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livraisons_boutique ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.palettes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartons             ENABLE ROW LEVEL SECURITY;

-- Lecture sur `view` partout ; écriture sur `manage` pour les boutiques
-- et les commandes (la boutique a ses propres politiques, plus bas).
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['boutiques', 'commandes_boutique', 'commande_lignes',
                             'livraisons_boutique', 'palettes', 'cartons'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
        EXECUTE format($p$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
            USING ((SELECT has_permission('stock.commandes.view'::text)) AND (SELECT auth_session_is_aal2()))$p$,
            t || '_select', t);
    END LOOP;

    FOREACH t IN ARRAY ARRAY['boutiques', 'commandes_boutique', 'commande_lignes'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write', t);
        EXECUTE format($p$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
            USING ((SELECT has_permission('stock.commandes.manage'::text)) AND (SELECT auth_session_is_aal2()))
            WITH CHECK ((SELECT has_permission('stock.commandes.manage'::text)) AND (SELECT auth_session_is_aal2()))$p$,
            t || '_write', t);
    END LOOP;
END $$;

-- La boutique passe et ajuste SES commandes tant que rien n'est parti :
-- commande `ouverte` et sans livraison (non annulée). Elle peut l'annuler
-- dans ce même état ; ensuite, seul l'entrepôt la touche. Pas de
-- suppression : une commande annulée reste au journal.
CREATE OR REPLACE FUNCTION public.commande_modifiable_boutique(p_commande_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.commandes_boutique cmd
        WHERE cmd.id = p_commande_id
          AND cmd.statut = 'ouverte'
          AND NOT EXISTS (
              SELECT 1 FROM public.livraisons_boutique l
              WHERE l.commande_id = cmd.id AND l.statut <> 'annulee'
          )
    )
$$;

REVOKE EXECUTE ON FUNCTION public.commande_modifiable_boutique(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.commande_modifiable_boutique(uuid) TO authenticated;

DROP POLICY IF EXISTS commandes_boutique_boutique_insert ON public.commandes_boutique;
CREATE POLICY commandes_boutique_boutique_insert ON public.commandes_boutique FOR INSERT TO authenticated
    WITH CHECK ((SELECT has_permission('stock.commandes.boutique'::text)) AND (SELECT auth_session_is_aal2())
                AND statut = 'ouverte');

DROP POLICY IF EXISTS commandes_boutique_boutique_update ON public.commandes_boutique;
CREATE POLICY commandes_boutique_boutique_update ON public.commandes_boutique FOR UPDATE TO authenticated
    USING ((SELECT has_permission('stock.commandes.boutique'::text)) AND (SELECT auth_session_is_aal2())
           AND public.commande_modifiable_boutique(id))
    WITH CHECK ((SELECT has_permission('stock.commandes.boutique'::text)) AND (SELECT auth_session_is_aal2())
                AND statut IN ('ouverte', 'annulee') AND motif_cloture IS NULL);

DROP POLICY IF EXISTS commande_lignes_boutique ON public.commande_lignes;
CREATE POLICY commande_lignes_boutique ON public.commande_lignes FOR ALL TO authenticated
    USING ((SELECT has_permission('stock.commandes.boutique'::text)) AND (SELECT auth_session_is_aal2())
           AND public.commande_modifiable_boutique(commande_id))
    WITH CHECK ((SELECT has_permission('stock.commandes.boutique'::text)) AND (SELECT auth_session_is_aal2())
                AND public.commande_modifiable_boutique(commande_id));

-- Livraisons : créées et modifiées (dates, note) par `manage` tant
-- qu'elles ne sont pas closes ; supprimées seulement avant le départ.
DROP POLICY IF EXISTS livraisons_boutique_insert ON public.livraisons_boutique;
CREATE POLICY livraisons_boutique_insert ON public.livraisons_boutique FOR INSERT TO authenticated
    WITH CHECK ((SELECT has_permission('stock.commandes.manage'::text)) AND (SELECT auth_session_is_aal2())
                AND statut = 'planifiee');

DROP POLICY IF EXISTS livraisons_boutique_update ON public.livraisons_boutique;
CREATE POLICY livraisons_boutique_update ON public.livraisons_boutique FOR UPDATE TO authenticated
    USING ((SELECT has_permission('stock.commandes.manage'::text)) AND (SELECT auth_session_is_aal2())
           AND statut NOT IN ('receptionnee', 'litige', 'annulee'))
    WITH CHECK ((SELECT has_permission('stock.commandes.manage'::text)) AND (SELECT auth_session_is_aal2()));

DROP POLICY IF EXISTS livraisons_boutique_delete ON public.livraisons_boutique;
CREATE POLICY livraisons_boutique_delete ON public.livraisons_boutique FOR DELETE TO authenticated
    USING ((SELECT has_permission('stock.commandes.manage'::text)) AND (SELECT auth_session_is_aal2())
           AND statut IN ('planifiee', 'preparation', 'annulee'));

-- Palettes et cartons : le contenu n'est modifiable qu'avant le départ.
-- La réception passe par `receptionner_carton` (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.livraison_modifiable(p_livraison_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.livraisons_boutique
        WHERE id = p_livraison_id AND statut IN ('planifiee', 'preparation')
    )
$$;

REVOKE EXECUTE ON FUNCTION public.livraison_modifiable(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.livraison_modifiable(uuid) TO authenticated;

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['palettes', 'cartons'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_write', t);
        EXECUTE format($p$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
            USING ((SELECT has_permission('stock.commandes.manage'::text)) AND (SELECT auth_session_is_aal2())
                   AND public.livraison_modifiable(livraison_id))
            WITH CHECK ((SELECT has_permission('stock.commandes.manage'::text)) AND (SELECT auth_session_is_aal2())
                   AND public.livraison_modifiable(livraison_id))$p$,
            t || '_write', t);
    END LOOP;
END $$;


-- ─── 13. Realtime ───────────────────────────────────────────────────────────
-- La boutique scanne pendant que l'entrepôt supervise : le planning et
-- l'avancement suivent sans rechargement.

DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['commandes_boutique', 'commande_lignes', 'livraisons_boutique', 'palettes', 'cartons',
                             'boutiques'] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;
