-- ============================================================
-- Stock Handpick — en-têtes de flux (arrivages / départs)
-- Date: 2026-09-08
-- Dépend de : 20260914141000 (référentiel), 20260914143000 (balles),
--             20260914144000 (mouvements), 20260914145000 (journal)
--
-- Contexte
-- --------
-- `mouvements_handpick` est une table de LIGNES : une ligne = une balle,
-- ou une quantité en vrac. L'onglet Flux affichait ces lignes telles
-- quelles sous le titre « Arrivages » — ce que l'utilisateur voyait
-- n'était donc pas un arrivage, mais déjà le contenu de sa liste de
-- colisage. Un conteneur de 40 balles apparaissait comme 40 arrivages.
--
-- La migration 20260914144000 avait annoncé cette étape mot pour mot :
-- « le jour où un arrivage gagne des attributs (n° conteneur,
-- transporteur, statut de déchargement), on crée la table d'en-tête et
-- batch_id devient sa FK ». C'est ce que fait ce fichier.
--
-- Modèle cible, aligné sur `arrivage_manuel` du stock principal :
--
--   flux_handpick      1 ─── n  mouvements_handpick
--   (l'arrivage,                (la liste de colisage :
--    le départ)                  balles et vrac reçus)
--
-- Une seule table pour les deux sens plutôt que `arrivages_handpick` +
-- `departs_handpick` : les deux portent exactement les mêmes attributs,
-- et `mouvements_handpick` a déjà fait ce choix (« deux lectures de la
-- MÊME table, filtrées sur direction »). Le nom retenu est celui du
-- vocabulaire du module — l'onglet, les permissions et le contexte
-- s'appellent déjà « flux » ; `arrivages_handpick` aurait menti sur la
-- moitié de ses lignes.
--
-- Ce qui MONTE de la ligne vers l'en-tête : direction, motif,
-- fournisseur, date métier, référence externe. Ces colonnes décrivaient
-- l'expédition entière et étaient recopiées à l'identique sur chacune de
-- ses lignes — une invitation à la dérive. Elles sont retirées de
-- `mouvements_handpick` en fin de fichier.
--
-- Ce qui n'est PAS stocké sur l'en-tête : le poids et la quantité
-- totale. Le stock principal les saisit à la main faute de détail ; ici
-- la liste de colisage existe, c'est elle qui fait foi. Les totaux sont
-- exposés par la vue `v_flux_handpick`, sans dérive possible.
--
-- ⚠ Migration DESTRUCTIVE sur `mouvements_handpick` (5 colonnes
-- retirées) et appliquée sur un schéma déjà déployé en préproduction.
-- Le backfill (§4) doit être exécuté AVANT les suppressions (§6) — il
-- lit précisément les colonnes retirées. Ne pas réordonner les sections.
--
-- Mapping permKey → policy (identique aux mouvements) :
--   SELECT → stock_handpick.flux.view
--   INSERT → stock_handpick.flux.create
--   UPDATE → stock_handpick.flux.update
--   DELETE → stock_handpick.flux.delete
--
-- Idempotent : ré-exécutable sans doublon.
-- ============================================================

-- ─── 1. Journal : nouveau type d'entité ─────────────────────────────────

ALTER TABLE public.activity_log_handpick
    DROP CONSTRAINT IF EXISTS activity_log_handpick_entity_type_valid;

ALTER TABLE public.activity_log_handpick
    ADD CONSTRAINT activity_log_handpick_entity_type_valid CHECK (entity_type IN (
        'balle', 'category', 'fournisseur', 'fournisseur_category',
        'mouvement', 'zone', 'emplacement', 'flux'
    ));

