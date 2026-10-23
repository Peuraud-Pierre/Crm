-- ============================================================
-- Journal d'activité automatique sur modification de client
--
-- Chaque UPDATE de client_crm crée une entrée dans Client_activite
-- décrivant champ par champ ce qui a changé (ancien → nouveau) :
--   - changement de colonne pipeline (« Changement de pipe »)
--   - modification de fiche (nom, emails, téléphones, société, etc.)
--
-- Avantage du trigger : capte TOUTES les écritures, y compris le
-- drag & drop du kanban, la fiche client et le bridge Amelia qui
-- écrit directement en base (même pattern que le journal arrivages,
-- cf. 20260601_activity_log_full_changes.sql).
--
-- Anti-bruit : les updates qui ne touchent que updated_at (ex.
-- touchClientTimestamp après création d'une activité) ne créent
-- AUCUNE entrée — sinon boucle activité → updated_at → activité.
-- ============================================================

-- ─── Libellés des colonnes du pipeline ────────────────────────────────────────
-- Doit rester aligné avec PIPELINE_LABELS_PDF (colonneg.tsx) côté front.
CREATE OR REPLACE FUNCTION public.client_pipe_label(p INT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE p
        WHEN 0 THEN 'Nouveau lead'
        WHEN 1 THEN 'En qualification'
        WHEN 2 THEN 'En incubation'
        WHEN 3 THEN 'RDV Découverte'
        WHEN 4 THEN 'RDV Achat'
        WHEN 5 THEN 'Visio RDV'
        WHEN 6 THEN 'Client Actif'
        WHEN 7 THEN 'Dormant'
        WHEN 8 THEN 'No Show'
        WHEN 9 THEN 'RDV à confirmer'
        ELSE COALESCE(p::text, '—')
    END;
$$;

-- ─── Valeur affichable (tronquée, jamais NULL) ───────────────────────────────
CREATE OR REPLACE FUNCTION public.client_log_val(v TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
    SELECT COALESCE(NULLIF(left(v, 120), ''), '—');
$$;

-- ─── Trigger function ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_client_crm_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_changes TEXT := '';
    v_title   TEXT;
    v_owner   UUID;
    v_old_com TEXT;
    v_new_com TEXT;
BEGIN
    -- Pipeline en premier : c'est l'info la plus suivie.
    IF NEW.collum IS DISTINCT FROM OLD.collum THEN
        v_changes := v_changes || format(E'Pipeline : %s → %s\n',
            public.client_pipe_label(OLD.collum),
            public.client_pipe_label(NEW.collum));
    END IF;

    IF NEW.nom IS DISTINCT FROM OLD.nom THEN
        v_changes := v_changes || format(E'Nom : %s → %s\n',
            public.client_log_val(OLD.nom), public.client_log_val(NEW.nom));
    END IF;
    IF NEW.societe IS DISTINCT FROM OLD.societe THEN
        v_changes := v_changes || format(E'Société : %s → %s\n',
            public.client_log_val(OLD.societe), public.client_log_val(NEW.societe));
    END IF;
    IF NEW.mail IS DISTINCT FROM OLD.mail THEN
        v_changes := v_changes || format(E'Email : %s → %s\n',
            public.client_log_val(OLD.mail), public.client_log_val(NEW.mail));
    END IF;
    IF NEW.mail_2 IS DISTINCT FROM OLD.mail_2 THEN
        v_changes := v_changes || format(E'Email secondaire : %s → %s\n',
            public.client_log_val(OLD.mail_2), public.client_log_val(NEW.mail_2));
    END IF;
    IF NEW.telephone IS DISTINCT FROM OLD.telephone THEN
        v_changes := v_changes || format(E'Téléphone : %s → %s\n',
            public.client_log_val(OLD.telephone), public.client_log_val(NEW.telephone));
    END IF;
    IF NEW.telephone_2 IS DISTINCT FROM OLD.telephone_2 THEN
        v_changes := v_changes || format(E'Téléphone secondaire : %s → %s\n',
            public.client_log_val(OLD.telephone_2), public.client_log_val(NEW.telephone_2));
    END IF;
    IF NEW.localisation IS DISTINCT FROM OLD.localisation THEN
        v_changes := v_changes || format(E'Localisation : %s → %s\n',
            public.client_log_val(OLD.localisation), public.client_log_val(NEW.localisation));
    END IF;
    IF NEW.siret IS DISTINCT FROM OLD.siret THEN
        v_changes := v_changes || format(E'SIRET : %s → %s\n',
            public.client_log_val(OLD.siret), public.client_log_val(NEW.siret));
    END IF;
    IF NEW."numero_TVA" IS DISTINCT FROM OLD."numero_TVA" THEN
        v_changes := v_changes || format(E'Numéro de TVA : %s → %s\n',
            public.client_log_val(OLD."numero_TVA"), public.client_log_val(NEW."numero_TVA"));
    END IF;
    IF NEW.insta IS DISTINCT FROM OLD.insta THEN
        v_changes := v_changes || format(E'Instagram : %s → %s\n',
            public.client_log_val(OLD.insta), public.client_log_val(NEW.insta));
    END IF;
    IF NEW.adresse_facturation IS DISTINCT FROM OLD.adresse_facturation THEN
        v_changes := v_changes || format(E'Adresse de facturation : %s → %s\n',
            public.client_log_val(OLD.adresse_facturation),
            public.client_log_val(NEW.adresse_facturation));
    END IF;
    IF NEW.message IS DISTINCT FROM OLD.message THEN
        v_changes := v_changes || format(E'Message : %s → %s\n',
            public.client_log_val(OLD.message), public.client_log_val(NEW.message));
    END IF;
    IF NEW.prise_en_charge IS DISTINCT FROM OLD.prise_en_charge THEN
        v_changes := v_changes || format(E'Prise en charge : %s → %s\n',
            public.client_log_val(OLD.prise_en_charge),
            public.client_log_val(NEW.prise_en_charge));
    END IF;
    IF NEW.closers IS DISTINCT FROM OLD.closers THEN
        v_changes := v_changes || format(E'Closer : %s → %s\n',
            public.client_log_val(OLD.closers), public.client_log_val(NEW.closers));
    END IF;
    IF NEW.commandes IS DISTINCT FROM OLD.commandes THEN
        v_changes := v_changes || format(E'Commandes : %s → %s\n',
            public.client_log_val(OLD.commandes), public.client_log_val(NEW.commandes));
    END IF;
    IF NEW.depense IS DISTINCT FROM OLD.depense THEN
        v_changes := v_changes || format(E'Dépense : %s → %s\n',
            public.client_log_val(OLD.depense::text),
            public.client_log_val(NEW.depense::text));
    END IF;

    -- Commercial attribué : on résout le nom via profiles, fallback UUID.
    IF NEW.customer IS DISTINCT FROM OLD.customer THEN
        SELECT full_name INTO v_old_com FROM public.profiles WHERE user_id::text = OLD.customer;
        SELECT full_name INTO v_new_com FROM public.profiles WHERE user_id::text = NEW.customer;
        v_changes := v_changes || format(E'Commercial attribué : %s → %s\n',
            public.client_log_val(COALESCE(v_old_com, OLD.customer)),
            public.client_log_val(COALESCE(v_new_com, NEW.customer)));
    END IF;

    -- Champs JSON volumineux : on signale la mise à jour sans dumper les valeurs.
    IF NEW.brief IS DISTINCT FROM OLD.brief THEN
        v_changes := v_changes || E'Brief / fiche appro mis à jour\n';
    END IF;
    IF NEW.adresse_livraison IS DISTINCT FROM OLD.adresse_livraison THEN
        v_changes := v_changes || E'Adresse de livraison mise à jour\n';
    END IF;

    -- Rien de significatif (ex. seul updated_at a bougé) → pas d'activité.
    IF v_changes = '' THEN
        RETURN NEW;
    END IF;

    v_title := CASE
        WHEN NEW.collum IS DISTINCT FROM OLD.collum THEN 'Changement de pipe'
        ELSE 'Fiche client modifiée'
    END;

    -- auth.uid() = utilisateur Supabase à l'origine de la requête ;
    -- NULL pour les écritures service_role (bridge Amelia, jobs).
    BEGIN
        v_owner := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        v_owner := NULL;
    END;

    INSERT INTO public."Client_activite" (client, date, title, content, owner)
    VALUES (NEW.id, now(), v_title, rtrim(v_changes, E'\n'), v_owner);

    RETURN NEW;
END;
$$;

-- ─── Trigger ──────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trigger_log_client_crm_changes ON public.client_crm;
CREATE TRIGGER trigger_log_client_crm_changes
    AFTER UPDATE ON public.client_crm
    FOR EACH ROW
    EXECUTE FUNCTION public.log_client_crm_changes();

COMMENT ON FUNCTION public.log_client_crm_changes IS
    'Journalise dans Client_activite chaque modification de client_crm (pipeline, fiche) avec le détail ancien → nouveau.';