-- ─── 2. Table d'en-tête ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.flux_handpick (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    direction           TEXT        NOT NULL,
    motif               TEXT        NOT NULL,

    -- Cycle de vie repris tel quel du stock principal, pour que les deux
    -- tableaux se lisent pareil. Pour un DÉPART, les libellés se lisent :
    -- planifié → en_transit (expédié) → reçu (livré). `déchargé` ne
    -- concerne que les arrivages ; le laisser dans le jeu commun évite un
    -- second CHECK pour une valeur qu'un départ n'atteindra jamais.
    status              TEXT        NOT NULL DEFAULT 'planifié',
    -- Statut posé par les transitions temporelles (§8) et non par un
    -- utilisateur : l'UI le signale par une pastille « à confirmer ».
    status_auto         BOOLEAN     NOT NULL DEFAULT FALSE,

    fournisseur_id      UUID        REFERENCES public.fournisseurs_handpick(id) ON DELETE SET NULL,

    -- ── Logistique conteneur ─────────────────────────────────────────
    -- Nullable, contrairement au stock principal où le n° BIC est NOT
    -- NULL : un départ n'a pas toujours de conteneur. L'obligation pour
    -- un arrivage est portée par la saisie, pas par le schéma — une
    -- contrainte conditionnelle bloquerait la création d'un brouillon.
    container_no        TEXT,
    -- N° interne, tel que noté par l'équipe.
    conteneur_no_raw    TEXT,
    transport_mode      TEXT,
    departure_date      DATE,
    port_arrival_date   DATE,
    -- Déchargement prévu, horaire compris : c'est la date de référence du
    -- tableau et celle qui pilote les alertes.
    prev_dechargement_at TIMESTAMPTZ,

    -- ── Facturation ──────────────────────────────────────────────────
    invoice_no          TEXT,
    invoice_date        DATE,

    reference_externe   TEXT,
    notes               TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID        REFERENCES public.profiles(user_id) ON DELETE SET NULL,

    CONSTRAINT flux_handpick_direction_valid
        CHECK (direction IN ('in', 'out')),

    CONSTRAINT flux_handpick_status_valid
        CHECK (status IN ('planifié', 'en_transit', 'déchargé', 'reçu', 'annulé')),

    -- Même CHECK croisé que sur les mouvements : le motif dépend du sens.
    -- Le miroir TypeScript reste MOTIFS_BY_DIRECTION.
    CONSTRAINT flux_handpick_motif_matches_direction CHECK (
        (direction = 'in'  AND motif IN (
            'arrivage', 'retour', 'transfert_entrant', 'production', 'ajustement'))
        OR
        (direction = 'out' AND motif IN (
            'vente', 'depart', 'transfert_sortant', 'casse', 'perte', 'ajustement'))
    )
);

COMMENT ON TABLE public.flux_handpick IS
    'En-tête d''un arrivage ou d''un départ du stock handpick. Ses lignes '
    '(la liste de colisage) sont dans mouvements_handpick.flux_id.';

COMMENT ON COLUMN public.flux_handpick.prev_dechargement_at IS
    'Déchargement prévu. Date de référence du tableau : elle pilote le tri, '
    'le groupement par mois, le surlignage des prochains arrivages et '
    'l''alerte facture.';

-- ─── 3. Index, updated_at ───────────────────────────────────────────────

-- Le tableau trie par date de référence décroissante, par sens.
CREATE INDEX IF NOT EXISTS idx_flux_handpick_direction_dechargement
    ON public.flux_handpick (direction, prev_dechargement_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_flux_handpick_status
    ON public.flux_handpick (status);

CREATE INDEX IF NOT EXISTS idx_flux_handpick_fournisseur
    ON public.flux_handpick (fournisseur_id);

-- Alerte facture : les lignes sans date de facture sont les seules
-- scannées, d'où un index partiel.
CREATE INDEX IF NOT EXISTS idx_flux_handpick_invoice_missing
    ON public.flux_handpick (prev_dechargement_at)
    WHERE invoice_date IS NULL;

DROP TRIGGER IF EXISTS set_flux_handpick_updated_at ON public.flux_handpick;
CREATE TRIGGER set_flux_handpick_updated_at
    BEFORE UPDATE ON public.flux_handpick
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 4. Backfill depuis les mouvements existants ────────────────────────
-- À exécuter AVANT la §6, qui retire les colonnes lues ici.
--
-- Deux populations, et il faut les deux : `batch_id` n'était jamais
-- renseigné par l'interface (le formulaire appelait insertMouvement, pas
-- insertMouvementBatch), donc la préproduction ne contient
-- vraisemblablement que des lignes orphelines. Les ignorer les ferait
-- disparaître du tableau après migration.
--
--   a) un en-tête par `batch_id` distinct — lignes saisies en lot ;
--   b) un en-tête par ligne sans `batch_id` — mouvement isolé, qui
--      devient un flux à une ligne.
--
-- Statut `reçu` : ces mouvements sont déjà enregistrés, donc advenus.

DO $$
BEGIN
    -- Rien à reprendre si la colonne a déjà été renommée par un passage
    -- précédent : le backfill a alors déjà eu lieu.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'mouvements_handpick'
          AND column_name  = 'batch_id'
    ) THEN
        RAISE NOTICE 'flux_handpick: backfill déjà effectué, section ignorée';
        RETURN;
    END IF;

    -- La colonne cible doit exister avant qu'on y écrive.
    ALTER TABLE public.mouvements_handpick
        ADD COLUMN IF NOT EXISTS flux_id UUID;

    -- (a) Lots existants. L'id de l'en-tête EST l'ancien batch_id : la FK
    -- se pose ensuite sans table de correspondance.
    INSERT INTO public.flux_handpick (
        id, direction, motif, status, status_auto, fournisseur_id,
        prev_dechargement_at, reference_externe, created_at, updated_at, created_by
    )
    SELECT
        m.batch_id,
        -- Les lignes d'un lot partagent ces valeurs par construction ;
        -- `array_agg(...)[1]` prend celle de la plus ancienne plutôt que
        -- d'imposer un GROUP BY sur cinq colonnes de plus.
        (array_agg(m.direction         ORDER BY m.created_at))[1],
        (array_agg(m.motif             ORDER BY m.created_at))[1],
        'reçu',
        FALSE,
        (array_agg(m.fournisseur_id    ORDER BY m.created_at))[1],
        min(m.occurred_at),
        (array_agg(m.reference_externe ORDER BY m.created_at))[1],
        min(m.created_at),
        now(),
        (array_agg(m.created_by        ORDER BY m.created_at))[1]
    FROM public.mouvements_handpick m
    WHERE m.batch_id IS NOT NULL
    GROUP BY m.batch_id
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.mouvements_handpick
    SET flux_id = batch_id
    WHERE batch_id IS NOT NULL AND flux_id IS NULL;

    -- (b) Mouvements isolés : un en-tête par ligne, réutilisant l'id de la
    -- ligne pour rester déterministe si la migration est rejouée.
    INSERT INTO public.flux_handpick (
        id, direction, motif, status, status_auto, fournisseur_id,
        prev_dechargement_at, reference_externe, notes, created_at, updated_at, created_by
    )
    SELECT
        m.id, m.direction, m.motif, 'reçu', FALSE, m.fournisseur_id,
        m.occurred_at, m.reference_externe, m.notes, m.created_at, now(), m.created_by
    FROM public.mouvements_handpick m
    WHERE m.batch_id IS NULL
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.mouvements_handpick
    SET flux_id = id
    WHERE batch_id IS NULL AND flux_id IS NULL;
END $$;

-- ─── 5. Rattachement des lignes ─────────────────────────────────────────

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name   = 'mouvements_handpick'
          AND column_name  = 'batch_id'
    ) THEN
        DROP INDEX IF EXISTS public.idx_mouvements_handpick_batch;
        ALTER TABLE public.mouvements_handpick DROP COLUMN batch_id;
    END IF;
END $$;

-- Toute ligne appartient désormais à un flux. Un ajustement d'inventaire
-- isolé est un flux à une ligne — pas une ligne sans parent : sans quoi
-- l'écran ne saurait pas où l'afficher.
ALTER TABLE public.mouvements_handpick
    ALTER COLUMN flux_id SET NOT NULL;

ALTER TABLE public.mouvements_handpick
    DROP CONSTRAINT IF EXISTS mouvements_handpick_flux_fk;

-- CASCADE : une ligne de colisage n'a aucun sens sans son expédition.
ALTER TABLE public.mouvements_handpick
    ADD CONSTRAINT mouvements_handpick_flux_fk
    FOREIGN KEY (flux_id) REFERENCES public.flux_handpick(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_mouvements_handpick_flux
    ON public.mouvements_handpick (flux_id);

COMMENT ON COLUMN public.mouvements_handpick.flux_id IS
    'Expédition à laquelle appartient cette ligne de colisage.';

-- ─── 6. Retrait des colonnes montées sur l'en-tête ──────────────────────
-- Elles décrivaient l'expédition entière et étaient recopiées sur chaque
-- ligne. Les garder aurait laissé deux sources de vérité pour la même
-- information.

ALTER TABLE public.mouvements_handpick
    DROP CONSTRAINT IF EXISTS mouvements_handpick_motif_matches_direction;
ALTER TABLE public.mouvements_handpick
    DROP CONSTRAINT IF EXISTS mouvements_handpick_direction_valid;

DROP INDEX IF EXISTS public.idx_mouvements_handpick_direction;
DROP INDEX IF EXISTS public.idx_mouvements_handpick_occurred;
DROP INDEX IF EXISTS public.idx_mouvements_handpick_fournisseur;

ALTER TABLE public.mouvements_handpick DROP COLUMN IF EXISTS direction;
ALTER TABLE public.mouvements_handpick DROP COLUMN IF EXISTS motif;
ALTER TABLE public.mouvements_handpick DROP COLUMN IF EXISTS fournisseur_id;
ALTER TABLE public.mouvements_handpick DROP COLUMN IF EXISTS occurred_at;
ALTER TABLE public.mouvements_handpick DROP COLUMN IF EXISTS reference_externe;

-- ─── 7. Vue de lecture : en-tête + totaux de sa liste de colisage ───────
-- `security_invoker` : la vue s'exécute avec les droits de l'appelant, donc
-- la RLS de `flux_handpick` et de `mouvements_handpick` s'applique. Sans
-- cette option, une vue PostgreSQL s'exécute avec les droits de son
-- propriétaire et court-circuiterait silencieusement les policies.

DROP VIEW IF EXISTS public.v_flux_handpick;

CREATE VIEW public.v_flux_handpick
WITH (security_invoker = true) AS
SELECT
    f.*,
    COALESCE(l.lignes_count,    0)    AS lignes_count,
    -- Les quantités ne s'additionnent qu'à unité égale : deux totaux
    -- distincts plutôt qu'une somme qui mélangerait kilos et pièces.
    COALESCE(l.total_weight_kg,  0)   AS total_weight_kg,
    COALESCE(l.total_qty,        0)   AS total_qty,
    COALESCE(l.total_value,      0)   AS total_value
FROM public.flux_handpick f
LEFT JOIN LATERAL (
    SELECT
        count(*)                                                              AS lignes_count,
        sum(m.quantity)    FILTER (WHERE m.quantity_unit = 'kg')              AS total_weight_kg,
        sum(m.quantity)    FILTER (WHERE m.quantity_unit = 'pieces')          AS total_qty,
        sum(m.total_value)                                                    AS total_value
    FROM public.mouvements_handpick m
    WHERE m.flux_id = f.id
) l ON TRUE;

COMMENT ON VIEW public.v_flux_handpick IS
    'En-têtes de flux augmentés des totaux de leur liste de colisage. '
    'Les totaux sont DÉRIVÉS des lignes et jamais stockés : contrairement au '
    'stock principal, qui les saisit à la main faute de détail, le handpick a '
    'le détail — c''est lui qui fait foi.';

-- ─── 8. Transitions de statut pilotées par le temps ─────────────────────
-- Repris de `20260707140000_arrivage_status_auto_cron.sql`. Deux niveaux,
-- pour la raison qui y est documentée : le trigger ne s'évalue qu'à
-- l'écriture, et le passage `en_transit → reçu` ne dépend que du temps —
-- une ligne que personne n'édite resterait bloquée.
--
-- La date fait foi, y compris sur un statut saisi à la main. Pour
-- maintenir une expédition retardée en `en_transit`, on met à jour
-- `prev_dechargement_at`, pas le statut.

CREATE OR REPLACE FUNCTION public.auto_set_flux_handpick_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    -- Une expédition annulée ne bouge plus : sans cette garde, le scan la
    -- ferait repasser en `reçu` dès sa date de déchargement franchie.
    IF NEW.status = 'annulé' THEN
        RETURN NEW;
    END IF;

    IF NEW.departure_date IS NOT NULL
       AND NEW.departure_date < CURRENT_DATE
       AND NEW.status = 'planifié'
    THEN
        NEW.status      := 'en_transit';
        NEW.status_auto := TRUE;
    END IF;

    -- Pas de RETURN entre les deux blocs : les transitions se chaînent
    -- dans la même écriture, sinon une ligne très en retard exigerait deux
    -- éditions successives pour atteindre `reçu`.
    IF NEW.prev_dechargement_at IS NOT NULL
       AND NEW.prev_dechargement_at < now()
       AND NEW.status = 'en_transit'
    THEN
        NEW.status      := 'reçu';
        NEW.status_auto := TRUE;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_flux_handpick_status ON public.flux_handpick;
CREATE TRIGGER set_flux_handpick_status
    BEFORE INSERT OR UPDATE ON public.flux_handpick
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_flux_handpick_status();

CREATE OR REPLACE FUNCTION public.apply_flux_handpick_status_transitions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Ordre volontaire : `planifié → en_transit` d'abord, pour qu'une
    -- ligne très en retard atteigne `reçu` dans le même passage.
    UPDATE public.flux_handpick
    SET status = 'en_transit', status_auto = TRUE
    WHERE status = 'planifié'
      AND departure_date IS NOT NULL
      AND departure_date < CURRENT_DATE;

    UPDATE public.flux_handpick
    SET status = 'reçu', status_auto = TRUE
    WHERE status = 'en_transit'
      AND prev_dechargement_at IS NOT NULL
      AND prev_dechargement_at < now();
END;
$$;

-- ─── 9. RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.flux_handpick ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flux_handpick_select" ON public.flux_handpick;
CREATE POLICY "flux_handpick_select" ON public.flux_handpick
    FOR SELECT
    USING (
        has_permission('stock_handpick.flux.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "flux_handpick_insert" ON public.flux_handpick;
CREATE POLICY "flux_handpick_insert" ON public.flux_handpick
    FOR INSERT
    WITH CHECK (
        has_permission('stock_handpick.flux.create'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "flux_handpick_update" ON public.flux_handpick;
CREATE POLICY "flux_handpick_update" ON public.flux_handpick
    FOR UPDATE
    USING (
        has_permission('stock_handpick.flux.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    )
    WITH CHECK (
        has_permission('stock_handpick.flux.update'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

DROP POLICY IF EXISTS "flux_handpick_delete" ON public.flux_handpick;
CREATE POLICY "flux_handpick_delete" ON public.flux_handpick
    FOR DELETE
    USING (
        has_permission('stock_handpick.flux.delete'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

-- ─── 10. Journal d'activité ─────────────────────────────────────────────
-- Réutilise la fonction générique du module. Le libellé lisible est le
-- n° de conteneur : c'est ce que l'équipe cite quand elle parle d'une
-- expédition.

DROP TRIGGER IF EXISTS log_flux_handpick_activity ON public.flux_handpick;
CREATE TRIGGER log_flux_handpick_activity
    AFTER INSERT OR UPDATE OR DELETE ON public.flux_handpick
    FOR EACH ROW EXECUTE FUNCTION public.log_handpick_activity('flux', 'container_no');

-- ─── 11. Planification pg_cron ──────────────────────────────────────────
-- Minute 15 plutôt que 5 : le scan des arrivages du stock principal
-- occupe déjà la minute 5, inutile de faire converger deux balayages sur
-- la même minute.
-- Repli possible : appeler la fonction depuis le backend Go.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
        BEGIN
            CREATE EXTENSION IF NOT EXISTS pg_cron;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'pg_cron non installable ici (%).', SQLERRM;
        END;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'flux-handpick-status-auto') THEN
            PERFORM cron.unschedule('flux-handpick-status-auto');
        END IF;
        PERFORM cron.schedule(
            'flux-handpick-status-auto',
            '15 * * * *',
            $cmd$ SELECT public.apply_flux_handpick_status_transitions(); $cmd$
        );
    END IF;
END $$;
