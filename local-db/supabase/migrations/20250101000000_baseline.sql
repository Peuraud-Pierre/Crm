-- =====================================================================
-- Nokk_project — schéma de base pour Supabase LOCAL (dev uniquement).
--
-- Généré par scripts/local-db/regen.sh : rejeu de supabase/migrations +
-- complément depuis src/integrations/supabase/types.ts pour les tables créées
-- à la main dans le dashboard de prod (jamais versionnées). Ne pas éditer à la
-- main, ne pas appliquer en prod.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

do $$ begin create role content_generation nologin; exception when duplicate_object then null; end $$;




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."Priorities" AS ENUM (
    'Urgent',
    'Haute',
    'Normal',
    'Basse',
    'Nouveau'
);


ALTER TYPE "public"."Priorities" OWNER TO "postgres";


CREATE TYPE "public"."arrivage_status" AS ENUM (
    'planifié',
    'en_transit',
    'reçu',
    'annulé'
);


ALTER TYPE "public"."arrivage_status" OWNER TO "postgres";


CREATE TYPE "public"."arrivage_type" AS ENUM (
    'Standard',
    'Express',
    'Groupé'
);


ALTER TYPE "public"."arrivage_type" OWNER TO "postgres";


CREATE TYPE "public"."changelog_version_status" AS ENUM (
    'draft',
    'published',
    'archived'
);


ALTER TYPE "public"."changelog_version_status" OWNER TO "postgres";


CREATE TYPE "public"."project_sprint_status" AS ENUM (
    'planned',
    'active',
    'completed',
    'archived'
);


ALTER TYPE "public"."project_sprint_status" OWNER TO "postgres";


CREATE TYPE "public"."project_task_status" AS ENUM (
    'todo',
    'in_progress',
    'review',
    'done'
);


ALTER TYPE "public"."project_task_status" OWNER TO "postgres";


CREATE TYPE "public"."project_team_status" AS ENUM (
    'active',
    'archived'
);


ALTER TYPE "public"."project_team_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."Chronos_trg"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$BEGIN
    IF NEW.collum = 0 THEN
        NEW.prise_en_charge := NULL;

    ELSIF NEW.collum >= 1 AND NEW.prise_en_charge IS NULL THEN
        -- NOW() renvoie la date ET l'heure (ex: 2023-10-27 14:30:05)
        NEW.prise_en_charge := NOW();
    END IF;

    RETURN NEW;
END;$$;


ALTER FUNCTION "public"."Chronos_trg"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."annonce_targets_viewer"("p_role_ids" "uuid"[], "p_service_ids" "uuid"[]) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT
        -- Aucune audience déclarée → annonce générale.
        (
            coalesce(cardinality(p_role_ids), 0) = 0
            AND coalesce(cardinality(p_service_ids), 0) = 0
        )
        OR EXISTS (
            SELECT 1
            FROM public.profiles pr
            WHERE pr.user_id = (SELECT auth.uid())
              AND (
                  pr.role_id    = ANY(coalesce(p_role_ids,    '{}'::uuid[]))
                  OR pr.service_id = ANY(coalesce(p_service_ids, '{}'::uuid[]))
              )
        );
$$;


ALTER FUNCTION "public"."annonce_targets_viewer"("p_role_ids" "uuid"[], "p_service_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_maintenance_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."app_maintenance_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_arrivage_status_transitions"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
    UPDATE public.arrivage_manuel
    SET status = 'en_transit', status_auto = TRUE
    WHERE status = 'planifié'
      AND departure_date IS NOT NULL
      AND departure_date < CURRENT_DATE;

    UPDATE public.arrivage_manuel
    SET status = 'reçu', status_auto = TRUE
    WHERE status = 'en_transit'
      AND prev_dechargement_at IS NOT NULL
      AND prev_dechargement_at < NOW();
END;
$$;


ALTER FUNCTION "public"."apply_arrivage_status_transitions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_elo_on_match"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  k_factor integer := 32;
  r1 float;
  r2 float;
  e1 float;
  e2 float;
  s1 float;
  s2 float;
  new_r1 integer;
  new_r2 integer;
  p1 record;
  p2 record;
  winner uuid;
BEGIN
  -- only run when setting to completed and not applied yet
  IF NEW.status <> 'completed' OR NEW.elo_applied = true THEN
    RETURN NEW;
  END IF;

  -- decide winner if not provided
  IF NEW.winner_id IS NULL THEN
    IF COALESCE(NEW.player1_score,0) > COALESCE(NEW.player2_score,0) THEN
      winner := NEW.player1_id;
    ELSE
      winner := NEW.player2_id;
    END IF;
    NEW.winner_id := winner;
  ELSE
    winner := NEW.winner_id;
  END IF;

  -- fetch players
  SELECT * INTO p1 FROM public.ping_pong_players WHERE user_id = NEW.player1_id LIMIT 1;
  SELECT * INTO p2 FROM public.ping_pong_players WHERE user_id = NEW.player2_id LIMIT 1;

  -- if profiles don't exist, create them with default ELO
  IF p1 IS NULL THEN
    INSERT INTO public.ping_pong_players(user_id) VALUES (NEW.player1_id) RETURNING * INTO p1;
  END IF;
  IF p2 IS NULL THEN
    INSERT INTO public.ping_pong_players(user_id) VALUES (NEW.player2_id) RETURNING * INTO p2;
  END IF;

  -- compute expected scores
  r1 := POWER(10, p1.elo_rating / 400.0);
  r2 := POWER(10, p2.elo_rating / 400.0);
  e1 := r1 / (r1 + r2);
  e2 := r2 / (r1 + r2);

  -- actual scores
  s1 := CASE WHEN winner = NEW.player1_id THEN 1 ELSE 0 END;
  s2 := CASE WHEN winner = NEW.player2_id THEN 1 ELSE 0 END;

  -- new ratings
  new_r1 := ROUND(p1.elo_rating + k_factor * (s1 - e1));
  new_r2 := ROUND(p2.elo_rating + k_factor * (s2 - e2));

  -- update players
  UPDATE public.ping_pong_players
    SET elo_rating = new_r1,
        wins = wins + (CASE WHEN s1 = 1 THEN 1 ELSE 0 END),
        losses = losses + (CASE WHEN s1 = 0 THEN 1 ELSE 0 END),
        updated_at = now()
    WHERE id = p1.id;

  UPDATE public.ping_pong_players
    SET elo_rating = new_r2,
        wins = wins + (CASE WHEN s2 = 1 THEN 1 ELSE 0 END),
        losses = losses + (CASE WHEN s2 = 0 THEN 1 ELSE 0 END),
        updated_at = now()
    WHERE id = p2.id;

  NEW.elo_applied := true;
  NEW.played_at := COALESCE(NEW.played_at, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."apply_elo_on_match"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_flux_handpick_status_transitions"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    UPDATE public.flux_handpick
    SET status = 'en_transit'
    WHERE status = 'planifié'
      AND departure_date IS NOT NULL
      AND departure_date < CURRENT_DATE;

    UPDATE public.flux_handpick
    SET status = 'reçu'
    WHERE status = 'en_transit'
      AND prev_dechargement_at IS NOT NULL
      AND prev_dechargement_at < now();
END;
$$;


ALTER FUNCTION "public"."apply_flux_handpick_status_transitions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assign_closer_on_event_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.id_client is not null and new.customer is not null then
    if tg_op = 'INSERT'
       or new.customer is distinct from old.customer
       or new.id_client is distinct from old.id_client
    then
      update public.client_crm
      set closers = new.customer,
          updated_at = now()
      where id = new.id_client;
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."assign_closer_on_event_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_session_is_aal2"() RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$ select coalesce(auth.jwt() ->> 'aal', '') = 'aal2' $$;


ALTER FUNCTION "public"."auth_session_is_aal2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_set_arrivage_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
    -- Planifié → en_transit : date de départ passée
    IF NEW.departure_date IS NOT NULL
       AND NEW.departure_date < CURRENT_DATE
       AND NEW.status = 'planifié'
    THEN
        NEW.status      := 'en_transit';
        NEW.status_auto := TRUE;
    END IF;

    -- En transit → reçu : date de déchargement prévue passée.
    -- Pas de RETURN entre les deux blocs : les transitions se chaînent
    -- dans la même écriture.
    IF NEW.prev_dechargement_at IS NOT NULL
       AND NEW.prev_dechargement_at < NOW()
       AND NEW.status = 'en_transit'
    THEN
        NEW.status      := 'reçu';
        NEW.status_auto := TRUE;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_set_arrivage_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_set_flux_handpick_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.status = 'annulé' THEN
        RETURN NEW;
    END IF;

    IF NEW.departure_date IS NOT NULL
       AND NEW.departure_date < CURRENT_DATE
       AND NEW.status = 'planifié'
    THEN
        NEW.status := 'en_transit';
    END IF;

    -- Transitions chaînées dans la même écriture.
    IF NEW.prev_dechargement_at IS NOT NULL
       AND NEW.prev_dechargement_at < now()
       AND NEW.status = 'en_transit'
    THEN
        NEW.status := 'reçu';
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_set_flux_handpick_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."carton_coherence"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."carton_coherence"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."carton_refresh_commande"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM public.refresh_commande_statut(
        (SELECT commande_id FROM public.livraisons_boutique WHERE id = COALESCE(NEW.livraison_id, OLD.livraison_id))
    );
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."carton_refresh_commande"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."changelog_replace_items"("p_version_id" "uuid", "p_items" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
    IF jsonb_typeof(p_items) <> 'array' THEN
        RAISE EXCEPTION 'p_items doit être un tableau JSON, reçu %',
            jsonb_typeof(p_items);
    END IF;

    DELETE FROM public.changelog_items WHERE version_id = p_version_id;

    INSERT INTO public.changelog_items
        (version_id, category_id, title, description, position)
    SELECT
        p_version_id,
        (item ->> 'category_id')::uuid,
        item ->> 'title',
        nullif(item ->> 'description', ''),
        coalesce((item ->> 'position')::int, ordinality::int - 1)
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(item, ordinality);
END;
$$;


ALTER FUNCTION "public"."changelog_replace_items"("p_version_id" "uuid", "p_items" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."changelog_replace_items"("p_version_id" "uuid", "p_items" "jsonb") IS 'Remplace en une transaction tous les éléments d''une version de changelog. SECURITY INVOKER : la RLS de l''appelant s''applique.';



CREATE OR REPLACE FUNCTION "public"."check_arrivage_invoice_reminder"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
DECLARE
    v_service_id UUID;
    v_title      TEXT;
BEGIN
    IF NEW.prev_dechargement_at IS NULL                       THEN RETURN NEW; END IF;
    IF NEW.prev_dechargement_at <= NOW()                      THEN RETURN NEW; END IF;
    IF NEW.prev_dechargement_at > NOW() + INTERVAL '7 days'  THEN RETURN NEW; END IF;
    IF NEW.invoice_date IS NOT NULL                           THEN RETURN NEW; END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.prev_dechargement_at IS NOT DISTINCT FROM NEW.prev_dechargement_at
       AND OLD.invoice_date IS NOT DISTINCT FROM NEW.invoice_date
    THEN RETURN NEW; END IF;

    SELECT service_id INTO v_service_id
    FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
    IF v_service_id IS NULL THEN RETURN NEW; END IF;

    v_title := 'Facture manquante J-7 : ' || NEW.container_no;

    IF NOT EXISTS (
        SELECT 1 FROM public.notification
        WHERE user_id = v_service_id
          AND title = v_title
          AND created_at > NOW() - INTERVAL '24 hours'
    ) THEN
        INSERT INTO public.notification(user_id, type, title, url)
        VALUES (v_service_id, 'system', v_title, '/stock/arrivage/' || NEW.id);
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_arrivage_invoice_reminder"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_is_service_admin"("target_service_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ begin
  return exists (
    select 1 from public.profiles p join public.roles r on r.id = p.role_id
    where p.user_id = auth.uid() and p.service_id = target_service_id
      and public.role_slug(r.nom) in ('admin', 'superadmin'));
end $$;


ALTER FUNCTION "public"."check_is_service_admin"("target_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_is_super_admin_global"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ begin return public.user_is_global_admin(auth.uid()); end $$;


ALTER FUNCTION "public"."check_is_super_admin_global"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."client_log_val"("v" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
    SELECT COALESCE(NULLIF(left(v, 120), ''), '—');
$$;


ALTER FUNCTION "public"."client_log_val"("v" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."client_pipe_label"("p" integer) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."client_pipe_label"("p" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cloturer_commande"("p_id" "uuid", "p_motif" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."cloturer_commande"("p_id" "uuid", "p_motif" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cloturer_livraison"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."cloturer_livraison"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cm_can_access_chat_folder"("p_folder" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_uid uuid := auth.uid();
    v_group_id uuid;
    v_parts text[];
BEGIN
    IF v_uid IS NULL OR p_folder IS NULL THEN
        RETURN false;
    END IF;

    -- Conversation de groupe. Comparaison littérale plutôt qu'un LIKE : dans
    -- un motif LIKE, `_` est un joker qui accepterait n'importe quel
    -- caractère à cette position, et son échappement dépend du contexte.
    IF left(p_folder, 6) = 'group_' THEN
        BEGIN
            v_group_id := substring(p_folder FROM 7)::uuid;
        EXCEPTION WHEN others THEN
            -- Dossier malformé : on refuse plutôt que de laisser passer.
            RETURN false;
        END;
        RETURN cmg_is_member(v_group_id, v_uid);
    END IF;

    -- Conversation 1-à-1 : les deux identifiants sont dans le nom du dossier.
    -- Un UUID ne contient jamais `_`, donc le séparateur `__` est sans
    -- ambiguïté.
    v_parts := string_to_array(p_folder, '__');
    IF array_length(v_parts, 1) = 2 THEN
        RETURN v_uid::text = v_parts[1] OR v_uid::text = v_parts[2];
    END IF;

    RETURN false;
END;
$$;


ALTER FUNCTION "public"."cm_can_access_chat_folder"("p_folder" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cm_can_access_chat_folder"("p_folder" "text") IS 'Vrai si l''utilisateur courant participe à la conversation dont le dossier Storage est passé en argument (bucket cryptedmessage).';



CREATE OR REPLACE FUNCTION "public"."cmg_is_admin"("p_group_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM cryptedmessage_group_members
        WHERE group_id = p_group_id AND user_id = p_user_id AND role = 'admin'
    );
$$;


ALTER FUNCTION "public"."cmg_is_admin"("p_group_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cmg_is_member"("p_group_id" "uuid", "p_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM cryptedmessage_group_members
        WHERE group_id = p_group_id AND user_id = p_user_id
    );
$$;


ALTER FUNCTION "public"."cmg_is_member"("p_group_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."code_commande"("p_numero" bigint) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
    SELECT 'CMD-' || lpad(p_numero::text, 4, '0')
$$;


ALTER FUNCTION "public"."code_commande"("p_numero" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."code_livraison"("p_numero" bigint) RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
    SELECT 'LIV-' || lpad(p_numero::text, 4, '0')
$$;


ALTER FUNCTION "public"."code_livraison"("p_numero" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."commande_boutique_notify"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."commande_boutique_notify"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."commande_ligne_refresh"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM public.refresh_commande_statut(COALESCE(NEW.commande_id, OLD.commande_id));
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."commande_ligne_refresh"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."commande_modifiable_boutique"("p_commande_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."commande_modifiable_boutique"("p_commande_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."commandes_exiger"("p_permission" "text") RETURNS "void"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."commandes_exiger"("p_permission" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_events_on_client_column_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF old.collum IS DISTINCT FROM new.collum
     AND old.collum = 9
     AND new.collum IN (3, 4, 5, 6)
  THEN
    UPDATE public."Event_calendar"
    SET confirmed  = true,
        updated_at = now()
    WHERE id_client = new.id
      AND confirmed = false;
  END IF;

  RETURN new;
END;
$$;


ALTER FUNCTION "public"."confirm_events_on_client_column_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_clients_filtered"("p_user_id" "uuid" DEFAULT NULL::"uuid", "p_start" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_end" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS bigint
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
    SELECT COUNT(*)::bigint
    FROM public.client_crm c
    WHERE (
        -- Filtre collaborateur : mêmes règles que get_client_column_counts
        -- (clients liés à l'utilisateur OU pool partagé customer IS NULL).
        p_user_id IS NULL
        OR c.customer = p_user_id
        OR c.closers = p_user_id
        OR c.customer IS NULL
    )
    AND (p_start IS NULL OR c.created_at >= p_start)
    AND (p_end IS NULL OR c.created_at < p_end);
$$;


ALTER FUNCTION "public"."count_clients_filtered"("p_user_id" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."count_clients_filtered"("p_user_id" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone) IS 'Total clients filtré par collaborateur (p_user_id) et période [p_start, p_end) sur created_at. NULL = pas de filtre sur la dimension correspondante. Utilisé par le KPI "Clients totaux" de l''onglet Analytics.';



CREATE OR REPLACE FUNCTION "public"."create_relance_tasks_on_rdv_achat"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF new.nom NOT IN ('rdv physique achat', 'rdv visio achat') THEN
    RETURN new;
  END IF;

  -- Rien tant que le RDV n'est pas confirmé.
  IF NOT new.confirmed THEN
    RETURN new;
  END IF;

  -- Sur UPDATE : uniquement au passage effectif à confirmed = true, sinon
  -- chaque modification du RDV redupliquerait les tâches.
  IF TG_OP = 'UPDATE' AND old.confirmed IS NOT DISTINCT FROM new.confirmed THEN
    RETURN new;
  END IF;

  v_owner := COALESCE(new.customer, new.creator_id);

  INSERT INTO public."Tache_crm" (type, client, content, date, owner, creator_id, categorie, event_id)
  VALUES
    ('Relance confirmation', new.id_client, 'Relance confirmation de RDV', new.debut - interval '2 days',  v_owner, new.creator_id, 'crm', new.id),
    ('Suivis rdv',           new.id_client, 'Suivi suite au RDV achat',    new.debut + interval '1 day',   v_owner, new.creator_id, 'crm', new.id),
    ('Relance post achat',   new.id_client, 'Relance post achat (RDV)',    new.debut + interval '31 days', v_owner, new.creator_id, 'crm', new.id);

  RETURN new;
END;
$$;


ALTER FUNCTION "public"."create_relance_tasks_on_rdv_achat"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crm_analytics_layout_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."crm_analytics_layout_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."crm_parse_brief"("p_brief" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
DECLARE
    v jsonb := p_brief;
    i int := 0;
BEGIN
    WHILE v IS NOT NULL AND jsonb_typeof(v) = 'string' AND i < 3 LOOP
        BEGIN
            v := NULLIF(v #>> '{}', '')::jsonb;
        EXCEPTION WHEN others THEN
            RETURN NULL;
        END;
        i := i + 1;
    END LOOP;
    IF v IS NULL OR jsonb_typeof(v) <> 'object' THEN
        RETURN NULL;
    END IF;
    RETURN v;
END;
$$;


ALTER FUNCTION "public"."crm_parse_brief"("p_brief" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dashboard_layout_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."dashboard_layout_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detach_eclatees_from_fournisseur_handpick"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    UPDATE public.balles_handpick
       SET fournisseur_label = COALESCE(fournisseur_label, OLD.name),
           fournisseur_id    = NULL
     WHERE fournisseur_id = OLD.id
       AND is_eclatee;
    RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."detach_eclatees_from_fournisseur_handpick"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."emplacements_magasin_check_zone"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    zone_magasin UUID;
BEGIN
    SELECT z.magasin_id INTO zone_magasin
    FROM public.zones_magasin z
    WHERE z.id = NEW.zone_id;

    IF zone_magasin IS NULL THEN
        RAISE EXCEPTION 'Zone introuvable';
    END IF;
    IF zone_magasin <> NEW.magasin_id THEN
        RAISE EXCEPTION 'La zone appartient à un autre magasin';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."emplacements_magasin_check_zone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."equipements_magasin_check_zone"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    zone_magasin UUID;
    zone_etage   UUID;
BEGIN
    IF NEW.zone_id IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT z.magasin_id, z.etage_id INTO zone_magasin, zone_etage
    FROM public.zones_magasin z
    WHERE z.id = NEW.zone_id;
    IF zone_magasin IS NULL THEN
        RAISE EXCEPTION 'Zone introuvable';
    END IF;
    IF zone_magasin <> NEW.magasin_id THEN
        RAISE EXCEPTION 'La zone appartient à un autre magasin';
    END IF;
    IF zone_etage IS DISTINCT FROM NEW.etage_id THEN
        RAISE EXCEPTION 'La zone est sur un autre étage';
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."equipements_magasin_check_zone"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expedier_livraison"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."expedier_livraison"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fiche_tri_label"("p_numero" bigint, "p_trieur_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT 'T-' || lpad(p_numero::text, 4, '0') || COALESCE(' · ' || (SELECT nom FROM public.trieurs WHERE id = p_trieur_id), '')
$$;


ALTER FUNCTION "public"."fiche_tri_label"("p_numero" bigint, "p_trieur_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fiche_tri_resume"("p_fiche_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."fiche_tri_resume"("p_fiche_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finaliser_livraison"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."finaliser_livraison"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."flush_rdv_reschedule_mails"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    r record;
    n int := 0;
BEGIN
    FOR r IN
        DELETE FROM public.rdv_reschedule_mail_queue
         WHERE send_after <= now()
        RETURNING event_id
    LOOP
        IF public.post_rdv_mail(r.event_id, 'reprogrammation') THEN
            n := n + 1;
        END IF;
    END LOOP;

    RETURN n;
END;
$$;


ALTER FUNCTION "public"."flush_rdv_reschedule_mails"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."flush_rdv_reschedule_mails"() IS 'Poste les notifications de changement d''horaire arrivées à échéance et vide la file. Retourne le nombre de mails effectivement postés (les RDV supprimés ou sans email entre-temps sont retirés sans envoi).';



CREATE OR REPLACE FUNCTION "public"."function_call_go_api_on_new_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_dup_count int;
BEGIN
    -- Rien tant que le RDV n'est pas confirmé.
    IF NOT NEW.confirmed THEN
        RETURN NEW;
    END IF;

    -- Sur UPDATE : uniquement au passage effectif à confirmed = true.
    IF TG_OP = 'UPDATE' AND OLD.confirmed IS NOT DISTINCT FROM NEW.confirmed THEN
        RETURN NEW;
    END IF;

    -- Garde anti-doublon : même client, même créneau, inséré il y a moins de
    -- 2 minutes (double-submit, retry, Amelia + sync).
    SELECT count(*) INTO v_dup_count
      FROM public."Event_calendar"
     WHERE id_client = NEW.id_client
       AND debut     = NEW.debut
       AND id <> NEW.id
       AND created_at >= now() - interval '2 minutes';

    IF v_dup_count > 0 THEN
        RAISE NOTICE 'Doublon RDV ignoré (client=%, debut=%)', NEW.id_client, NEW.debut;
        RETURN NEW;
    END IF;

    PERFORM public.post_rdv_mail(NEW.id);

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."function_call_go_api_on_new_event"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app_logs_retention_audit" (
    "id" bigint NOT NULL,
    "executed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "table_name" "text" DEFAULT 'app_logs'::"text" NOT NULL,
    "cutoff_at" timestamp with time zone NOT NULL,
    "deleted_count" integer NOT NULL,
    "oldest_deleted_at" timestamp with time zone,
    "newest_deleted_at" timestamp with time zone,
    "mode" "text" DEFAULT 'automatic'::"text" NOT NULL,
    "triggered_by" "uuid",
    CONSTRAINT "app_logs_retention_audit_mode_check" CHECK (("mode" = ANY (ARRAY['automatic'::"text", 'manual'::"text"])))
);


ALTER TABLE "public"."app_logs_retention_audit" OWNER TO "postgres";


COMMENT ON TABLE "public"."app_logs_retention_audit" IS 'Journal des suppressions de logs (une ligne par table purgée) — rétention RGPD.';



CREATE OR REPLACE FUNCTION "public"."get_app_logs_retention_audit"("p_limit" integer DEFAULT 200) RETURNS SETOF "public"."app_logs_retention_audit"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
    SELECT *
    FROM public.app_logs_retention_audit
    ORDER BY executed_at DESC
    LIMIT GREATEST(p_limit, 1);
$$;


ALTER FUNCTION "public"."get_app_logs_retention_audit"("p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_client_column_counts"("p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("collum" integer, "count" bigint)
    LANGUAGE "sql" STABLE
    AS $$
    WITH all_cols AS (
        SELECT g AS collum FROM generate_series(0, 9) AS g
    ),
    counts AS (
        SELECT COALESCE(c.collum, 0)::int AS collum, COUNT(*)::bigint AS count
        FROM public.client_crm c
        WHERE p_user_id IS NULL
           OR c.customer = p_user_id
           OR c.closers = p_user_id
           OR c.customer IS NULL
           OR c.collum = 9  -- colonne partagée : « RDV à confirmer »
        GROUP BY COALESCE(c.collum, 0)
    )
    SELECT a.collum, COALESCE(c.count, 0)::bigint AS count
    FROM all_cols a
    LEFT JOIN counts c ON c.collum = a.collum
    ORDER BY a.collum;
$$;


ALTER FUNCTION "public"."get_client_column_counts"("p_user_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_client_column_counts"("p_user_id" "uuid") IS 'Compteurs CRM par colonne Kanban (v5). Retourne toujours 10 lignes (indices 0..9), même à count=0. Filtre : clients liés à l''utilisateur OU pool partagé (customer IS NULL) OU colonne partagée à tous (collum 9 « RDV à confirmer »). Si p_user_id est NULL, total global.';



CREATE TABLE IF NOT EXISTS "public"."Event_calendar" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer" "uuid",
    "nom" "text",
    "debut" timestamp with time zone,
    "fin" timestamp with time zone,
    "client" "text",
    "lieu" "text",
    "description" "text",
    "id_client" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "creator_id" "uuid",
    "show" boolean,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "why" "text",
    "source" "text",
    "external_id" "uuid",
    "a confirmer" boolean,
    "reminder_3j_sent_at" timestamp with time zone,
    "confirmed" boolean DEFAULT false,
    "confirmed_by" "uuid"
);


ALTER TABLE "public"."Event_calendar" OWNER TO "postgres";


COMMENT ON COLUMN "public"."Event_calendar"."confirmed" IS 'false = RDV Amelia en attente de confirmation : exclu de l''agenda, du widget « RDV du jour » et de la détection de conflit de créneau. Passe à true quand le client quitte la colonne Kanban 9 vers une colonne RDV.';



COMMENT ON COLUMN "public"."Event_calendar"."confirmed_by" IS 'Utilisateur CRM qui a confirmé ce RDV (Amelia). Non nul : le RDV compte dans les stats comme créé par lui, à la date de confirmation.';



CREATE OR REPLACE FUNCTION "public"."get_crm_event_stats"("p_range_start" timestamp with time zone, "p_range_end" timestamp with time zone) RETURNS SETOF "public"."Event_calendar"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
    SELECT DISTINCT ON (id_client, debut::date) *
    FROM public."Event_calendar"
    WHERE
        created_at >= p_range_start
        AND created_at  < p_range_end
    ORDER BY
        id_client,
        debut::date,
        created_at ASC;
$$;


ALTER FUNCTION "public"."get_crm_event_stats"("p_range_start" timestamp with time zone, "p_range_end" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_permissions"("uid" "uuid") RETURNS TABLE("code" "text")
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  -- Permissions liées au rôle
  select distinct p.code
  from public.profiles pr
  join public.roles_permissions rp on rp.role_id = pr.role_id
  join public.permissions p on p.id = rp.permission_id
  where pr.user_id = uid

  union

  -- Permissions liées au service
  select distinct p.code
  from public.profiles pr
  join public.services_permissions sp on sp.service_id = pr.service_id
  join public.permissions p on p.id = sp.permission_id
  where pr.user_id = uid

  union

  -- Permissions individuelles
  select distinct p.code
  from public.users_permissions up
  join public.permissions p on p.id = up.permission_id
  where up.user_id = uid;
$$;


ALTER FUNCTION "public"."get_user_permissions"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_visible_watch_configs"("p_user_id" "uuid", "p_service_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("config_id" integer, "config_name" "text", "config_topic" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_service_id UUID;
BEGIN
    -- Guard: p_user_id must match caller
    IF p_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: p_user_id must match auth.uid()';
    END IF;

    v_is_admin := public.veille_user_is_admin(p_user_id);

    IF p_service_id IS NOT NULL THEN
        IF NOT v_is_admin AND p_service_id IS DISTINCT FROM public.veille_user_service_id(p_user_id) THEN
            RAISE EXCEPTION 'Unauthorized: cannot override service_id';
        END IF;
        v_service_id := p_service_id;
    ELSE
        v_service_id := public.veille_user_service_id(p_user_id);
    END IF;

    RETURN QUERY
    SELECT wc.id, wc.name, wc.topic
    FROM public.watch_config wc
    WHERE
        (v_is_admin)
        OR
        (
            NOT v_is_admin
            AND wc.active = true
            AND (
                wc.service_ids IS NULL
                OR wc.service_ids = '{}'
                OR v_service_id = ANY(wc.service_ids)
            )
        )
    ORDER BY wc.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_visible_watch_configs"("p_user_id" "uuid", "p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_visible_watch_reports"("p_service_id" "uuid") RETURNS TABLE("id" "uuid", "created_at" timestamp with time zone, "period_start" "date", "period_end" "date", "topic" "text", "frequency" "text", "source_model" "text", "analysis_model" "text", "raw_research" "text", "executive_summary" "text", "risks" "text", "opportunities" "text", "recommended_actions" "text", "importance_score" integer, "tags" "text"[], "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Guard: caller must be admin OR be in the service they're querying
    IF NOT public.veille_user_is_admin(auth.uid())
       AND public.veille_user_service_id(auth.uid()) IS DISTINCT FROM p_service_id THEN
        RAISE EXCEPTION 'Unauthorized: cannot query reports for a service you do not belong to';
    END IF;

    RETURN QUERY
    SELECT
        awr.id,
        awr.created_at,
        awr.period_start,
        awr.period_end,
        awr.topic,
        awr.frequency,
        awr.source_model,
        awr.analysis_model,
        awr.raw_research,
        awr.executive_summary,
        awr.risks,
        awr.opportunities,
        awr.recommended_actions,
        awr.importance_score,
        awr.tags,
        awr.metadata
    FROM public.ai_watch_reports awr
    WHERE EXISTS (
        SELECT 1
        FROM public.watch_config wc
        WHERE wc.topic = awr.topic
          AND wc.active = true
          AND (
              wc.service_ids IS NULL
              OR wc.service_ids = '{}'
              OR p_service_id = ANY(wc.service_ids)
          )
    )
    ORDER BY awr.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_visible_watch_reports"("p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_visible_watch_reports"("p_user_id" "uuid", "p_service_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("report_id" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_service_id UUID;
BEGIN
    -- Guard: p_user_id must match caller
    IF p_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Unauthorized: p_user_id must match auth.uid()';
    END IF;

    v_is_admin := public.veille_user_is_admin(p_user_id);

    IF p_service_id IS NOT NULL THEN
        -- Non-admins cannot override their own service
        IF NOT v_is_admin AND p_service_id IS DISTINCT FROM public.veille_user_service_id(p_user_id) THEN
            RAISE EXCEPTION 'Unauthorized: cannot override service_id';
        END IF;
        v_service_id := p_service_id;
    ELSE
        v_service_id := public.veille_user_service_id(p_user_id);
    END IF;

    RETURN QUERY
    SELECT DISTINCT awr.id::TEXT
    FROM public.ai_watch_reports awr
    WHERE
        (v_is_admin)
        OR
        (
            NOT v_is_admin
            AND EXISTS (
                SELECT 1
                FROM public.watch_config wc
                WHERE wc.topic = awr.topic
                  AND wc.active = true
                  AND (
                      wc.service_ids IS NULL
                      OR wc.service_ids = '{}'
                      OR v_service_id = ANY(wc.service_ids)
                  )
            )
        );
END;
$$;


ALTER FUNCTION "public"."get_visible_watch_reports"("p_user_id" "uuid", "p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'Employé')
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handpick_emplacement_path"("p_emplacement_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    WITH RECURSIVE chain AS (
        SELECT z.id, z.parent_id, z.code, 1 AS depth
        FROM public.emplacements_handpick e
        JOIN public.zones_handpick z ON z.id = e.zone_id
        WHERE e.id = p_emplacement_id
        UNION ALL
        SELECT z.id, z.parent_id, z.code, c.depth + 1
        FROM public.zones_handpick z
        JOIN chain c ON z.id = c.parent_id
        WHERE c.depth < 32 -- garde-fou contre un cycle résiduel
    )
    SELECT concat_ws(
        ' · ',
        (SELECT string_agg(code, ' · ' ORDER BY depth DESC) FROM chain),
        (SELECT code FROM public.emplacements_handpick WHERE id = p_emplacement_id)
    )
    WHERE p_emplacement_id IS NOT NULL;
$$;


ALTER FUNCTION "public"."handpick_emplacement_path"("p_emplacement_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handpick_log_description"("entity_type" "text", "action" "text", "label" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."handpick_log_description"("entity_type" "text", "action" "text", "label" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handpick_log_snapshot"("record" "jsonb") RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
    SELECT jsonb_object_agg(e.key, e.value)
    FROM jsonb_each(record - ARRAY['id', 'created_at', 'updated_at', 'created_by']) AS e
    WHERE e.value <> 'null'::jsonb
$$;


ALTER FUNCTION "public"."handpick_log_snapshot"("record" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handpick_log_snapshot"("record" "jsonb") IS 'Instantané lisible d''une ligne : colonnes techniques et valeurs nulles retirées. Sert de `changes` sur une création ou une suppression, là où un UPDATE stocke un diff.';



CREATE OR REPLACE FUNCTION "public"."has_permission"("permission_code" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT public.user_has_permission((select auth.uid()), permission_code);
$$;


ALTER FUNCTION "public"."has_permission"("permission_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."jsonb_diff"("old_row" "jsonb", "new_row" "jsonb", "exclude_keys" "text"[] DEFAULT ARRAY['id'::"text", 'created_at'::"text", 'updated_at'::"text"]) RETURNS "jsonb"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
    SELECT COALESCE(
        (SELECT jsonb_object_agg(k, jsonb_build_object('before', old_row->k, 'after', new_row->k))
         FROM   jsonb_object_keys(old_row - exclude_keys) AS k
         WHERE  old_row->k IS DISTINCT FROM new_row->k),
        '{}'::JSONB
    )
$$;


ALTER FUNCTION "public"."jsonb_diff"("old_row" "jsonb", "new_row" "jsonb", "exclude_keys" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leads_client_crm_sync"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  matched_client uuid;
  previous_message text;
  formatted_message text;
  history_entry text;
BEGIN
  formatted_message := concat_ws(
    ' | ',
    NEW.message,
    'Budget: ' || COALESCE(NEW.budget::text, ''),
    'Arrivance: ' || COALESCE(NEW.arrivance, ''),
    'Type: ' || COALESCE(NEW.activity, '')
  );

  history_entry := concat('[', to_char(now(), 'YYYY-MM-DD HH24:MI:SS'), '] ', formatted_message);

  SELECT id, message
  INTO matched_client, previous_message
  FROM public.client_crm
  WHERE mail = NEW.email
  LIMIT 1;

  IF matched_client IS NOT NULL THEN
    UPDATE public.client_crm
    SET
      nom = NEW.name,
      telephone = NEW.phone,
      localisation = NEW.location,
      message = concat_ws(
        E'\n',
        NULLIF(previous_message, ''),
        history_entry
      ),
      updated_at = now(),
      collum = 0
    WHERE id = matched_client;
  ELSE
    INSERT INTO public.client_crm (
      nom, mail, telephone, localisation, message, updated_at, collum
    ) VALUES (
      NEW.name,
      NEW.email,
      NEW.phone,
      NEW.location,
      history_entry,
      now(),
      0
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."leads_client_crm_sync"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."livraison_boutique_coherence"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."livraison_boutique_coherence"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."livraison_boutique_notify"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."livraison_boutique_notify"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."livraison_modifiable"("p_livraison_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.livraisons_boutique
        WHERE id = p_livraison_id AND statut IN ('planifiee', 'preparation')
    )
$$;


ALTER FUNCTION "public"."livraison_modifiable"("p_livraison_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."livraison_refresh_commande"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."livraison_refresh_commande"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_arrivage_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
DECLARE
    v_service_id UUID;
    v_label      TEXT;
    v_desc       TEXT;
    v_action     TEXT;
    v_url        TEXT;
BEGIN
    SELECT service_id INTO v_service_id
    FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

    IF TG_OP = 'INSERT' THEN
        v_label  := NEW.container_no;
        v_desc   := 'Arrivage créé : ' || NEW.container_no;
        v_action := 'create';
        v_url    := '/stock/arrivage/' || NEW.id;

        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'arrivage', NEW.id::TEXT, v_label, v_action, v_desc,
                jsonb_build_object(
                    'status',         NEW.status,
                    'transport_mode', NEW.transport_mode,
                    'fournisseur_id', NEW.fournisseur_id,
                    'departure_date', NEW.departure_date
                ));

    ELSIF TG_OP = 'UPDATE' THEN
        v_label  := NEW.container_no;
        v_action := 'update';
        v_url    := '/stock/arrivage/' || NEW.id;
        v_desc   := CASE
            WHEN OLD.status IS DISTINCT FROM NEW.status
            THEN 'Statut modifié : ' || NEW.container_no
                 || ' (' || COALESCE(OLD.status, '?') || ' → ' || NEW.status || ')'
            ELSE 'Arrivage mis à jour : ' || NEW.container_no
        END;

        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'arrivage', NEW.id::TEXT, v_label, v_action, v_desc,
                public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW)));

    ELSIF TG_OP = 'DELETE' THEN
        v_label  := OLD.container_no;
        v_action := 'delete';
        -- La ligne n'existe plus : pointer vers la liste, pas vers un id mort.
        v_url    := '/stock/arrivage';
        v_desc   := 'Arrivage supprimé : ' || OLD.container_no;

        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'arrivage', OLD.id::TEXT, v_label, v_action, v_desc,
                jsonb_build_object(
                    'container_no',   OLD.container_no,
                    'status',         OLD.status,
                    'transport_mode', OLD.transport_mode,
                    'fournisseur_id', OLD.fournisseur_id,
                    'departure_date', OLD.departure_date
                ));
    END IF;

    IF v_service_id IS NOT NULL THEN
        INSERT INTO public.notification(user_id, type, title, url)
        VALUES (v_service_id, 'system', v_desc, v_url);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."log_arrivage_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_balle_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'balle', NEW.id::TEXT, NEW.bin, 'create',
                'Balle créée : ' || NEW.bin,
                jsonb_build_object(
                    'bin',      NEW.bin,
                    'status',   NEW.status,
                    'location', NEW.location,
                    'packing',  NEW.packing
                ));

    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'balle', NEW.id::TEXT, NEW.bin, 'update',
                'Balle mise à jour : ' || NEW.bin,
                public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW)));

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'balle', OLD.id::TEXT, OLD.bin, 'delete',
                'Balle supprimée : ' || OLD.bin,
                jsonb_build_object(
                    'bin',      OLD.bin,
                    'status',   OLD.status,
                    'location', OLD.location,
                    'packing',  OLD.packing
                ));
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."log_balle_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_balle_emplacement_handpick"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_from  UUID := CASE WHEN TG_OP = 'UPDATE' THEN OLD.emplacement_id END;
    v_was_borrowed BOOLEAN := TG_OP = 'UPDATE' AND OLD.borrowed_by IS NOT NULL;
    v_event TEXT;
BEGIN
    IF NOT v_was_borrowed AND NEW.borrowed_by IS NOT NULL THEN
        v_event := 'borrowed';
    ELSIF v_was_borrowed AND NEW.borrowed_by IS NULL THEN
        v_event := 'returned';
    ELSIF v_from IS NOT DISTINCT FROM NEW.emplacement_id THEN
        RETURN NULL; -- rien ne concerne l'emplacement
    ELSIF v_from IS NULL THEN
        v_event := 'placed';
    ELSIF NEW.emplacement_id IS NULL THEN
        v_event := 'removed';
    ELSE
        v_event := 'moved';
    END IF;

    INSERT INTO public.balles_emplacements_handpick (
        balle_id, event,
        emplacement_from_id, emplacement_to_id,
        from_path, to_path,
        user_id
    ) VALUES (
        NEW.id, v_event,
        v_from, NEW.emplacement_id,
        public.handpick_emplacement_path(v_from),
        public.handpick_emplacement_path(NEW.emplacement_id),
        auth.uid()
    );

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."log_balle_emplacement_handpick"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_carton_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."log_carton_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_category_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'category', NEW.id::TEXT, NEW.name, 'create',
                'Catégorie créée : ' || NEW.name,
                jsonb_build_object('name', NEW.name, 'unit_price', NEW.unit_price));

    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.unit_price IS DISTINCT FROM NEW.unit_price THEN
            INSERT INTO public.category_price_history(category_id, category_name, user_id, old_price, new_price)
            VALUES (NEW.id, NEW.name, auth.uid(), OLD.unit_price, NEW.unit_price);
        END IF;

        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'category', NEW.id::TEXT, NEW.name, 'update',
                CASE
                    WHEN OLD.unit_price IS DISTINCT FROM NEW.unit_price
                    THEN 'Prix modifié : ' || NEW.name || ' (' || OLD.unit_price || ' → ' || NEW.unit_price || ' €/kg)'
                    ELSE 'Catégorie mise à jour : ' || NEW.name
                END,
                public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW)));

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'category', OLD.id::TEXT, OLD.name, 'delete',
                'Catégorie supprimée : ' || OLD.name,
                jsonb_build_object('name', OLD.name, 'unit_price', OLD.unit_price));
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."log_category_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_client_crm_changes"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
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


ALTER FUNCTION "public"."log_client_crm_changes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_client_crm_changes"() IS 'Journalise dans Client_activite chaque modification de client_crm (pipeline, fiche) avec le détail ancien → nouveau.';



CREATE OR REPLACE FUNCTION "public"."log_commande_boutique_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."log_commande_boutique_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_delivery_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'delivery', NEW.id::TEXT, NEW.din, 'create',
                'Livraison créée : ' || NEW.din,
                jsonb_build_object('din', NEW.din, 'delivery_type', NEW.delivery_type, 'packing', NEW.packing));

    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'delivery', NEW.id::TEXT, NEW.din, 'update',
                'Livraison mise à jour : ' || NEW.din,
                public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW)));

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'delivery', OLD.id::TEXT, OLD.din, 'delete',
                'Livraison supprimée : ' || OLD.din,
                jsonb_build_object('din', OLD.din, 'delivery_type', OLD.delivery_type, 'packing', OLD.packing));
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."log_delivery_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_fiche_tri_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."log_fiche_tri_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_fournisseur_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'fournisseur', NEW.id::TEXT, NEW.name, 'create',
                'Fournisseur créé : ' || NEW.name,
                jsonb_build_object('name', NEW.name));

    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'fournisseur', NEW.id::TEXT, NEW.name, 'update',
                'Fournisseur mis à jour : ' || NEW.name,
                public.jsonb_diff(to_jsonb(OLD), to_jsonb(NEW)));

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'fournisseur', OLD.id::TEXT, OLD.name, 'delete',
                'Fournisseur supprimé : ' || OLD.name,
                jsonb_build_object('name', OLD.name));
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."log_fournisseur_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_handpick_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."log_handpick_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_handpick_fournisseur_category_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_row         RECORD;
    v_action      TEXT;
    v_fournisseur TEXT;
    v_category    TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_action := 'delete';
        v_row    := OLD;
    ELSE
        v_action := 'create';
        v_row    := NEW;
    END IF;

    SELECT f.name INTO v_fournisseur
    FROM public.fournisseurs_handpick f WHERE f.id = v_row.fournisseur_id;

    SELECT c.name INTO v_category
    FROM public.categories_handpick c WHERE c.id = v_row.category_id;

    INSERT INTO public.activity_log_handpick (
        user_id, entity_type, entity_id, entity_label, action, description, changes
    ) VALUES (
        auth.uid(),
        'fournisseur_category',
        v_row.fournisseur_id::text || ':' || v_row.category_id::text,
        COALESCE(v_fournisseur, '?') || ' → ' || COALESCE(v_category, '?'),
        v_action,
        CASE WHEN v_action = 'create'
             THEN 'Catégorie rattachée au fournisseur'
             ELSE 'Catégorie détachée du fournisseur'
        END,
        NULL
    );

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."log_handpick_fournisseur_category_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_livraison_boutique_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."log_livraison_boutique_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_trieur_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."log_trieur_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."magasin_check_etage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    etage_magasin UUID;
    parent_etage  UUID;
BEGIN
    SELECT e.magasin_id INTO etage_magasin FROM public.etages_magasin e WHERE e.id = NEW.etage_id;
    IF etage_magasin IS NULL THEN
        RAISE EXCEPTION 'Étage introuvable';
    END IF;
    IF etage_magasin <> NEW.magasin_id THEN
        RAISE EXCEPTION 'L''étage appartient à un autre magasin';
    END IF;

    IF TG_TABLE_NAME = 'zones_magasin' THEN
        -- Bloc imbriqué et non `AND` : PL/pgSQL résout NEW.parent_id avant
        -- d'évaluer la condition, et les équipements n'ont pas cette colonne.
        IF NEW.parent_id IS NOT NULL THEN
            SELECT z.etage_id INTO parent_etage FROM public.zones_magasin z WHERE z.id = NEW.parent_id;
            IF parent_etage IS DISTINCT FROM NEW.etage_id THEN
                RAISE EXCEPTION 'La zone parente est sur un autre étage';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."magasin_check_etage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."magasins_create_rdc"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    INSERT INTO public.etages_magasin (magasin_id, nom, niveau, created_by)
    VALUES (NEW.id, 'RDC', 0, NEW.created_by);
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."magasins_create_rdc"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."move_client_column_on_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
DECLARE
    v_new_collum smallint;
BEGIN
    -- RDV en attente (Amelia) : le client reste en « RDV à confirmer ».
    IF NEW.id_client IS NULL OR NOT NEW.confirmed THEN
        RETURN NEW;
    END IF;

    IF NEW.nom ILIKE '%achat%' THEN
        v_new_collum := 4;
    ELSIF NEW.nom ILIKE '%visio%' THEN
        v_new_collum := 5;
    ELSIF NEW.nom ILIKE '%decouverte%' THEN
        v_new_collum := 3;
    ELSE
        RETURN NEW;
    END IF;

    UPDATE public.client_crm
       SET collum = v_new_collum
     WHERE id = NEW.id_client
       AND collum IS DISTINCT FROM v_new_collum
       -- À la confirmation, on ne range le client que s'il est encore en
       -- colonne 9 (bouton « Confirmer »). S'il en est déjà sorti, c'est que
       -- le commercial a confirmé en glissant sa fiche dans le Kanban : la
       -- colonne qu'il a choisie est respectée.
       AND (TG_OP = 'INSERT' OR OLD.confirmed OR collum = 9);

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."move_client_column_on_event"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."move_client_column_on_event"() IS 'AFTER INSERT/UPDATE Event_calendar : range le client dans la colonne Kanban de la nature du RDV (achat → 4, découverte visio → 5, découverte physique → 3), uniquement si le RDV est confirmé. Un RDV Amelia en attente laisse le client en colonne 9.';



CREATE OR REPLACE FUNCTION "public"."normalize_packing_label"("p_label" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."normalize_packing_label"("p_label" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."normalize_packing_label"("p_label" "text") IS 'Clé de regroupement d''un libellé de packing list (normaliseur v2). Le front et le service Go doivent produire la même valeur.';



CREATE OR REPLACE FUNCTION "public"."notify_arrivage_invoice_reminders"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
DECLARE
    r         RECORD;
    v_service RECORD;
    v_title   TEXT;
BEGIN
    FOR r IN
        SELECT id, container_no
        FROM public.arrivage_manuel
        WHERE prev_dechargement_at IS NOT NULL
          AND prev_dechargement_at > NOW()
          AND prev_dechargement_at <= NOW() + INTERVAL '7 days'
          AND invoice_date IS NULL
    LOOP
        v_title := 'Facture manquante J-7 : ' || r.container_no;

        FOR v_service IN
            SELECT DISTINCT pr.service_id
            FROM public.profiles pr
            WHERE pr.service_id IS NOT NULL
              AND public.user_has_permission(pr.user_id, 'stock.arrivage.view')
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM public.notification
                WHERE user_id = v_service.service_id
                  AND title = v_title
                  AND created_at > NOW() - INTERVAL '23 hours'
            ) THEN
                INSERT INTO public.notification(user_id, type, title, url)
                VALUES (v_service.service_id, 'system', v_title, '/stock/arrivage/' || r.id);
            END IF;
        END LOOP;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."notify_arrivage_invoice_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_commandes"("p_permission" "text", "p_title" "text", "p_url" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."notify_commandes"("p_permission" "text", "p_title" "text", "p_url" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_crm_new_lead"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_title TEXT;
    v_uid   TEXT;
    v_ids   TEXT[] := ARRAY[
        '8f93efc7-a3fb-496b-a397-781ae3fc41cf',
        'f2166860-c501-4c35-926c-fc8fb097eff5',
        '921e5a2d-1447-4f4c-b893-2f935a996973',
        '998e6ec9-1a2b-4c84-ac36-e0deedb43f52',
        '2c2312cb-1cf3-4c6a-a4c6-c0a363eb9ade',
        '77f6427e-3658-47e7-80ce-d40eb31a5d8e'
    ];
BEGIN
    v_title := 'Nouveau lead : ' || COALESCE(NULLIF(NEW.nom, ''), NEW.mail, 'sans nom');

    FOREACH v_uid IN ARRAY v_ids LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.notification n
            WHERE n.user_id = v_uid::uuid
              AND n.title = v_title
              AND n.created_at > NOW() - INTERVAL '24 hours'
        ) THEN
            INSERT INTO public.notification (user_id, type, title, url)
            VALUES (v_uid::uuid, 'system', v_title, '/crm/clients');
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_crm_new_lead"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_crm_rdv_reminders"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    r       RECORD;
    v_user  UUID;
    v_title TEXT;
BEGIN
    FOR r IN
        SELECT id, nom, debut, customer, creator_id
        FROM public."Event_calendar"
        WHERE debut IS NOT NULL
          AND debut > NOW()
          AND debut <= NOW() + INTERVAL '60 minutes'
          AND COALESCE(show, true) = true
    LOOP
        v_user := COALESCE(r.customer, r.creator_id);
        IF v_user IS NULL THEN CONTINUE; END IF;

        v_title := 'RDV dans 1h : ' || COALESCE(NULLIF(r.nom, ''), 'Rendez-vous')
                   || ' (' || to_char(r.debut AT TIME ZONE 'Europe/Paris', 'HH24:MI') || ')';

        -- Dédup : un seul rappel par RDV (fenêtre = autour de l'heure de début).
        IF NOT EXISTS (
            SELECT 1 FROM public.notification
            WHERE user_id = v_user
              AND title = v_title
              AND created_at > NOW() - INTERVAL '90 minutes'
        ) THEN
            INSERT INTO public.notification(user_id, type, title, url)
            VALUES (v_user, 'system', v_title, '/crm/agenda/days');
        END IF;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."notify_crm_rdv_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_crm_task_assigned"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_title TEXT;
BEGIN
    -- Pas de notif si la tâche n'est pas assignée, si le créateur se
    -- l'attribue à lui-même, ou si le créateur n'est pas admin.
    IF NEW.owner IS NULL
       OR NEW.owner = auth.uid()
       OR NOT public.user_is_global_admin(auth.uid())
    THEN
        RETURN NEW;
    END IF;

    v_title := 'Nouvelle tâche assignée : '
               || COALESCE(NULLIF(NEW.content, ''), NULLIF(NEW.type, ''), 'tâche');

    INSERT INTO public.notification (user_id, type, title, url)
    VALUES (NEW.owner, 'system', v_title, '/crm?tab=Tache');

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_crm_task_assigned"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_crm_task_reminders"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    r       RECORD;
    v_title TEXT;
BEGIN
    FOR r IN
        SELECT t.id, t.owner, t.date, t.type, t.content,
               (t.date::date < CURRENT_DATE) AS is_overdue
        FROM public."Tache_crm" t
        WHERE t.owner IS NOT NULL
          AND t.date IS NOT NULL
          AND t.valide IS NOT TRUE
          AND t.date::date <= CURRENT_DATE
    LOOP
        v_title := CASE WHEN r.is_overdue THEN 'Tâche en retard : ' ELSE 'Tâche aujourd''hui : ' END
                   || COALESCE(NULLIF(r.content, ''), NULLIF(r.type, ''), 'tâche');

        IF NOT EXISTS (
            SELECT 1 FROM public.notification
            WHERE user_id = r.owner
              AND title = v_title
              AND created_at > NOW() - INTERVAL '23 hours'
        ) THEN
            INSERT INTO public.notification(user_id, type, title, url)
            VALUES (r.owner, 'system', v_title, '/crm/tache');
        END IF;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."notify_crm_task_reminders"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_cryptedmessage"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
    v_name   text;
    v_avatar text;
begin
    if new.recipient_id is null or new.sender_id = new.recipient_id then
        return new;
    end if;

    -- Expéditeur : nom + avatar (cryptedmessage.sender_id = profiles.user_id).
    -- security definer → accès profiles garanti malgré la RLS.
    select coalesce(nullif(p.full_name, ''), 'Nouveau message'), p.avatar_url
      into v_name, v_avatar
      from public.profiles p
     where p.user_id = new.sender_id;

    insert into public.notification (user_id, title, type, url, icon, read, created_at)
    values (
        new.recipient_id,
        coalesce(v_name, 'Nouveau message'),
        'message',
        -- Deep-link : ouvre directement la conversation avec l'expéditeur.
        '/messages?user=' || new.sender_id::text,
        v_avatar,
        false,
        now()
    );

    return new;
end;
$$;


ALTER FUNCTION "public"."notify_cryptedmessage"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_newsletter_api_error"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    -- Fenêtre de regroupement : une même erreur répétée ne produit qu'une
    -- alerte. Une panne en rafale (des dizaines de lignes en quelques
    -- secondes) ne doit pas remplir la cloche.
    c_window   CONSTANT interval := INTERVAL '15 minutes';
    c_perm     CONSTANT text     := 'stock.arrivage.newsletter.admin';
    v_title    text;
BEGIN
    -- Le titre est la clé de déduplication : il doit être stable pour une même
    -- erreur, donc sans identifiant variable (req_id, timestamp, uuid).
    -- Le préfixe « Newsletter : » n'est pas cosmétique — NotificationCenter
    -- scinde le titre sur le premier « : » pour composer un libellé en gras
    -- suivi d'un détail (extractNotificationDetails).
    v_title := 'Newsletter : ' || left(NEW.msg, 120);

    -- Insertion ensembliste plutôt qu'une boucle avec un NOT EXISTS par
    -- destinataire : le trigger s'exécute dans la transaction d'écriture du lot
    -- de logs, et une rafale d'erreurs ne doit pas la ralentir. Une seule
    -- requête, un seul parcours de l'index de déduplication.
    INSERT INTO public.notification (user_id, type, title, url)
    SELECT u.user_id, 'system', v_title, '/arrivage-admin/logs'
    FROM public.users_with_permission(c_perm) u
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.notification n
        WHERE n.user_id = u.user_id
          AND n.title = v_title
          AND n.created_at > now() - c_window
    );

    -- Trigger AFTER : la valeur de retour est ignorée.
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."notify_newsletter_api_error"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_newsletter_api_error"() IS 'Notifie les détenteurs de stock.arrivage.newsletter.admin sur une ligne ERROR du service newsletter, dédupliquée par titre sur 15 minutes.';



CREATE OR REPLACE FUNCTION "public"."notify_newsletter_webhook_silence"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    -- Laisse passer une fenêtre de debounce complète (20 min) plus la marge
    -- d'une rafale d'éditions qui la repousse.
    c_grace  CONSTANT interval := INTERVAL '45 minutes';
    -- Au-delà, on considère que l'incident est connu : inutile de remonter
    -- éternellement une modification vieille de plusieurs jours.
    c_window CONSTANT interval := INTERVAL '24 hours';
    -- Une alerte par demi-journée tant que la panne dure.
    c_dedup  CONSTANT interval := INTERVAL '12 hours';
    c_perm   CONSTANT text     := 'stock.arrivage.newsletter.admin';

    v_last_edit timestamptz;
    v_title     text;
BEGIN
    -- Dernière modification suffisamment ancienne pour qu'un envoi ait dû
    -- partir.
    SELECT max(a.updated_at) INTO v_last_edit
    FROM public.arrivage_manuel a
    WHERE a.updated_at >= now() - c_window
      AND a.updated_at <= now() - c_grace;

    IF v_last_edit IS NULL THEN
        RETURN;
    END IF;

    -- Un run déclenché par le webhook après cette modification : la chaîne
    -- fonctionne, quel qu'ait été son résultat (un run en échec relève de
    -- l'alerte ERROR, pas de celle-ci).
    IF EXISTS (
        SELECT 1
        FROM public.newsletter_send_runs r
        WHERE r.trigger = 'webhook'
          AND r.started_at >= v_last_edit
    ) THEN
        RETURN;
    END IF;

    -- Titre stable = clé de déduplication. Le préfixe « Newsletter : » n'est
    -- pas cosmétique : NotificationCenter scinde sur le premier « : » pour
    -- composer un libellé en gras suivi du détail.
    v_title := 'Newsletter : tableau modifié mais aucun envoi automatique déclenché';

    INSERT INTO public.notification (user_id, type, title, url)
    SELECT u.user_id, 'system', v_title, '/arrivage-admin/logs'
    FROM public.users_with_permission(c_perm) u
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.notification n
        WHERE n.user_id = u.user_id
          AND n.title = v_title
          AND n.created_at > now() - c_dedup
    );
END;
$$;


ALTER FUNCTION "public"."notify_newsletter_webhook_silence"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."notify_newsletter_webhook_silence"() IS 'Alerte les détenteurs de stock.arrivage.newsletter.admin quand arrivage_manuel a été modifiée sans qu''aucun run newsletter déclenché par webhook ne suive. Détecte la rupture silencieuse du Database Webhook.';



CREATE OR REPLACE FUNCTION "public"."packing_label_feedback_on_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."packing_label_feedback_on_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."packing_label_feedback_record"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."packing_label_feedback_record"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."packing_list_ligne_set_reviewer"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."packing_list_ligne_set_reviewer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."palette_numerotation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF NEW.numero IS NULL THEN
        SELECT COALESCE(MAX(numero), 0) + 1 INTO NEW.numero
        FROM public.palettes WHERE livraison_id = NEW.livraison_id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."palette_numerotation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pg_net_health"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    c_perm CONSTANT text := 'stock.arrivage.newsletter.admin';
    v_count bigint;
    v_min   bigint;
    v_state public.pg_net_watchdog_state%ROWTYPE;
BEGIN
    IF NOT public.has_permission(c_perm) THEN
        RAISE EXCEPTION 'Permission % requise.', c_perm
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'net'
    ) THEN
        RETURN jsonb_build_object('available', false);
    END IF;

    SELECT count(*), min(q.id) INTO v_count, v_min
      FROM net.http_request_queue q;

    SELECT * INTO v_state FROM public.pg_net_watchdog_state WHERE id;

    RETURN jsonb_build_object(
        'available',   true,
        'queue_depth', v_count,
        'oldest_id',   v_min,
        -- Vrai dès que la file stagne au-delà de la grâce du watchdog : le
        -- dashboard n'attend pas le prochain passage du cron pour le dire.
        'stalled',     v_count > 0
                       AND v_state.last_min_id IS NOT DISTINCT FROM v_min
                       AND now() - v_state.last_progress_at > INTERVAL '5 minutes',
        -- Le watchdog a renoncé à relancer : les lignes restantes sont des
        -- orphelines, pas une file en attente. Seule une purge les enlèvera.
        'orphaned',    COALESCE(v_state.stall_streak, 0) > 3,
        'stalled_since',   v_state.last_progress_at,
        'last_restart_at', v_state.last_restart_at,
        'restart_count',   v_state.restart_count
    );
END;
$$;


ALTER FUNCTION "public"."pg_net_health"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."pg_net_health"() IS 'Lecture seule de l''état de la file pg_net pour le dashboard /arrivage-admin. Ne répare rien.';



CREATE OR REPLACE FUNCTION "public"."pg_net_watchdog"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    -- Durée pendant laquelle min(id) doit rester figé avant qu'on conclue à
    -- un arrêt. Large devant le timeout d'une requête, courte devant la durée
    -- d'un incident (la panne du 26/08 a duré des heures).
    c_grace   CONSTANT interval := INTERVAL '5 minutes';
    -- Une panne qui dure ne doit pas produire une notification par passage.
    c_dedup   CONSTANT interval := INTERVAL '1 hour';
    c_perm_ops   CONSTANT text := 'manager.console';
    c_perm_news  CONSTANT text := 'stock.arrivage.newsletter.admin';

    v_min_id    bigint;
    v_count     bigint;
    v_state     public.pg_net_watchdog_state%ROWTYPE;
    -- Au-delà de ce nombre de relances infructueuses sur le MÊME min(id), on
    -- cesse de relancer : la cause n'est pas un worker à réveiller.
    c_max_tries CONSTANT integer := 3;

    v_restarted boolean := false;
    v_error     text    := NULL;
    v_title     text;
    v_streak    integer;
    v_giveup    boolean := false;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'net'
    ) THEN
        RETURN jsonb_build_object('state', 'pg_net_absent');
    END IF;

    SELECT count(*), min(q.id)
      INTO v_count, v_min_id
      FROM net.http_request_queue q;

    SELECT * INTO v_state FROM public.pg_net_watchdog_state WHERE id;

    -- File vide : le worker a tout dépilé, c'est le cas nominal.
    IF v_count = 0 THEN
        UPDATE public.pg_net_watchdog_state
           SET last_min_id = NULL, last_progress_at = now(), stall_streak = 0
         WHERE id;
        RETURN jsonb_build_object('state', 'idle', 'queue_depth', 0);
    END IF;

    -- min(id) a bougé depuis le dernier passage : le worker travaille. Une
    -- file profonde n'est pas en soi une anomalie — une rafale légitime
    -- (import, envoi groupé) en crée une qui se résorbe.
    IF v_state.last_min_id IS DISTINCT FROM v_min_id THEN
        UPDATE public.pg_net_watchdog_state
           SET last_min_id = v_min_id, last_progress_at = now(), stall_streak = 0
         WHERE id;
        RETURN jsonb_build_object(
            'state', 'draining',
            'queue_depth', v_count,
            'oldest_id', v_min_id
        );
    END IF;

    -- Figé, mais pas encore assez longtemps pour conclure.
    IF now() - v_state.last_progress_at <= c_grace THEN
        RETURN jsonb_build_object(
            'state', 'watching',
            'queue_depth', v_count,
            'oldest_id', v_min_id,
            'stalled_for_s',
                EXTRACT(epoch FROM now() - v_state.last_progress_at)::int
        );
    END IF;

    -- ── Arrêt confirmé ─────────────────────────────────────────────────────
    -- Deux situations très différentes se cachent derrière « le worker ne
    -- dépile plus », et une seule est réparable d'ici :
    --
    --   a) le worker tourne mais s'est mis en défaut → worker_restart() le
    --      relance, c'est réglé sans intervention ;
    --   b) le processus a CRASHÉ et n'existe plus (journal Postgres :
    --      « background worker "pg_net … worker" exited with exit code 1 »)
    --      → worker_restart() envoie un signal à un processus disparu : elle
    --      n'échoue pas, elle ne fait simplement rien. Seul un redémarrage de
    --      l'instance réenregistre un background worker.
    --
    -- Constaté le 27/08 : c'était le cas (b), et plusieurs worker_restart()
    -- successifs n'ont rien changé. D'où la vérification APRÈS coup — sans
    -- elle, le watchdog notifierait « worker relancé » à chaque passage sur
    -- une panne qu'il n'a pas corrigée, ce qui est pire que de se taire.
    -- ── Série d'échecs ─────────────────────────────────────────────────────
    -- Un min(id) figé ne veut pas toujours dire « worker endormi ». Observé le
    -- 27/08 : le worker crashait et redémarrait tout seul (des requêtes plus
    -- récentes passaient en 200 pendant que les anciennes restaient), et les
    -- 295 lignes bloquées étaient des ORPHELINES — en vol au moment d'un
    -- crash, jamais reprises. Une file orpheline ne se résorbera jamais : sans
    -- ce garde-fou, le watchdog relancerait le worker et notifierait en boucle,
    -- pour toujours, sur un incident déjà terminé.
    --
    -- Trois tentatives suffisent à trancher : si le worker était simplement
    -- endormi, la première l'aura réveillé.
    v_streak := COALESCE(v_state.stall_streak, 0) + 1;
    v_giveup := v_streak > c_max_tries;

    IF NOT v_giveup THEN
        BEGIN
            PERFORM net.worker_restart();
            v_restarted := true;
        EXCEPTION WHEN OTHERS THEN
            v_error := SQLERRM;
        END;
    END IF;

    -- check_worker_is_up() lève une exception si le worker est absent
    -- (pg_net >= 0.10 environ). Son absence ne doit pas faire échouer le
    -- watchdog : on retombe alors sur le résultat brut de worker_restart().
    IF v_restarted THEN
        BEGIN
            PERFORM net.check_worker_is_up();
        EXCEPTION
            WHEN undefined_function THEN
                NULL; -- version trop ancienne : rien à conclure
            WHEN OTHERS THEN
                v_restarted := false;
                v_error := 'worker toujours absent après restart : ' || SQLERRM;
        END;
    END IF;

    -- last_progress_at est repoussé même en cas d'échec du restart : sinon le
    -- watchdog retenterait à chaque passage du cron au lieu d'attendre une
    -- nouvelle fenêtre de grâce.
    UPDATE public.pg_net_watchdog_state
       SET last_progress_at = now(),
           stall_streak     = v_streak,
           last_restart_at  = CASE WHEN v_restarted THEN now()
                                   ELSE last_restart_at END,
           restart_count    = restart_count + CASE WHEN v_restarted THEN 1
                                                   ELSE 0 END
     WHERE id;

    -- Le titre est la clé de déduplication : stable, sans compteur ni
    -- horodatage. Le préfixe avant « : » n'est pas cosmétique — le
    -- NotificationCenter scinde dessus pour composer un libellé en gras suivi
    -- d'un détail (extractNotificationDetails).
    v_title := CASE
        -- Relances épuisées : ce ne sont pas des requêtes en attente, ce sont
        -- des orphelines qu'aucun worker ne reprendra. Il faut purger.
        WHEN v_giveup
            THEN 'Infrastructure : file pg_net bloquée durablement, purge manuelle requise'
        WHEN v_restarted
            THEN 'Infrastructure : file pg_net bloquée, worker relancé automatiquement'
        -- Le worker ne répond même plus au signal : processus disparu.
        ELSE 'Infrastructure : worker pg_net arrêté, redémarrage de l''instance requis'
    END;

    -- Deux audiences, deux destinations. Les exploitants d'abord : la panne
    -- est technique et globale. Le second INSERT voit les lignes du premier
    -- (même transaction), donc quelqu'un qui détient les deux permissions
    -- n'est notifié qu'une fois.
    INSERT INTO public.notification (user_id, type, title, url)
    SELECT u.user_id, 'system', v_title, '/error-console'
    FROM public.users_with_permission(c_perm_ops) u
    WHERE NOT EXISTS (
        SELECT 1 FROM public.notification n
        WHERE n.user_id = u.user_id
          AND n.title = v_title
          AND n.created_at > now() - c_dedup
    );

    INSERT INTO public.notification (user_id, type, title, url)
    SELECT u.user_id, 'system', v_title, '/arrivage-admin'
    FROM public.users_with_permission(c_perm_news) u
    WHERE NOT EXISTS (
        SELECT 1 FROM public.notification n
        WHERE n.user_id = u.user_id
          AND n.title = v_title
          AND n.created_at > now() - c_dedup
    );

    RETURN jsonb_build_object(
        'state', CASE WHEN v_giveup THEN 'orphaned' ELSE 'stalled' END,
        'queue_depth', v_count,
        'oldest_id', v_min_id,
        'stall_streak', v_streak,
        'restarted', v_restarted,
        'error', v_error
    );
END;
$$;


ALTER FUNCTION "public"."pg_net_watchdog"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."pg_net_watchdog"() IS 'Détecte une file pg_net qui n''avance plus (min(id) figé au-delà de 5 min sur une file non vide), relance le worker et notifie manager.console et stock.arrivage.newsletter.admin. Appelé par le cron pg-net-watchdog.';



CREATE OR REPLACE FUNCTION "public"."plan_layout_handpick_stamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."plan_layout_handpick_stamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."post_rdv_mail"("p_event_id" "uuid", "p_motif" "text" DEFAULT 'confirmation'::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_event        record;
    v_client_mail  text;
    v_client_brief jsonb;
    v_lang         text := 'fr';
    v_payload      jsonb;
BEGIN
    SELECT id, nom, debut, client, customer, creator_id, id_client, confirmed
      INTO v_event
      FROM public."Event_calendar"
     WHERE id = p_event_id;

    -- RDV supprimé entre la mise en file et l'envoi.
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF NOT v_event.confirmed OR v_event.nom IS NOT DISTINCT FROM 'Non Disponible' THEN
        RETURN false;
    END IF;

    SELECT mail, brief INTO v_client_mail, v_client_brief
      FROM public.client_crm
     WHERE id = v_event.id_client;

    IF v_client_mail IS NULL OR length(v_client_mail) = 0 THEN
        RETURN false;
    END IF;

    -- Brief doublement encodé : le CRM (use_client.tsx) envoyait
    -- JSON.stringify(brief) dans cette colonne jsonb, qui stocke alors une
    -- CHAÎNE contenant le JSON — ->>'language' y renvoie NULL. On la décode
    -- une fois, comme detectLangue côté Go. Contenu invalide → NULL → 'fr' :
    -- la langue du mail ne doit jamais faire échouer la confirmation du RDV.
    IF jsonb_typeof(v_client_brief) = 'string' THEN
        BEGIN
            v_client_brief := (v_client_brief #>> '{}')::jsonb;
        EXCEPTION WHEN others THEN
            v_client_brief := NULL;
        END;
    END IF;

    -- Langue déduite du brief ("EN" côté fiche CRM et bridge Amelia).
    IF lower(COALESCE(NULLIF(v_client_brief->>'language', ''),
                      v_client_brief->>'langue', '')) LIKE 'en%' THEN
        v_lang := 'en';
    END IF;

    v_payload := jsonb_build_object(
        'client_email', v_client_mail,
        'client_nom',   COALESCE(v_event.client, 'Client'),
        'date_rdv',     to_char(v_event.debut AT TIME ZONE 'Europe/Paris', 'DD/MM/YYYY'),
        'heure_rdv',    to_char(v_event.debut AT TIME ZONE 'Europe/Paris', 'HH24"h"MI'),
        'owner',        COALESCE(v_event.customer, v_event.creator_id),
        'langue',       v_lang,
        'type_rdv',     COALESCE(v_event.nom, 'autre'),
        'motif',        p_motif
    );

    PERFORM net.http_post(
        url     := 'https://info.nokk-project.example/no_repleid_rdv',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := v_payload
    );

    RETURN true;
END;
$$;


ALTER FUNCTION "public"."post_rdv_mail"("p_event_id" "uuid", "p_motif" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."post_rdv_mail"("p_event_id" "uuid", "p_motif" "text") IS 'Construit et poste le mail de RDV vers l''API Go (/no_repleid_rdv) à partir de l''état COURANT de l''événement. p_motif = ''confirmation'' (défaut) ou ''reprogrammation'', qui sélectionne le template côté Go. Seul point du schéma qui connaît l''URL et la forme du payload. Retourne false si l''événement a disparu, n''est pas confirmé, est une indisponibilité, ou si le client n''a pas d''email.';



CREATE OR REPLACE FUNCTION "public"."project_owner_service_slug"("team_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.service_slug(s.nom)
  from public.project_teams t
  left join public.profiles owner on owner.user_id = t.owner_id
  left join public.services s on s.id = owner.service_id
  where t.id = team_id;
$$;


ALTER FUNCTION "public"."project_owner_service_slug"("team_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_old_app_logs"("p_mode" "text" DEFAULT 'automatic'::"text", "p_months" integer DEFAULT NULL::integer, "p_tables" "text"[] DEFAULT NULL::"text"[]) RETURNS SETOF "public"."app_logs_retention_audit"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
    cfg      RECORD;
    v_months INTEGER;
    v_cutoff TIMESTAMPTZ;
    v_count  INTEGER;
    v_oldest TIMESTAMPTZ;
    v_newest TIMESTAMPTZ;
    v_mode   TEXT := CASE WHEN p_mode = 'manual' THEN 'manual' ELSE 'automatic' END;
    v_audit  public.app_logs_retention_audit;
BEGIN
    -- Garde-fou : en contexte requête (auth.uid() non NULL), réservé aux admins.
    -- Le cron tourne sans JWT (auth.uid() = NULL) et passe donc le garde-fou.
    IF auth.uid() IS NOT NULL
        AND NOT public.user_is_global_admin()
        AND NOT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE (id = auth.uid() OR user_id = auth.uid())
              AND role = 'Super Admin'
        )
    THEN
        RAISE EXCEPTION 'insufficient_privilege: purge réservée aux administrateurs';
    END IF;

    FOR cfg IN
        SELECT table_name, date_column, retention_months, extra_filter
        FROM public.app_logs_retention_config
        WHERE enabled
          AND (p_tables IS NULL OR table_name = ANY(p_tables))
    LOOP
        v_months := GREATEST(COALESCE(p_months, cfg.retention_months), 0);
        v_cutoff := now() - make_interval(months => v_months);

        -- DELETE dynamique : identifiants échappés par %I ; filtre optionnel
        -- (extra_filter) ajouté tel quel (config admin uniquement).
        EXECUTE format(
            'WITH d AS (DELETE FROM public.%I WHERE %I < $1 %s RETURNING %I AS ts)
             SELECT count(*), min(ts), max(ts) FROM d',
            cfg.table_name,
            cfg.date_column,
            CASE
                WHEN cfg.extra_filter IS NOT NULL
                     AND length(btrim(cfg.extra_filter)) > 0
                THEN 'AND (' || cfg.extra_filter || ')'
                ELSE ''
            END,
            cfg.date_column
        )
        INTO v_count, v_oldest, v_newest
        USING v_cutoff;

        IF v_count > 0 THEN
            INSERT INTO public.app_logs_retention_audit
                (table_name, cutoff_at, deleted_count, oldest_deleted_at,
                 newest_deleted_at, mode, triggered_by)
            VALUES
                (cfg.table_name, v_cutoff, v_count, v_oldest, v_newest,
                 v_mode, auth.uid())
            RETURNING * INTO v_audit;
            RETURN NEXT v_audit;
        END IF;
    END LOOP;

    RETURN;
END;
$_$;


ALTER FUNCTION "public"."purge_old_app_logs"("p_mode" "text", "p_months" integer, "p_tables" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."queue_rdv_reschedule_mail"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Seul un déplacement réel compte : un UPDATE qui réécrit debut/fin à
    -- l'identique (sauvegarde de formulaire sans changement d'heure) ne doit
    -- pas notifier.
    IF NEW.debut IS NOT DISTINCT FROM OLD.debut
       AND NEW.fin IS NOT DISTINCT FROM OLD.fin THEN
        RETURN NEW;
    END IF;

    -- Un RDV encore en attente de confirmation n'a jamais été annoncé au
    -- client : il n'y a pas d'horaire à corriger dans son esprit. Le mail
    -- partira à la confirmation, avec le bon créneau.
    IF NOT NEW.confirmed OR NEW.nom IS NOT DISTINCT FROM 'Non Disponible' THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.rdv_reschedule_mail_queue (event_id, send_after)
    VALUES (NEW.id, now() + interval '3 minutes')
    ON CONFLICT (event_id) DO UPDATE
        SET send_after = excluded.send_after;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."queue_rdv_reschedule_mail"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."receptionner_carton"("p_carton_id" "uuid", "p_poids_recu" numeric DEFAULT NULL::numeric, "p_endommage" boolean DEFAULT false, "p_mauvaise_categorie" boolean DEFAULT false, "p_note" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."receptionner_carton"("p_carton_id" "uuid", "p_poids_recu" numeric, "p_endommage" boolean, "p_mauvaise_categorie" boolean, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_commande_statut"("p_commande_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."refresh_commande_statut"("p_commande_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reopen_packing_list"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."reopen_packing_list"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."role_slug"("role_name" "text") RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select case
    when role_name is null then ''
    else regexp_replace(
      translate(lower(role_name),
        'àáâãäåæçèéêëìíîïñòóôõöùúûüýÿœ',
        'aaaaaaacceeeeiiiinooooouuuuyyoe'),
      '[^a-z0-9]', '', 'g'
    )
  end;
$$;


ALTER FUNCTION "public"."role_slug"("role_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_fiche_tri"("p_fiche" "jsonb", "p_balles" "jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."save_fiche_tri"("p_fiche" "jsonb", "p_balles" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_push_subscription"("p_endpoint" "text", "p_subscription" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
    if auth.uid() is null then
        raise exception 'not authenticated' using errcode = '42501';
    end if;

    insert into public.push_subscriptions (user_id, endpoint, subscription)
    values (auth.uid(), p_endpoint, p_subscription)
    on conflict (endpoint) do update
        set user_id = excluded.user_id,
            subscription = excluded.subscription,
            updated_at = now();
end;
$$;


ALTER FUNCTION "public"."save_push_subscription"("p_endpoint" "text", "p_subscription" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."service_slug"("service_name" "text") RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select case
    when service_name is null then ''
    else regexp_replace(
      translate(lower(service_name),
        'àáâãäåæçèéêëìíîïñòóôõöùúûüýÿœ',
        'aaaaaaacceeeeiiiinooooouuuuyyoe'),
      '[^a-z0-9]', '', 'g'
    )
  end;
$$;


ALTER FUNCTION "public"."service_slug"("service_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_client_setter_on_confirm"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
DECLARE
    v_setter uuid := COALESCE(NEW.confirmed_by, auth.uid());
BEGIN
    IF NEW.id_client IS NOT NULL
       AND v_setter IS NOT NULL
       AND NEW.confirmed IS TRUE
       AND OLD.confirmed IS DISTINCT FROM TRUE THEN
        UPDATE public.client_crm
           SET customer = v_setter
         WHERE id = NEW.id_client
           AND customer IS DISTINCT FROM v_setter;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_client_setter_on_confirm"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_confirmation_amelia"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
    IF NEW.source = 'Amelia' THEN
        NEW."a confirmer" = true;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_confirmation_amelia"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_event_customer_from_closer"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
DECLARE
    v_closer_id uuid;
BEGIN
    -- Un commercial renseigné (choisi à la création, changé lors d'un
    -- transfert, ou simplement inchangé) est la source de vérité : on ne le
    -- remplace jamais. trg_sync_customer_to_closer (AFTER) aligne ensuite le
    -- closer de la fiche sur cette valeur.
    IF NEW.id_client IS NULL OR NEW.customer IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Pas de commercial (INSERT sans owner, ou UPDATE qui l'a vidé) :
    -- repli sur le closer de la fiche client.
    SELECT closers INTO v_closer_id
      FROM public.client_crm
     WHERE id = NEW.id_client;

    IF v_closer_id IS NOT NULL THEN
        NEW.customer := v_closer_id;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_event_customer_from_closer"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."set_event_customer_from_closer"() IS 'BEFORE INSERT/UPDATE Event_calendar : ne remplit `customer` depuis le closer de la fiche QUE s''il est vide. Un commercial choisi ou changé depuis le CRM est toujours respecté (cf. incident transfert du 10/09/2026). Le rangement Kanban est fait par move_client_column_on_event (AFTER).';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."snapshot_fournisseur_on_eclatement_handpick"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    IF NEW.is_eclatee AND NOT OLD.is_eclatee AND NEW.fournisseur_label IS NULL THEN
        SELECT f.name INTO NEW.fournisseur_label
          FROM public.fournisseurs_handpick f
         WHERE f.id = NEW.fournisseur_id;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."snapshot_fournisseur_on_eclatement_handpick"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."snapshot_produit_recherche_monthly_stats"("p_month" "date" DEFAULT (("date_trunc"('month'::"text", ("now"() AT TIME ZONE 'Europe/Paris'::"text")) - '1 mon'::interval))::"date") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
DECLARE
    v_month date := date_trunc('month', p_month)::date;
BEGIN
    DELETE FROM public.crm_produit_recherche_monthly_stats
    WHERE snapshot_month = v_month;

    INSERT INTO public.crm_produit_recherche_monthly_stats (snapshot_month, product_name, total_entries)
    SELECT v_month, product_name, COUNT(*)
    FROM (
        SELECT DISTINCT
            c.id,
            upper(left(trim(item.nom), 1))
                || lower(substring(trim(item.nom) from 2)) AS product_name
        FROM public.client_crm c
        CROSS JOIN LATERAL (SELECT public.crm_parse_brief(c.brief) AS b) parsed
        CROSS JOIN LATERAL (
            -- Produits : objets { nom, ... }
            SELECT e->>'nom' AS nom
            FROM jsonb_array_elements(
                (CASE WHEN jsonb_typeof(parsed.b->'vendDeja') = 'array'
                      THEN parsed.b->'vendDeja' ELSE '[]'::jsonb END)
                || (CASE WHEN jsonb_typeof(parsed.b->'recherche') = 'array'
                         THEN parsed.b->'recherche' ELSE '[]'::jsonb END)
            ) e
            WHERE jsonb_typeof(e) = 'object'
            UNION ALL
            -- Styles : chaînes
            SELECT e #>> '{}' AS nom
            FROM jsonb_array_elements(
                (CASE WHEN jsonb_typeof(parsed.b->'besoinsFemme') = 'array'
                      THEN parsed.b->'besoinsFemme' ELSE '[]'::jsonb END)
                || (CASE WHEN jsonb_typeof(parsed.b->'besoinsHomme') = 'array'
                         THEN parsed.b->'besoinsHomme' ELSE '[]'::jsonb END)
            ) e
            WHERE jsonb_typeof(e) = 'string'
        ) item
        WHERE c.created_at >= v_month::timestamp::timestamptz
          AND c.created_at < (v_month + INTERVAL '1 month')::timestamp::timestamptz
          AND trim(coalesce(item.nom, '')) <> ''
    ) client_products
    GROUP BY product_name;
END;
$$;


ALTER FUNCTION "public"."snapshot_produit_recherche_monthly_stats"("p_month" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."snapshot_produit_recherche_stats"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
DECLARE
    v_total integer;
BEGIN
    SELECT COALESCE(SUM(jsonb_array_length(parsed.brief_json->'recherche')), 0)
    INTO v_total
    FROM (
        SELECT CASE
            WHEN jsonb_typeof(brief) = 'string' THEN NULLIF(brief#>>'{}', '')::jsonb
            ELSE brief
        END AS brief_json
        FROM public.client_crm
        WHERE brief IS NOT NULL
    ) parsed
    WHERE jsonb_typeof(parsed.brief_json->'recherche') = 'array';

    INSERT INTO public.crm_produit_recherche_stats (snapshot_month, total_entries)
    VALUES (date_trunc('month', now())::date, v_total)
    ON CONFLICT (snapshot_month)
    DO UPDATE SET total_entries = EXCLUDED.total_entries;
END;
$$;


ALTER FUNCTION "public"."snapshot_produit_recherche_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."stamp_event_confirmation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
DECLARE
    v_uid uuid := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- Un RDV créé dans le CRM compte déjà par sa source : `confirmed_by`
        -- ne marque que la confirmation d'un RDV existant.
        NEW.confirmed_by := NULL;
        RETURN NEW;
    END IF;

    IF NEW.confirmed IS TRUE AND OLD.confirmed IS DISTINCT FROM TRUE THEN
        -- Confirmer compte le RDV comme CRÉÉ par celui qui confirme, ce
        -- jour-là (voir 20260924110000_event_calendar_confirmed_by.sql).
        NEW.confirmed_by := v_uid;
        NEW.creator_id   := v_uid;
        NEW.created_at   := now();
    ELSE
        NEW.confirmed_by := OLD.confirmed_by;
        IF OLD.confirmed IS TRUE THEN
            -- Déjà confirmé : une confirmation répétée ne vole pas le crédit.
            NEW.creator_id := OLD.creator_id;
            NEW.created_at := OLD.created_at;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."stamp_event_confirmation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_customer_to_closer"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
  IF NEW.id_client IS NOT NULL AND NEW.customer IS NOT NULL THEN
    UPDATE public.client_crm
       SET closers = NEW.customer
     WHERE id = NEW.id_client
       AND closers IS DISTINCT FROM NEW.customer;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_customer_to_closer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_last_login"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.profiles
     SET last_login = NEW.last_sign_in_at
   WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_last_login"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_relance_tasks_on_rdv_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
  IF new.nom NOT IN ('rdv physique achat', 'rdv visio achat') THEN
    RETURN new;
  END IF;

  -- No-show : on supprime les tâches, terminées ou non.
  IF old.show IS DISTINCT FROM new.show AND new.show = false THEN
    DELETE FROM public."Tache_crm"
    WHERE event_id = new.id
      AND type IN ('Suivis rdv', 'Relance post achat');
    RETURN new;
  END IF;

  -- RDV déplacé : on recale les dates des tâches non terminées
  -- en fonction de la nouvelle date du RDV (new.debut).
  IF new.debut IS DISTINCT FROM old.debut THEN
    UPDATE public."Tache_crm"
    SET date = new.debut + interval '1 day'
    WHERE event_id = new.id
      AND type = 'Suivis rdv'
      AND COALESCE(valide, false) = false;

    UPDATE public."Tache_crm"
    SET date = new.debut + interval '30 days'
    WHERE event_id = new.id
      AND type = 'Relance post achat'
      AND COALESCE(valide, false) = false;
  END IF;

  RETURN new;
END;
$$;


ALTER FUNCTION "public"."sync_relance_tasks_on_rdv_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$ begin new.updated_at = now(); return new; end $$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_crm_stats_newsletter"("p_period" "text", "p_hour" integer) RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
    v_url    text;
    v_secret text;
begin
    select decrypted_secret into v_url
    from vault.decrypted_secrets
    where name = 'crm_stats_newsletter_url';

    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'crm_stats_newsletter_cron_secret';

    if v_url is null or v_secret is null then
        raise warning 'trigger_crm_stats_newsletter : secrets vault '
            'crm_stats_newsletter_url / crm_stats_newsletter_cron_secret absents';
        return null;
    end if;

    return net.http_post(
        url                  => v_url,
        body                 => pg_catalog.jsonb_build_object(
                                    'period', p_period,
                                    'hour',   p_hour
                                ),
        params               => '{}'::jsonb,
        headers              => pg_catalog.jsonb_build_object(
                                    'Content-Type',  'application/json',
                                    'x-cron-secret', v_secret
                                ),
        timeout_milliseconds => 120000
    );
end;
$$;


ALTER FUNCTION "public"."trigger_crm_stats_newsletter"("p_period" "text", "p_hour" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_crm_stats_newsletter"("p_period" "text", "p_hour" integer) IS 'Appelle l''Edge Function crm-stats-newsletter (digest stats CRM). Appelé par les crons crm-stats-newsletter-week / -day.';



CREATE OR REPLACE FUNCTION "public"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$ select auth.uid() $$;


ALTER FUNCTION "public"."uid"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_cryptedmessage_groups_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_cryptedmessage_groups_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_event_calendar_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_event_calendar_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_outlook_connection_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_outlook_connection_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_project_status_as_admin"("p_team_id" "uuid", "p_status" "public"."project_team_status") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not public.user_is_global_admin(auth.uid()) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  update public.project_teams
  set status = p_status
  where id = p_team_id;
end;
$$;


ALTER FUNCTION "public"."update_project_status_as_admin"("p_team_id" "uuid", "p_status" "public"."project_team_status") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_access_project"("team_id" "uuid", "target_user" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
  v_role text;
  v_service text;
  project_service text;
BEGIN
  IF public.user_is_global_admin(target_user) THEN RETURN true; END IF;

  SELECT role_slug, service_slug INTO v_role, v_service
  FROM public.user_role_and_service(target_user)
  LIMIT 1;

  IF v_service = 'tech' THEN RETURN true; END IF;
  IF v_service = 'direction' THEN RETURN true; END IF;

  IF public.user_is_project_team_member(team_id, target_user) THEN RETURN true; END IF;

  SELECT COALESCE(public.project_owner_service_slug(team_id), '')
  INTO project_service;

  IF v_role = 'chefdeservice' THEN
    RETURN project_service = v_service;
  END IF;

  RETURN false;
END;
$$;


ALTER FUNCTION "public"."user_can_access_project"("team_id" "uuid", "target_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_access_task"("target_task" "uuid", "member_only" boolean DEFAULT false, "target_user" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_tasks t
    JOIN public.project_sprints s ON s.id = t.sprint_id
    WHERE t.id = target_task
      AND public.user_can_access_project(s.team_id, target_user)
      AND (NOT member_only OR public.user_is_project_team_member(s.team_id, target_user))
  );
$$;


ALTER FUNCTION "public"."user_can_access_task"("target_task" "uuid", "member_only" boolean, "target_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_create_projects"("target_user" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT public.user_can_manage_projects(target_user);
$$;


ALTER FUNCTION "public"."user_can_create_projects"("target_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_manage_projects"("target_user" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
  v_role text;
  v_service text;
BEGIN
  SELECT role_slug, service_slug INTO v_role, v_service
  FROM public.user_role_and_service(target_user)
  LIMIT 1;

  IF v_role = 'superadmin' THEN RETURN true; END IF;

  IF v_role = 'chefdeservice' THEN
    IF v_service = 'direction' THEN RETURN false; END IF;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;


ALTER FUNCTION "public"."user_can_manage_projects"("target_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_view_projects"("target_user" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_teams t
    WHERE public.user_can_access_project(t.id, target_user)
  );
$$;


ALTER FUNCTION "public"."user_can_view_projects"("target_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_permission"("p_uid" "uuid", "p_code" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.roles_permissions rp ON rp.role_id = pr.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE pr.user_id = p_uid
      AND p.code = p_code
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.services_permissions sp ON sp.service_id = pr.service_id
    JOIN public.permissions p ON p.id = sp.permission_id
    WHERE pr.user_id = p_uid
      AND p.code = p_code
  )
  OR EXISTS (
    SELECT 1
    FROM public.users_permissions up
    JOIN public.permissions p ON p.id = up.permission_id
    WHERE up.user_id = p_uid
      AND p.code = p_code
  );
$$;


ALTER FUNCTION "public"."user_has_permission"("p_uid" "uuid", "p_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_project_service"("target_user" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE((
    SELECT service_slug <> ''
    FROM public.user_role_and_service(target_user) LIMIT 1
  ), false);
$$;


ALTER FUNCTION "public"."user_has_project_service"("target_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_global_admin"("target_user" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from public.user_role_and_service(target_user)
    where role_slug = 'superadmin'
  );
$$;


ALTER FUNCTION "public"."user_is_global_admin"("target_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_project_team_member"("target_team" "uuid", "target_user" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_team_members m
    WHERE m.team_id = target_team AND m.user_id = target_user
  )
  OR EXISTS (
    SELECT 1 FROM public.project_teams t
    WHERE t.id = target_team AND t.owner_id = target_user
  );
$$;


ALTER FUNCTION "public"."user_is_project_team_member"("target_team" "uuid", "target_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_service_manager"("target_user" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  select coalesce((
    select role_slug in ('superadmin', 'chefdeservice')
    from public.user_role_and_service(target_user)
    limit 1
  ), false);
$$;


ALTER FUNCTION "public"."user_is_service_manager"("target_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_preferences_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."user_preferences_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_role_and_service"("target_user" "uuid" DEFAULT "auth"."uid"()) RETURNS TABLE("role_slug" "text", "service_slug" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select public.role_slug(r.nom), public.service_slug(s.nom)
  from public.profiles p
  left join public.roles r on r.id = p.role_id
  left join public.services s on s.id = p.service_id
  where p.user_id = target_user;
$$;


ALTER FUNCTION "public"."user_role_and_service"("target_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_service_slug"("target_user" "uuid" DEFAULT "auth"."uid"()) RETURNS "text"
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT service_slug FROM public.user_role_and_service(target_user) LIMIT 1;
$$;


ALTER FUNCTION "public"."user_service_slug"("target_user" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."users_with_permission"("p_code" "text") RETURNS TABLE("user_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    SELECT pr.user_id
    FROM public.profiles pr
    JOIN public.roles_permissions rp ON rp.role_id = pr.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE p.code = p_code AND pr.user_id IS NOT NULL

    UNION

    SELECT pr.user_id
    FROM public.profiles pr
    JOIN public.services_permissions sp ON sp.service_id = pr.service_id
    JOIN public.permissions p ON p.id = sp.permission_id
    WHERE p.code = p_code AND pr.user_id IS NOT NULL

    UNION

    SELECT up.user_id
    FROM public.users_permissions up
    JOIN public.permissions p ON p.id = up.permission_id
    WHERE p.code = p_code AND up.user_id IS NOT NULL;
$$;


ALTER FUNCTION "public"."users_with_permission"("p_code" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."users_with_permission"("p_code" "text") IS 'Utilisateurs détenant un code de permission, toutes sources confondues (rôle, service, attribution individuelle). Pendant « ensembliste » de user_has_permission.';



CREATE OR REPLACE FUNCTION "public"."validate_packing_list"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."validate_packing_list"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."watch_config_visible_to_service"("p_config_id" integer, "p_service_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
    SELECT
        CASE
            WHEN service_ids IS NULL THEN TRUE
            WHEN service_ids = '{}' THEN TRUE
            ELSE p_service_id = ANY(service_ids)
        END
    FROM public.watch_config
    WHERE id = p_config_id;
$$;


ALTER FUNCTION "public"."watch_config_visible_to_service"("p_config_id" integer, "p_service_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wiki_articles_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions', 'auth', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."wiki_articles_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wiki_reorder_categories"("p_updates" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."wiki_reorder_categories"("p_updates" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."wiki_reorder_categories"("p_updates" "jsonb") IS 'Déplace/réordonne des catégories wiki en une transaction. Requiert wiki.manage. Refuse les cycles parent_id.';



CREATE OR REPLACE FUNCTION "public"."wiki_stats_cold_articles"("p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS TABLE("article_id" "uuid", "title" "text", "category_id" "uuid", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM public.wiki_stats_guard();

    RETURN QUERY
    SELECT a.id, a.title, a.category_id, a.updated_at
    FROM public.wiki_articles a
    WHERE a.status = 'published'
      -- Vue mesurée : un article que seul son auteur a rouvert reste froid.
      AND NOT EXISTS (
          SELECT 1
          FROM public.wiki_article_views_measured v
          WHERE v.article_id = a.id
            AND v.viewed_at >= p_from
            AND v.viewed_at <  p_to
      )
    ORDER BY a.updated_at DESC;
END;
$$;


ALTER FUNCTION "public"."wiki_stats_cold_articles"("p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wiki_stats_guard"() RETURNS "void"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF NOT (SELECT public.has_permission('wiki.manage'::text)) THEN
        RAISE EXCEPTION 'wiki.manage requis pour consulter les statistiques du wiki'
            USING ERRCODE = '42501';
    END IF;
END;
$$;


ALTER FUNCTION "public"."wiki_stats_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wiki_stats_overview"("p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_published bigint;
    v_result    jsonb;
BEGIN
    PERFORM public.wiki_stats_guard();

    SELECT count(*) INTO v_published
    FROM public.wiki_articles WHERE status = 'published';

    SELECT jsonb_build_object(
        'views',              count(*),
        'unique_readers',     count(DISTINCT v.user_id),
        -- FILTER sur le statut : les managers consultent aussi les brouillons.
        -- Sans lui, le numérateur déborde le dénominateur et la couverture
        -- dépasse 100 %.
        'articles_viewed',    count(DISTINCT v.article_id)
                                  FILTER (WHERE v.article_status = 'published'),
        'articles_published', v_published,
        -- Part du catalogue publié qui a été lue au moins une fois.
        'coverage_rate',      CASE WHEN v_published > 0
                                   THEN round(count(DISTINCT v.article_id)
                                                  FILTER (WHERE v.article_status = 'published')::numeric
                                              * 100 / v_published, 1)
                                   ELSE 0 END,
        'avg_dwell_seconds',  COALESCE(round(avg(v.dwell_ms)
                                             FILTER (WHERE v.dwell_ms IS NOT NULL) / 1000.0, 1), 0),
        'completion_rate',    CASE WHEN count(*) > 0
                                   THEN round(count(*) FILTER (WHERE v.completed)::numeric
                                              * 100 / count(*), 1)
                                   ELSE 0 END,
        -- Rebond : ouvert puis refermé en moins de 5 s (clic sans lecture).
        'bounce_rate',        CASE WHEN count(*) FILTER (WHERE v.dwell_ms IS NOT NULL) > 0
                                   THEN round(count(*) FILTER (WHERE v.dwell_ms < 5000)::numeric
                                              * 100 / count(*) FILTER (WHERE v.dwell_ms IS NOT NULL), 1)
                                   ELSE 0 END
    ) INTO v_result
    FROM public.wiki_article_views_measured v
    WHERE v.viewed_at >= p_from AND v.viewed_at < p_to;

    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."wiki_stats_overview"("p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wiki_stats_readers"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer DEFAULT 20) RETURNS TABLE("user_id" "uuid", "full_name" "text", "avatar_url" "text", "views" bigint, "articles_read" bigint, "last_seen" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM public.wiki_stats_guard();

    RETURN QUERY
    SELECT v.user_id,
           COALESCE(p.full_name, 'Utilisateur inconnu'),
           p.avatar_url,
           count(*),
           count(DISTINCT v.article_id),
           max(v.viewed_at)
    FROM public.wiki_article_views_measured v
    LEFT JOIN public.profiles p ON p.user_id = v.user_id
    WHERE v.viewed_at >= p_from AND v.viewed_at < p_to
    GROUP BY v.user_id, p.full_name, p.avatar_url
    ORDER BY count(*) DESC, max(v.viewed_at) DESC
    LIMIT GREATEST(p_limit, 1);
END;
$$;


ALTER FUNCTION "public"."wiki_stats_readers"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wiki_stats_retention"("p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS TABLE("cohort_week" "date", "week_offset" integer, "readers" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM public.wiki_stats_guard();

    RETURN QUERY
    WITH weeks AS (
        SELECT user_id, date_trunc('week', viewed_at) AS week
        FROM public.wiki_article_views_measured
        WHERE viewed_at >= p_from AND viewed_at < p_to
        GROUP BY user_id, date_trunc('week', viewed_at)
    ),
    cohorts AS (
        SELECT user_id, min(week) AS cohort FROM weeks GROUP BY user_id
    )
    SELECT c.cohort::date,
           (EXTRACT(EPOCH FROM (w.week - c.cohort)) / 604800)::int,
           count(DISTINCT w.user_id)
    FROM weeks w
    JOIN cohorts c ON c.user_id = w.user_id
    GROUP BY c.cohort, 2
    ORDER BY 1, 2;
END;
$$;


ALTER FUNCTION "public"."wiki_stats_retention"("p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wiki_stats_timeseries"("p_from" timestamp with time zone, "p_to" timestamp with time zone) RETURNS TABLE("day" "date", "views" bigint, "unique_readers" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM public.wiki_stats_guard();

    RETURN QUERY
    -- Agrégation d'abord, jointure ensuite : un LEFT JOIN de la table de vues
    -- sur chaque jour généré relancerait un parcours par jour. generate_series
    -- reste nécessaire pour que les jours sans consultation valent 0 au lieu
    -- de trouer la courbe.
    WITH daily AS (
        SELECT date_trunc('day', v.viewed_at) AS d,
               count(*)                       AS views,
               count(DISTINCT v.user_id)      AS unique_readers
        FROM public.wiki_article_views_measured v
        WHERE v.viewed_at >= p_from AND v.viewed_at < p_to
        GROUP BY 1
    )
    SELECT g::date,
           COALESCE(daily.views, 0),
           COALESCE(daily.unique_readers, 0)
    FROM generate_series(date_trunc('day', p_from),
                         date_trunc('day', p_to - interval '1 microsecond'),
                         interval '1 day') AS g
    LEFT JOIN daily ON daily.d = g
    ORDER BY g;
END;
$$;


ALTER FUNCTION "public"."wiki_stats_timeseries"("p_from" timestamp with time zone, "p_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."wiki_stats_top_articles"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer DEFAULT 10) RETURNS TABLE("article_id" "uuid", "title" "text", "category_id" "uuid", "status" "text", "views" bigint, "unique_readers" bigint, "avg_dwell_seconds" numeric, "completion_rate" numeric, "last_viewed_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    PERFORM public.wiki_stats_guard();

    RETURN QUERY
    SELECT v.article_id,
           v.article_title,
           v.article_category_id,
           v.article_status,
           count(*),
           count(DISTINCT v.user_id),
           COALESCE(round(avg(v.dwell_ms) FILTER (WHERE v.dwell_ms IS NOT NULL) / 1000.0, 1), 0::numeric),
           round(count(*) FILTER (WHERE v.completed)::numeric * 100 / count(*), 1),
           max(v.viewed_at)
    FROM public.wiki_article_views_measured v
    WHERE v.viewed_at >= p_from AND v.viewed_at < p_to
    GROUP BY v.article_id, v.article_title, v.article_category_id, v.article_status
    ORDER BY count(*) DESC, max(v.viewed_at) DESC
    LIMIT GREATEST(p_limit, 1);
END;
$$;


ALTER FUNCTION "public"."wiki_stats_top_articles"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zones_handpick_check_hierarchy"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    parent_kind TEXT;
    cycle_found BOOLEAN;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT z.kind INTO parent_kind
    FROM public.zones_handpick z
    WHERE z.id = NEW.parent_id;

    IF parent_kind IS NULL THEN
        RAISE EXCEPTION 'Zone parente % introuvable', NEW.parent_id;
    END IF;

    -- (a) niveaux autorisés
    IF NEW.kind = 'allee' AND parent_kind <> 'zone' THEN
        RAISE EXCEPTION 'Une allée doit être rattachée à une zone (parent: %)', parent_kind;
    END IF;

    IF NEW.kind = 'etagere' AND parent_kind NOT IN ('zone', 'allee') THEN
        RAISE EXCEPTION 'Une étagère doit être rattachée à une zone ou une allée (parent: %)', parent_kind;
    END IF;

    -- (b) anti-cycle : le nouveau parent ne doit pas être un descendant.
    -- Seul un UPDATE peut créer un cycle (à l'INSERT, la ligne n'a pas
    -- encore de descendance).
    IF TG_OP = 'UPDATE' AND NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
        WITH RECURSIVE descendants AS (
            SELECT z.id
            FROM public.zones_handpick z
            WHERE z.parent_id = NEW.id
            UNION ALL
            SELECT z.id
            FROM public.zones_handpick z
            JOIN descendants d ON z.parent_id = d.id
        )
        SELECT EXISTS (SELECT 1 FROM descendants WHERE id = NEW.parent_id)
        INTO cycle_found;

        IF cycle_found THEN
            RAISE EXCEPTION 'Cycle détecté : la zone % ne peut pas être rattachée à son propre descendant %',
                NEW.id, NEW.parent_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."zones_handpick_check_hierarchy"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."zones_magasin_check_hierarchy"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    parent_kind    TEXT;
    parent_magasin UUID;
    cycle_found    BOOLEAN;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT z.kind, z.magasin_id INTO parent_kind, parent_magasin
    FROM public.zones_magasin z
    WHERE z.id = NEW.parent_id;

    IF parent_kind IS NULL THEN
        RAISE EXCEPTION 'Zone parente introuvable';
    END IF;

    IF parent_magasin <> NEW.magasin_id THEN
        RAISE EXCEPTION 'La zone parente appartient à un autre magasin';
    END IF;

    IF NEW.kind = 'rayon' AND parent_kind <> 'zone' THEN
        RAISE EXCEPTION 'Un rayon doit être rattaché à une zone';
    END IF;

    IF NEW.kind = 'etagere' AND parent_kind NOT IN ('zone', 'rayon') THEN
        RAISE EXCEPTION 'Une étagère doit être rattachée à une zone ou à un rayon';
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
        WITH RECURSIVE descendants AS (
            SELECT z.id FROM public.zones_magasin z WHERE z.parent_id = NEW.id
            UNION ALL
            SELECT z.id FROM public.zones_magasin z JOIN descendants d ON z.parent_id = d.id
        )
        SELECT EXISTS (SELECT 1 FROM descendants WHERE id = NEW.parent_id)
        INTO cycle_found;

        IF cycle_found THEN
            RAISE EXCEPTION 'Une zone ne peut pas être rattachée à l''une de ses sous-zones';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."zones_magasin_check_hierarchy"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Changelog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "version" "text",
    "content" "jsonb",
    "deployement_date" "date"
);


ALTER TABLE "public"."Changelog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Client_activite" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client" "uuid",
    "date" "date",
    "title" "text",
    "content" "text",
    "owner" "uuid"
);


ALTER TABLE "public"."Client_activite" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Devis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "by" "uuid",
    "client" "uuid",
    "Tableau_id" "uuid",
    "poid" numeric,
    "totalHT" numeric,
    "totalTVA" numeric,
    "totalTTC" numeric,
    "termes" "text",
    "status" "text",
    "paiement" "text",
    "service" "text",
    "Date_crea" "text",
    "Date_end" "text",
    "name" "text",
    "TVA" numeric,
    "Livraison" "text",
    "Archive" boolean,
    "Avoir" numeric,
    "Remise" "text",
    "poid_balance" numeric,
    "urgence" "text"
);


ALTER TABLE "public"."Devis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Event_calendar_Comm" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text",
    "debut" timestamp with time zone,
    "fin" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "creator_id" "uuid",
    "customer" "uuid",
    "description" "text",
    "valide" boolean
);


ALTER TABLE "public"."Event_calendar_Comm" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Fournisseur_crm" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text"
);


ALTER TABLE "public"."Fournisseur_crm" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Kanban_comm" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "column" numeric,
    "created_by" "uuid",
    "assigned" "uuid",
    "description" "text"
);


ALTER TABLE "public"."Kanban_comm" OWNER TO "postgres";


ALTER TABLE "public"."Kanban_comm" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."Kanban_comm_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."Maintenance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deployement_date" "date",
    "message" "text",
    "Active" boolean
);


ALTER TABLE "public"."Maintenance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."News" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "title" "text",
    "content" "text",
    "start_date" "date",
    "end_date" "date",
    "image" "jsonb"
);


ALTER TABLE "public"."News" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Tache_crm" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text",
    "client" "uuid",
    "content" "text",
    "valide" boolean,
    "owner" "uuid",
    "date" "date",
    "placement" "text",
    "overdue_notified_at" timestamp with time zone,
    "categorie" "text",
    "creator_id" "uuid",
    "event_id" "uuid"
);


ALTER TABLE "public"."Tache_crm" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."Type_product_CRM" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text"
);


ALTER TABLE "public"."Type_product_CRM" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "entity_type" "text" NOT NULL,
    "entity_id" "text",
    "entity_label" "text",
    "action" "text" NOT NULL,
    "description" "text",
    "changes" "jsonb"
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_log_handpick" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "entity_type" "text",
    "entity_id" "text",
    "entity_label" "text",
    "action" "text",
    "description" "text",
    "changes" "jsonb",
    CONSTRAINT "activity_log_handpick_entity_type_valid" CHECK (("entity_type" = ANY (ARRAY['balle'::"text", 'category'::"text", 'fournisseur'::"text", 'fournisseur_category'::"text", 'mouvement'::"text", 'zone'::"text", 'emplacement'::"text", 'flux'::"text"])))
);


ALTER TABLE "public"."activity_log_handpick" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_watch_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "period_start" "text",
    "period_end" "text",
    "topic" "text",
    "frequency" "text",
    "source_model" "text",
    "analysis_model" "text",
    "raw_research" "text",
    "executive_summary" "text",
    "risks" "text",
    "opportunities" "text",
    "recommended_actions" "text",
    "importance_score" numeric,
    "tags" "text"[],
    "metadata" "jsonb"
);


ALTER TABLE "public"."ai_watch_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."amelia_availability_closures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supabase_user_id" "uuid",
    "start_date" "date",
    "end_date" "date",
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."amelia_availability_closures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."amelia_availability_days_off" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supabase_user_id" "uuid",
    "day" "text",
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."amelia_availability_days_off" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."amelia_availability_special" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supabase_user_id" "uuid",
    "day" "text",
    "start_time" "text",
    "end_time" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."amelia_availability_special" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."amelia_availability_weekly" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supabase_user_id" "uuid",
    "day_of_week" numeric,
    "start_time" "text",
    "end_time" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."amelia_availability_weekly" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."amelia_company_closures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."amelia_company_closures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."amelia_company_days_off" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "day" "text",
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."amelia_company_days_off" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."amelia_company_special" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "day" "text",
    "start_time" "text",
    "end_time" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."amelia_company_special" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."amelia_company_weekly" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "day_of_week" numeric,
    "start_time" "text",
    "end_time" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."amelia_company_weekly" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."amelia_provider_mapping" (
    "amelia_provider_id" bigint,
    "supabase_user_id" "uuid",
    "email" "text",
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "status" "text",
    "last_synced_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "managed_by_bridge" boolean DEFAULT false
);


ALTER TABLE "public"."amelia_provider_mapping" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_export_collaborators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "fallback_name" "text",
    "group_index" integer NOT NULL,
    "member_index" integer NOT NULL,
    "sep_after" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_export_collaborators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analyze_content_generation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "category" "text",
    "color" "text",
    "brand" "text",
    "summary" "text",
    "brand_history" "text",
    "specs" "jsonb",
    "auth_notes" "text"
);


ALTER TABLE "public"."analyze_content_generation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."annonce" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "titre" "text",
    "type" "text",
    "image" "jsonb",
    "description" "text",
    "link" "text",
    "start_date" "date",
    "end_date" "date",
    "archived_at" timestamp with time zone,
    "target_role_ids" "uuid"[],
    "target_service_ids" "uuid"[],
    "pinned" boolean DEFAULT false,
    "author_id" "uuid",
    "excerpt" "text",
    "body_markdown" "text",
    "event_date" "date",
    CONSTRAINT "annonce_body_len_check" CHECK ((("body_markdown" IS NULL) OR ("char_length"("body_markdown") <= 20000))),
    CONSTRAINT "annonce_excerpt_len_check" CHECK ((("excerpt" IS NULL) OR ("char_length"("excerpt") <= 280)))
);


ALTER TABLE "public"."annonce" OWNER TO "postgres";


COMMENT ON TABLE "public"."annonce" IS 'Annonces affichées sur la page d''accueil. Fenêtre de diffusion [start_date, end_date] ; archived_at = masquage réversible.';



COMMENT ON COLUMN "public"."annonce"."type" IS 'Rubrique : news | event | message | celebration | release.';



COMMENT ON COLUMN "public"."annonce"."archived_at" IS 'Date d''archivage. NULL = annonce active.';



COMMENT ON COLUMN "public"."annonce"."target_role_ids" IS 'Rôles destinataires. Tableau vide = tous les rôles.';



COMMENT ON COLUMN "public"."annonce"."target_service_ids" IS 'Services destinataires. Tableau vide = tous les services.';



COMMENT ON COLUMN "public"."annonce"."pinned" IS 'Annonce épinglée : présentée en tête du carrousel.';



COMMENT ON COLUMN "public"."annonce"."author_id" IS 'Auteur de l''annonce (profiles.user_id). NULL pour les annonces antérieures à la signature.';



COMMENT ON COLUMN "public"."annonce"."excerpt" IS 'Chapô : l''accroche affichée dans le bandeau et en tête d''article.';



COMMENT ON COLUMN "public"."annonce"."body_markdown" IS 'Corps de l''article, en markdown restreint. Remplace `description` quand il est renseigné.';



COMMENT ON COLUMN "public"."annonce"."event_date" IS 'Date affichée au lecteur — distincte de start_date, qui est la fenêtre de publication.';



CREATE TABLE IF NOT EXISTS "public"."app_logs" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "level" "text",
    "message" "text",
    "context" "jsonb",
    "url" "text",
    "stack" "text",
    "session_id" "text",
    "browser" "text",
    "user_email" "text"
);


ALTER TABLE "public"."app_logs" OWNER TO "postgres";


ALTER TABLE "public"."app_logs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."app_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE "public"."app_logs_retention_audit" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."app_logs_retention_audit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."app_logs_retention_config" (
    "table_name" "text" NOT NULL,
    "date_column" "text" NOT NULL,
    "retention_months" integer DEFAULT 12 NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "extra_filter" "text",
    CONSTRAINT "app_logs_retention_config_retention_months_check" CHECK (("retention_months" >= 0))
);


ALTER TABLE "public"."app_logs_retention_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."app_logs_retention_config" IS 'Tables soumises à la purge de rétention (table, colonne de date, durée, filtre optionnel).';



CREATE TABLE IF NOT EXISTS "public"."app_maintenance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scope" "text",
    "feature_key" "text",
    "active" boolean DEFAULT false,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "message" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."app_maintenance" REPLICA IDENTITY FULL;


ALTER TABLE "public"."app_maintenance" OWNER TO "postgres";


COMMENT ON TABLE "public"."app_maintenance" IS 'Fenêtres de maintenance. scope=global coupe l''application, scope=feature coupe la seule feature feature_key (clé = title de menuItems.ts). Contournement : permission maintenance.bypass.';



CREATE TABLE IF NOT EXISTS "public"."apple_calendar_connections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "icloud_email" "text",
    "icloud_app_password_encrypted" "bytea",
    "is_active" boolean DEFAULT false,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "auth_failure_count" numeric,
    "last_auth_failure_at" timestamp with time zone
);


ALTER TABLE "public"."apple_calendar_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."arrivage_manuel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "container_no" "text" NOT NULL,
    "conteneur_no_raw" "text",
    "fournisseur_id" "uuid",
    "status" "text" DEFAULT 'planifié'::"text" NOT NULL,
    "transport_mode" "text",
    "departure_date" "date",
    "port_arrival_date" "date",
    "total_weight_kg" numeric(12,2),
    "total_qty" integer,
    "docked_at" "date",
    "received_date" "date",
    "notes" "text",
    "invoice_no" "text",
    "invoice_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "prev_dechargement_at" timestamp with time zone,
    "status_auto" boolean DEFAULT false,
    CONSTRAINT "arrivage_manuel_status_check" CHECK (("status" = ANY (ARRAY['planifié'::"text", 'en_transit'::"text", 'déchargé'::"text", 'reçu'::"text", 'annulé'::"text"])))
);


ALTER TABLE "public"."arrivage_manuel" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."arrivage_state" (
    "container_no" "text",
    "status" "text",
    "fournisseur_id" "uuid",
    "docked_at" timestamp with time zone,
    "received_date" "date",
    "notes" "text",
    "livraison_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "kind" "text"
);


ALTER TABLE "public"."arrivage_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."arrivage_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "service" "text" DEFAULT 'default'::"text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "subscribed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."arrivage_subscribers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."arrivees_departs" (
    "id" bigint NOT NULL,
    "pays" "text",
    "provenance" "text",
    "date_facture" "date",
    "date_depart" "date",
    "date_arrivee_le_havre" "date",
    "mode_raw" "text",
    "conteneur_no_raw" "text",
    "prev_dechargement_jour" "text",
    "prev_dechargement_date" "date",
    "prev_dechargement_heure" "text",
    "poids" numeric,
    "quantite" numeric,
    "conteneur_no" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "reference_interne" "text",
    "mode_normalized" "text",
    "prev_dechargement_libre" "text"
);


ALTER TABLE "public"."arrivees_departs" OWNER TO "postgres";


ALTER TABLE "public"."arrivees_departs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."arrivees_departs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."balles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fournisseur_uid" "uuid",
    "category" "text",
    "weight" numeric,
    "country" "text",
    "comments" "text",
    "treatment_data" "text",
    "unit" "text",
    "owner" "uuid",
    "assigned_to" "uuid",
    "piece" numeric,
    "receiption_date" "date",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."balles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."balles_emplacements_handpick" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "balle_id" "uuid",
    "event" "text",
    "emplacement_from_id" "uuid",
    "emplacement_to_id" "uuid",
    "from_path" "text",
    "to_path" "text",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."balles_emplacements_handpick" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."balles_gestion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "packing" numeric,
    "provenance" "text",
    "import_date" "date",
    "fournisseur_id" "uuid",
    "category_id" "uuid",
    "status" "text",
    "bin" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "location" "text",
    "type" "text",
    "is_original" boolean,
    "parent_balle_id" "uuid",
    "delivery_id" "uuid",
    "purchase_price" numeric,
    "treatment_cost" numeric,
    "raw_name" "text"
);


ALTER TABLE "public"."balles_gestion" OWNER TO "postgres";


COMMENT ON COLUMN "public"."balles_gestion"."raw_name" IS 'Description brute de l''item issue de la packing list (avant matching de catégorie).';



CREATE TABLE IF NOT EXISTS "public"."balles_handpick" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "packing" numeric,
    "packing_mode" "text",
    "import_date" "date",
    "fournisseur_id" "uuid",
    "category_id" "uuid",
    "raw_name" "text",
    "provenance" "text",
    "is_original" boolean DEFAULT false,
    "parent_balle_id" "uuid",
    "status" "text",
    "location" "text",
    "type" "text",
    "emplacement_id" "uuid",
    "placed_at" timestamp with time zone,
    "purchase_price" numeric,
    "treatment_cost" numeric,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "is_eclatee" boolean DEFAULT false,
    "eclatee_at" timestamp with time zone,
    "eclatee_by" "uuid",
    "borrowed_by" "uuid",
    "borrowed_at" timestamp with time zone,
    "fournisseur_label" "text",
    CONSTRAINT "balles_handpick_eclatee_coherent" CHECK ((("is_eclatee" = ("status" = 'eclatee'::"text")) AND ("is_eclatee" = ("eclatee_at" IS NOT NULL)))),
    CONSTRAINT "balles_handpick_status_valid" CHECK (("status" = ANY (ARRAY['stocked'::"text", 'used'::"text", 'exported'::"text", 'transfered'::"text", 'imported'::"text", 'delivered'::"text", 'shipped'::"text", 'eclatee'::"text"])))
);


ALTER TABLE "public"."balles_handpick" OWNER TO "postgres";


COMMENT ON COLUMN "public"."balles_handpick"."location" IS 'Macro-état physique de la balle. Invariant NON contraint en base : emplacement_id IS NOT NULL implique location = ''warehouse'' — l''inverse est faux (une balle peut être en entrepôt sans adresse assignée). Un CHECK croisé forcerait tous les formulaires à écrire les deux colonnes ensemble ; c''est la couche service qui pose l''invariant (setEmplacement).';



COMMENT ON COLUMN "public"."balles_handpick"."emplacement_id" IS 'Adresse fine dans le plan de l''entrepôt. NULL = pas encore rangée. La FK cible une FEUILLE (emplacements_handpick), jamais une zone.';



COMMENT ON COLUMN "public"."balles_handpick"."is_eclatee" IS 'Vrai si la balle a été éclatée (retirée du stock, pièces vendues à l''unité). Toujours aligné sur status = ''eclatee'' et eclatee_at.';



COMMENT ON COLUMN "public"."balles_handpick"."fournisseur_label" IS 'Nom de l''usine au moment de l''éclatement. Survit à la suppression de l''usine (fournisseur_id passe alors à NULL).';



CREATE TABLE IF NOT EXISTS "public"."bibliotheque_brief" (
    "id" smallint DEFAULT 1 NOT NULL,
    "brief" "text" DEFAULT ''::"text" NOT NULL,
    "brief_en" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "chiffres" "text" DEFAULT ''::"text" NOT NULL,
    "chiffres_en" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "bibliotheque_brief_id_check" CHECK (("id" = 1))
);


ALTER TABLE "public"."bibliotheque_brief" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bibliotheque_format_reponses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quest_rep_id" "uuid" NOT NULL,
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "instagram" "text" DEFAULT ''::"text" NOT NULL,
    "whatsapp" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email_en" "text" DEFAULT ''::"text" NOT NULL,
    "instagram_en" "text" DEFAULT ''::"text" NOT NULL,
    "whatsapp_en" "text" DEFAULT ''::"text" NOT NULL
);

ALTER TABLE ONLY "public"."bibliotheque_format_reponses" REPLICA IDENTITY FULL;


ALTER TABLE "public"."bibliotheque_format_reponses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bibliotheque_questions_reponses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thematique_id" "uuid" NOT NULL,
    "question" "text" NOT NULL,
    "question_en" "text" DEFAULT ''::"text" NOT NULL,
    "brief_qr" "text" NOT NULL,
    "brief_qr_en" "text" DEFAULT ''::"text" NOT NULL,
    "position" smallint DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."bibliotheque_questions_reponses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bibliotheque_thematiques" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" NOT NULL,
    "label_en" "text" DEFAULT ''::"text" NOT NULL,
    "position" smallint DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_url" "text" DEFAULT ''::"text" NOT NULL,
    "icon_url" "text" DEFAULT ''::"text" NOT NULL
);


ALTER TABLE "public"."bibliotheque_thematiques" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."boutiques" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text" NOT NULL,
    "code" "text" NOT NULL,
    "adresse" "text",
    "actif" boolean DEFAULT true NOT NULL,
    "retail_shop_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "boutiques_code_check" CHECK (("code" ~ '^[A-Z0-9]{2,4}$'::"text")),
    CONSTRAINT "boutiques_nom_check" CHECK (("btrim"("nom") <> ''::"text"))
);


ALTER TABLE "public"."boutiques" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."brief.crm" (
    "id" bigint NOT NULL,
    "customer" "uuid",
    "activite" "text",
    "canal_vente" "text",
    "surface" numeric,
    "villle" "text",
    "pays" "text",
    "vintage" boolean,
    "depuis" numeric,
    "budget" numeric,
    "source" "text",
    "format" "text",
    "hiver_vent" "text",
    "ete_vent" "text",
    "hiver_search" "text",
    "ete_search" "text",
    "style_homme" "text",
    "style_femme" "text",
    "note" "text"
);


ALTER TABLE "public"."brief.crm" OWNER TO "postgres";


ALTER TABLE "public"."brief.crm" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."brief.crm_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."brief_cat" (
    "id" bigint NOT NULL,
    "type" "text",
    "categorie" "text",
    "available" boolean,
    CONSTRAINT "brief_cat_categorie_check" CHECK ((("categorie" IS NULL) OR ("categorie" = ANY (ARRAY['plateformes'::"text", 'provenances'::"text", 'localisations'::"text", 'produits'::"text", 'marques'::"text", 'styles'::"text", 'matieres'::"text", 'budgets'::"text", 'horizons'::"text", 'experiences'::"text"]))))
);


ALTER TABLE "public"."brief_cat" OWNER TO "postgres";


ALTER TABLE "public"."brief_cat" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."brief_cat_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."calendar_sync_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "connection_id" "uuid" NOT NULL,
    "sync_type" character varying(50),
    "status" character varying(50),
    "events_synced" integer DEFAULT 0,
    "conflicts_resolved" integer DEFAULT 0,
    "error_message" "text",
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."calendar_sync_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."calendar_sync_logs" IS 'Logs de synchronisation pour débogage et monitoring';



CREATE TABLE IF NOT EXISTS "public"."calendar_sync_mappings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "nokk_project_event_id" "uuid" NOT NULL,
    "outlook_event_id" character varying(255) NOT NULL,
    "outlook_change_key" character varying(255),
    "connection_id" "uuid" NOT NULL,
    "last_synced_at" timestamp with time zone,
    "nokk_project_updated_at" timestamp with time zone,
    "outlook_updated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "apple_event_uid" "text",
    "apple_last_modified" "text",
    "apple_connection_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "apple_event_path" "text",
    "local_last_modified" "text"
);


ALTER TABLE "public"."calendar_sync_mappings" OWNER TO "postgres";


COMMENT ON TABLE "public"."calendar_sync_mappings" IS 'Mapping bidirectionnel entre événements Nokk_project et Outlook';



CREATE TABLE IF NOT EXISTS "public"."cartons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "livraison_id" "uuid" NOT NULL,
    "palette_id" "uuid",
    "numero" integer NOT NULL,
    "category_id" "uuid" NOT NULL,
    "poids_kg_prevu" numeric(10,2) NOT NULL,
    "statut" "text" DEFAULT 'prepare'::"text" NOT NULL,
    "etat" "text",
    "poids_kg_recu" numeric(10,2),
    "recu_at" timestamp with time zone,
    "recu_par" "uuid",
    "note_reception" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "cartons_etat_check" CHECK ((("etat" IS NULL) OR ("etat" = ANY (ARRAY['conforme'::"text", 'ecart_poids'::"text", 'endommage'::"text", 'mauvaise_categorie'::"text", 'manquant'::"text"])))),
    CONSTRAINT "cartons_numero_check" CHECK (("numero" > 0)),
    CONSTRAINT "cartons_poids_kg_prevu_check" CHECK (("poids_kg_prevu" > (0)::numeric)),
    CONSTRAINT "cartons_poids_kg_recu_check" CHECK ((("poids_kg_recu" IS NULL) OR ("poids_kg_recu" >= (0)::numeric))),
    CONSTRAINT "cartons_statut_check" CHECK (("statut" = ANY (ARRAY['prepare'::"text", 'expedie'::"text", 'recu_conforme'::"text", 'recu_ecart'::"text", 'manquant'::"text"])))
);


ALTER TABLE "public"."cartons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories_gestion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tag" "text",
    "unit_price" numeric,
    "unit_weight" numeric
);


ALTER TABLE "public"."categories_gestion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories_handpick" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "tag" "text",
    "unit_price" numeric,
    "unit_weight" numeric,
    "is_active" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."categories_handpick" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category_price_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category_id" "uuid",
    "category_name" "text",
    "user_id" "uuid",
    "old_price" numeric,
    "new_price" numeric NOT NULL
);


ALTER TABLE "public"."category_price_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."changelog_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "color" "text",
    "icon" "text",
    "position" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."changelog_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."changelog_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "version_id" "uuid",
    "category_id" "uuid",
    "title" "text",
    "description" "text",
    "position" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."changelog_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."changelog_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "version" "text",
    "deployment_date" "date",
    "status" "public"."changelog_version_status",
    "summary" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."changelog_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_amelia_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "event_id" "uuid",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "full_name" "text",
    "societe" "text",
    "telephone" "text",
    "mail" "text",
    "brief" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."client_amelia_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_crm" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer" "uuid",
    "nom" "text",
    "societe" "text",
    "mail" "text",
    "telephone" "text",
    "localisation" "text",
    "commandes" "text",
    "depense" numeric,
    "siret" "text",
    "collum" numeric,
    "brief" "jsonb",
    "insta" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "message" "text",
    "prise_en_charge" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "closers" "uuid",
    "adresse_facturation" "text",
    "adresse_livraison" "jsonb",
    "numero_TVA" "text",
    "mail_2" "text",
    "telephone_2" "text",
    "urgency" "text",
    "newsletter" boolean DEFAULT false NOT NULL,
    "newsletter_updated_at" timestamp with time zone
);


ALTER TABLE "public"."client_crm" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_newsletter_sends" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "subject" "text" NOT NULL,
    "message" "text" NOT NULL,
    "sent_by" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "recipient_count" integer DEFAULT 0 NOT NULL,
    "sent_count" integer DEFAULT 0 NOT NULL,
    "failed_count" integer DEFAULT 0 NOT NULL,
    "error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    CONSTRAINT "client_newsletter_sends_status_check" CHECK (("status" = ANY (ARRAY['sending'::"text", 'done'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."client_newsletter_sends" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commande_lignes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "commande_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "poids_kg_demande" numeric(10,2) NOT NULL,
    "note" "text",
    CONSTRAINT "commande_lignes_poids_kg_demande_check" CHECK (("poids_kg_demande" > (0)::numeric))
);


ALTER TABLE "public"."commande_lignes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commandes_boutique" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero" bigint NOT NULL,
    "boutique_id" "uuid" NOT NULL,
    "date_souhaitee" "date",
    "statut" "text" DEFAULT 'ouverte'::"text" NOT NULL,
    "motif_cloture" "text",
    "note" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commandes_boutique_statut_check" CHECK (("statut" = ANY (ARRAY['ouverte'::"text", 'en_cours'::"text", 'soldee'::"text", 'annulee'::"text"])))
);


ALTER TABLE "public"."commandes_boutique" OWNER TO "postgres";


ALTER TABLE "public"."commandes_boutique" ALTER COLUMN "numero" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."commandes_boutique_numero_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."content_generation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "instagram_post" "text",
    "tiktok_post" "text",
    "linkedin_post" "text",
    "video_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "analyze" "text",
    CONSTRAINT "content_generation_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."content_generation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."created_chat" (
    "id_chat" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "with_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "created_chat_users_different" CHECK (("created_by" <> "with_id"))
);


ALTER TABLE "public"."created_chat" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."crm_produit_recherche_monthly_stats" (
    "id" bigint NOT NULL,
    "snapshot_month" "date",
    "product_name" "text",
    "total_entries" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."crm_produit_recherche_monthly_stats" OWNER TO "postgres";


ALTER TABLE "public"."crm_produit_recherche_monthly_stats" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."crm_produit_recherche_monthly_stats_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."crm_produit_recherche_stats" (
    "id" bigint NOT NULL,
    "snapshot_month" "date" NOT NULL,
    "total_entries" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."crm_produit_recherche_stats" OWNER TO "postgres";


ALTER TABLE "public"."crm_produit_recherche_stats" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."crm_produit_recherche_stats_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."cryptedmessage" (
    "id" bigint NOT NULL,
    "chat_id" "text" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "recipient_id" "uuid",
    "ciphertext_b64" "text",
    "iv_b64" "text",
    "content_encrypted" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read" boolean,
    "deleted_at" timestamp with time zone,
    "reply_to_id" bigint
);


ALTER TABLE "public"."cryptedmessage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cryptedmessage_autopassphrase" (
    "user_id" "uuid",
    "passphrase" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cryptedmessage_autopassphrase" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cryptedmessage_group_members" (
    "group_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "last_read_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "cryptedmessage_group_members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text"])))
);

ALTER TABLE ONLY "public"."cryptedmessage_group_members" REPLICA IDENTITY FULL;


ALTER TABLE "public"."cryptedmessage_group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cryptedmessage_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "avatar_url" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cryptedmessage_groups" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."cryptedmessage_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."cryptedmessage_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."cryptedmessage_id_seq" OWNED BY "public"."cryptedmessage"."id";



CREATE TABLE IF NOT EXISTS "public"."cryptedmessage_keybundles" (
    "user_id" "uuid" NOT NULL,
    "bundle" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cryptedmessage_keybundles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cryptedmessage_shared_exportkeys" (
    "user_id" "uuid" NOT NULL,
    "encrypted_export_key" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cryptedmessage_shared_exportkeys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cryptedmessage_userkeys" (
    "user_id" "uuid" NOT NULL,
    "pubkey" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cryptedmessage_userkeys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dashboard_layout_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "role_id" "uuid",
    "service_id" "uuid",
    "layout" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dashboard_layout_templates" OWNER TO "postgres";


COMMENT ON TABLE "public"."dashboard_layout_templates" IS 'Disposition de dashboard par défaut pour un rôle ou un service. Écriture sous dashboard.templates.manage.';



CREATE TABLE IF NOT EXISTS "public"."deliveries_gestion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "din" "text",
    "fournisseur_id" "uuid",
    "delivery_date" "date",
    "delivery_type" "text",
    "balles_count" numeric,
    "poids_moyen" numeric,
    "packing" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."deliveries_gestion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."description_corrections" (
    "id" bigint NOT NULL,
    "description_origine" "text",
    "description_corrigee" "text",
    "origine_key" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."description_corrections" OWNER TO "postgres";


ALTER TABLE "public"."description_corrections" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."description_corrections_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."direct_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_a" "uuid" NOT NULL,
    "user_b" "uuid" NOT NULL,
    "user_low" "uuid" GENERATED ALWAYS AS (LEAST("user_a", "user_b")) STORED,
    "user_high" "uuid" GENERATED ALWAYS AS (GREATEST("user_a", "user_b")) STORED,
    "matrix_room_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "direct_conversations_users_different" CHECK (("user_a" <> "user_b"))
);


ALTER TABLE "public"."direct_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emplacements_handpick" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "zone_id" "uuid",
    "code" "text",
    "label" "text",
    "pos_x" numeric,
    "pos_y" numeric,
    "width" numeric,
    "height" numeric,
    "capacity" numeric,
    "is_active" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."emplacements_handpick" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emplacements_magasin" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "magasin_id" "uuid",
    "zone_id" "uuid",
    "code" "text",
    "label" "text",
    "pos_x" numeric,
    "pos_y" numeric,
    "width" numeric,
    "height" numeric,
    "rotation" numeric,
    "notes" "text",
    "is_active" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."emplacements_magasin" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipements_magasin" (
    "groupe" "text",
    "descend" boolean DEFAULT false,
    "zone_id" "uuid",
    "forme" "jsonb",
    "etage_id" "uuid" NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "magasin_id" "uuid",
    "kind" "text",
    "code" "text",
    "label" "text",
    "pos_x" numeric,
    "pos_y" numeric,
    "width" numeric,
    "height" numeric,
    "rotation" numeric,
    "is_active" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "equipements_magasin_forme_polygon" CHECK ((("forme" IS NULL) OR (("jsonb_typeof"("forme") = 'array'::"text") AND ("jsonb_array_length"("forme") >= 3)))),
    CONSTRAINT "equipements_magasin_kind_valid" CHECK (("kind" = ANY (ARRAY['caisse'::"text", 'entree'::"text", 'sortie'::"text", 'entree_sortie'::"text", 'escalier'::"text", 'escalier_colimacon'::"text", 'mannequin'::"text"])))
);


ALTER TABLE "public"."equipements_magasin" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."etages_magasin" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "magasin_id" "uuid",
    "nom" "text",
    "niveau" numeric,
    "contour" "jsonb",
    "fond_path" "text",
    "fond_x" numeric,
    "fond_y" numeric,
    "fond_largeur" numeric,
    "fond_profondeur" numeric,
    "fond_opacite" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."etages_magasin" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."factures" (
    "id" bigint NOT NULL,
    "date" "date",
    "invoice_no" "text",
    "container_no" "text",
    "location" "text",
    "invoice_total" numeric,
    "shipping_charges" numeric,
    "total_invoice_value" numeric,
    "total_invoice_usd" numeric,
    "convert_rate_thb_usd" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."factures" OWNER TO "postgres";


ALTER TABLE "public"."factures" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."factures_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."fiches_tri" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero" bigint NOT NULL,
    "date_tri" "date" DEFAULT CURRENT_DATE NOT NULL,
    "trieur_id" "uuid" NOT NULL,
    "heure_debut" time without time zone,
    "heure_fin" time without time zone,
    "duree_minutes" integer GENERATED ALWAYS AS (((EXTRACT("epoch" FROM ("heure_fin" - "heure_debut")) / (60)::numeric))::integer) STORED,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "fiches_tri_horaires_check" CHECK (((("heure_debut" IS NULL) AND ("heure_fin" IS NULL)) OR (("heure_debut" IS NOT NULL) AND ("heure_fin" IS NOT NULL) AND ("heure_fin" > "heure_debut"))))
);


ALTER TABLE "public"."fiches_tri" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fiches_tri_balles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fiche_id" "uuid" NOT NULL,
    "ordre" integer DEFAULT 0 NOT NULL,
    "fournisseur_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "poids_initial_kg" numeric(10,2) NOT NULL,
    "qualite" smallint NOT NULL,
    "note" "text",
    CONSTRAINT "fiches_tri_balles_poids_initial_kg_check" CHECK (("poids_initial_kg" > (0)::numeric)),
    CONSTRAINT "fiches_tri_balles_qualite_check" CHECK ((("qualite" >= 1) AND ("qualite" <= 3)))
);


ALTER TABLE "public"."fiches_tri_balles" OWNER TO "postgres";


ALTER TABLE "public"."fiches_tri" ALTER COLUMN "numero" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."fiches_tri_numero_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."fiches_tri_repartition" (
    "balle_id" "uuid" NOT NULL,
    "sortie_id" "uuid" NOT NULL,
    "poids_kg" numeric(10,2) NOT NULL,
    CONSTRAINT "fiches_tri_repartition_poids_kg_check" CHECK (("poids_kg" > (0)::numeric))
);


ALTER TABLE "public"."fiches_tri_repartition" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flux_handpick" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "direction" "text" NOT NULL,
    "status" "text" DEFAULT 'planifié'::"text" NOT NULL,
    "fournisseur_id" "uuid",
    "departure_date" "date",
    "prev_dechargement_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "type" "text",
    "poids_kg" numeric,
    CONSTRAINT "flux_handpick_direction_valid" CHECK (("direction" = ANY (ARRAY['in'::"text", 'out'::"text"]))),
    CONSTRAINT "flux_handpick_poids_positive" CHECK ((("poids_kg" IS NULL) OR ("poids_kg" >= (0)::numeric))),
    CONSTRAINT "flux_handpick_status_valid" CHECK (("status" = ANY (ARRAY['planifié'::"text", 'en_transit'::"text", 'déchargé'::"text", 'reçu'::"text", 'annulé'::"text"])))
);


ALTER TABLE "public"."flux_handpick" OWNER TO "postgres";


COMMENT ON TABLE "public"."flux_handpick" IS 'En-tête d''un arrivage ou d''un départ du stock handpick. Ses lignes (la liste de colisage) sont dans mouvements_handpick.flux_id.';



COMMENT ON COLUMN "public"."flux_handpick"."prev_dechargement_at" IS 'Déchargement prévu. Date de référence du tableau : elle pilote le tri, le groupement par mois, le surlignage des prochains arrivages et l''alerte facture.';



CREATE TABLE IF NOT EXISTS "public"."fournisseur" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "id_livraison" "text",
    "name" "text",
    "quality" numeric
);


ALTER TABLE "public"."fournisseur" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fournisseur_gestion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "siege_localisation" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tag" "text"
);


ALTER TABLE "public"."fournisseur_gestion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fournisseurs_categories_handpick" (
    "fournisseur_id" "uuid",
    "category_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."fournisseurs_categories_handpick" OWNER TO "postgres";


COMMENT ON TABLE "public"."fournisseurs_categories_handpick" IS 'Catégories proposées par chaque fournisseur du stock handpick. Restreint les choix des formulaires de saisie de balle ; la cohérence est vérifiée en base par le trigger balles_handpick_check_fournisseur_category.';



CREATE TABLE IF NOT EXISTS "public"."fournisseurs_handpick" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "siege_localisation" "text",
    "tag" "text",
    "notes" "text",
    "is_active" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."fournisseurs_handpick" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gallery_permissions" (
    "picture_id" "uuid",
    "user_id" "uuid",
    "can_view" boolean,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gallery_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gallery_pictures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid",
    "filename" "text",
    "url" "text",
    "title" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "mime_type" "text",
    "size_bytes" numeric,
    "is_folder" boolean DEFAULT false,
    "parent_id" "uuid",
    "deleted_at" timestamp with time zone
);


ALTER TABLE "public"."gallery_pictures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gestion_arrivage_packing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "arrivage_id" "uuid",
    "reference" "text",
    "description" "text",
    "quantity" numeric,
    "weight_kg" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gestion_arrivage_packing" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gestion_arrivage_row" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "din" "text",
    "fournisseur_id" "uuid",
    "category_id" "uuid",
    "delivery_type" "public"."arrivage_type",
    "status" "public"."arrivage_status",
    "expected_date" "date",
    "received_date" "date",
    "balles_count" numeric,
    "palettes_count" numeric,
    "livraison_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gestion_arrivage_row" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_read_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid",
    "user_id" "uuid",
    "last_read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."group_read_receipts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groupe_participant" (
    "id" bigint NOT NULL,
    "group_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "participant" "uuid" DEFAULT "gen_random_uuid"()
);


ALTER TABLE "public"."groupe_participant" OWNER TO "postgres";


ALTER TABLE "public"."groupe_participant" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."groupe_participant_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."groups" REPLICA IDENTITY FULL;


ALTER TABLE "public"."groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."items" (
    "id" bigint NOT NULL,
    "facture_id" bigint,
    "item_no" numeric,
    "description" "text",
    "unite" "text"
);


ALTER TABLE "public"."items" OWNER TO "postgres";


ALTER TABLE "public"."items" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."journal_entry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sell_at" timestamp with time zone,
    "service" "text",
    "commercial" "text",
    "sales" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."journal_entry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kpis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "value" numeric NOT NULL,
    "previous_value" numeric DEFAULT 0 NOT NULL,
    "change_percentage" numeric DEFAULT 0 NOT NULL,
    "period" "text" NOT NULL,
    "category" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."kpis" REPLICA IDENTITY FULL;


ALTER TABLE "public"."kpis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" bigint NOT NULL,
    "name" "text",
    "email" "text",
    "phone" "text",
    "message" "text",
    "location" "text",
    "activity" "text",
    "experience" "text",
    "arrivance" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "budget" "text",
    "distance_km" numeric,
    "city_found" "text",
    "urgency" "text"
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


ALTER TABLE "public"."leads" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."leads_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."livraisons_boutique" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero" bigint NOT NULL,
    "commande_id" "uuid",
    "boutique_id" "uuid" NOT NULL,
    "statut" "text" DEFAULT 'planifiee'::"text" NOT NULL,
    "date_preparation_prevue" "date",
    "date_expedition_prevue" "date",
    "date_livraison_prevue" "date",
    "expediee_at" timestamp with time zone,
    "expediee_par" "uuid",
    "receptionnee_at" timestamp with time zone,
    "note" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "livraisons_boutique_statut_check" CHECK (("statut" = ANY (ARRAY['planifiee'::"text", 'preparation'::"text", 'expediee'::"text", 'en_reception'::"text", 'receptionnee'::"text", 'litige'::"text", 'annulee'::"text"])))
);


ALTER TABLE "public"."livraisons_boutique" OWNER TO "postgres";


ALTER TABLE "public"."livraisons_boutique" ALTER COLUMN "numero" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."livraisons_boutique_numero_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."logs_crm" (
    "id" bigint NOT NULL,
    "change_at" timestamp with time zone,
    "changed_by" "uuid",
    "row_id" "uuid",
    "table_name" "text",
    "operation" "text",
    "old_data" "text",
    "new_data" "text"
);


ALTER TABLE "public"."logs_crm" OWNER TO "postgres";


ALTER TABLE "public"."logs_crm" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."logs_crm_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."magasins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text",
    "nom" "text",
    "adresse" "text",
    "ville" "text",
    "largeur" numeric,
    "profondeur" numeric,
    "notes" "text",
    "is_active" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "retail_shop_id" "uuid",
    "retail_published_at" timestamp with time zone
);


ALTER TABLE "public"."magasins" OWNER TO "postgres";


COMMENT ON COLUMN "public"."magasins"."retail_shop_id" IS 'shops.id de la console retail (base séparée : pas de FK).';



COMMENT ON COLUMN "public"."magasins"."retail_published_at" IS 'Dernière publication du plan vers retail ; null = jamais publié.';



CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid",
    "player1_id" "uuid",
    "player2_id" "uuid",
    "player1_score" integer DEFAULT 0,
    "player2_score" integer DEFAULT 0,
    "winner_id" "uuid",
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "played_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "elo_applied" boolean DEFAULT false NOT NULL,
    "round_number" integer DEFAULT 1 NOT NULL,
    "match_index" integer DEFAULT 0 NOT NULL,
    "player1_source_match_id" "uuid",
    "player2_source_match_id" "uuid",
    "score_details" "jsonb",
    CONSTRAINT "matches_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'in_progress'::"text", 'completed'::"text"])))
);

ALTER TABLE ONLY "public"."matches" REPLICA IDENTITY FULL;


ALTER TABLE "public"."matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content" "text" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "recipient_id" "uuid",
    "group_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ciphertext_b64" "text",
    "encrypted_key_b64" "text",
    "iv_b64" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb",
    "files" "text",
    "read" boolean,
    "chat_id" "uuid",
    "groupe_id" "uuid",
    "content_encrypted" "text",
    CONSTRAINT "messages_target_check" CHECK (((("recipient_id" IS NOT NULL) AND ("group_id" IS NULL)) OR (("recipient_id" IS NULL) AND ("group_id" IS NOT NULL))))
);

ALTER TABLE ONLY "public"."messages" REPLICA IDENTITY FULL;


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messaging_favorites" (
    "user_id" "uuid",
    "target_user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."messaging_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mouvements_handpick" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "balle_id" "uuid",
    "balle_label" "text",
    "category_id" "uuid",
    "quantity" numeric(12,3) DEFAULT 0 NOT NULL,
    "quantity_unit" "text" DEFAULT 'kg'::"text" NOT NULL,
    "emplacement_from_id" "uuid",
    "emplacement_to_id" "uuid",
    "unit_price" numeric(12,4),
    "total_value" numeric(16,4) GENERATED ALWAYS AS (("quantity" * COALESCE("unit_price", (0)::numeric))) STORED,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "flux_id" "uuid" NOT NULL,
    CONSTRAINT "mouvements_handpick_emplacements_differ" CHECK ((("emplacement_from_id" IS NULL) OR ("emplacement_to_id" IS NULL) OR ("emplacement_from_id" <> "emplacement_to_id"))),
    CONSTRAINT "mouvements_handpick_has_subject" CHECK ((("balle_id" IS NOT NULL) OR (("category_id" IS NOT NULL) AND ("quantity" > (0)::numeric)))),
    CONSTRAINT "mouvements_handpick_quantity_positive" CHECK (("quantity" >= (0)::numeric)),
    CONSTRAINT "mouvements_handpick_quantity_unit_valid" CHECK (("quantity_unit" = ANY (ARRAY['kg'::"text", 'pieces'::"text"]))),
    CONSTRAINT "mouvements_handpick_unit_price_positive" CHECK ((("unit_price" IS NULL) OR ("unit_price" >= (0)::numeric)))
);


ALTER TABLE "public"."mouvements_handpick" OWNER TO "postgres";


COMMENT ON COLUMN "public"."mouvements_handpick"."flux_id" IS 'Expédition à laquelle appartient cette ligne de colisage.';



CREATE TABLE IF NOT EXISTS "public"."murs_magasin" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "magasin_id" "uuid",
    "etage_id" "uuid",
    "points" "jsonb" DEFAULT '{}'::"jsonb",
    "epaisseur" numeric,
    "hauteur" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."murs_magasin" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."new_ticket" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "title" "text",
    "description" "text",
    "status" "text",
    "created_by" "uuid",
    "assigned_to" "uuid",
    "priority" "text",
    "last_updated" "text",
    "from" "text",
    "category" "text"
);


ALTER TABLE "public"."new_ticket" OWNER TO "postgres";


ALTER TABLE "public"."new_ticket" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."new_ticket_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."newsletter_api_logs" (
    "id" bigint NOT NULL,
    "ts" timestamp with time zone,
    "level" "text",
    "msg" "text",
    "req_id" "text",
    "method" "text",
    "path" "text",
    "status" numeric,
    "duration_ms" numeric,
    "attrs" "jsonb"
);


ALTER TABLE "public"."newsletter_api_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."newsletter_api_logs" IS 'Lignes slog du service newsletter-console (requêtes HTTP et étapes du pipeline).';



ALTER TABLE "public"."newsletter_api_logs" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."newsletter_api_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."newsletter_invitation_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "label" "text",
    "created_by" "uuid" NOT NULL,
    "used_by" "uuid",
    "used_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."newsletter_invitation_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."newsletter_send_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "run_id" "uuid",
    "user_id" "uuid",
    "email" "text",
    "status" "text",
    "error" "text",
    "xlsx_size_bytes" numeric,
    "excel_ms" numeric,
    "smtp_ms" numeric,
    "changed_cells" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."newsletter_send_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."newsletter_send_events" IS 'Détail par destinataire d''un run newsletter : statut, erreur SMTP, durées.';



CREATE TABLE IF NOT EXISTS "public"."newsletter_send_runs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trigger" "text",
    "triggered_by" "uuid",
    "started_at" timestamp with time zone,
    "finished_at" timestamp with time zone,
    "status" "text",
    "rows_count" numeric,
    "subscribers_total" numeric,
    "sent_count" numeric,
    "failed_count" numeric,
    "duration_ms" numeric,
    "error" "text"
);


ALTER TABLE "public"."newsletter_send_runs" OWNER TO "postgres";


COMMENT ON TABLE "public"."newsletter_send_runs" IS 'Historique des exécutions du pipeline newsletter arrivages (écrit par newsletter-console).';



CREATE TABLE IF NOT EXISTS "public"."newsletter_subscriptions" (
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "visible_columns" "jsonb" DEFAULT '["container_no", "fournisseur_name", "status", "transport_mode", "departure_date", "port_arrival_date", "prev_dechargement_at", "total_weight_kg", "total_qty", "invoice_date"]'::"jsonb" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "arrivage" boolean,
    "crm_stat" boolean
);


ALTER TABLE "public"."newsletter_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text",
    "title" "text",
    "read" boolean,
    "url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "icon" "text"
);


ALTER TABLE "public"."notification" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outlook_connections" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "token_expires_at" timestamp with time zone NOT NULL,
    "email" character varying(255) NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ews_email" "text",
    "ews_url" "text",
    "last_sync_at" timestamp with time zone,
    "ews_password_encrypted" "text"
);


ALTER TABLE "public"."outlook_connections" OWNER TO "postgres";


COMMENT ON TABLE "public"."outlook_connections" IS 'Stocke les connexions OAuth des utilisateurs avec Microsoft Outlook';



CREATE TABLE IF NOT EXISTS "public"."outlook_webhook_subscriptions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "connection_id" "uuid" NOT NULL,
    "subscription_id" character varying(255) NOT NULL,
    "resource" character varying(500),
    "expires_at" timestamp with time zone NOT NULL,
    "notification_url" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."outlook_webhook_subscriptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."outlook_webhook_subscriptions" IS 'Subscriptions aux webhooks Microsoft Graph pour sync temps réel';



CREATE TABLE IF NOT EXISTS "public"."packages" (
    "id" bigint NOT NULL,
    "item_id" bigint,
    "kgs" numeric,
    "pcs" numeric,
    "qty" numeric,
    "total_pcs_kg" numeric,
    "unit_price" numeric,
    "total" numeric,
    "total_avec_livraison" numeric
);


ALTER TABLE "public"."packages" OWNER TO "postgres";


ALTER TABLE "public"."packages" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."packages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."packing_label_category" (
    "raw_label_key" "text" NOT NULL,
    "normalizer_version" smallint DEFAULT 2 NOT NULL,
    "raw_label_sample" "text" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "hit_count" integer DEFAULT 1 NOT NULL,
    "last_container_label" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "packing_label_category_hit_count_check" CHECK (("hit_count" >= 0))
);


ALTER TABLE "public"."packing_label_category" OWNER TO "postgres";


COMMENT ON TABLE "public"."packing_label_category" IS 'Libellé fournisseur normalisé → catégorie. Alimenté par la validation d''une packing list ; consulté à l''import pour retenir une catégorie sans relecture.';



CREATE TABLE IF NOT EXISTS "public"."packing_label_feedback" (
    "packing_list_ligne_id" "uuid" NOT NULL,
    "packing_list_id" "uuid" NOT NULL,
    "raw_label_key" "text" NOT NULL,
    "normalizer_version" smallint NOT NULL,
    "category_id" "uuid" NOT NULL,
    "suggested_category_id" "uuid",
    "suggestion_source" "text",
    "suggested_confidence" numeric,
    "decision" "text" NOT NULL,
    "decided_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "packing_label_feedback_decision_check" CHECK (("decision" = ANY (ARRAY['explicit'::"text", 'implicit'::"text"]))),
    CONSTRAINT "packing_label_feedback_suggested_confidence_check" CHECK ((("suggested_confidence" IS NULL) OR (("suggested_confidence" >= (0)::numeric) AND ("suggested_confidence" <= (1)::numeric)))),
    CONSTRAINT "packing_label_feedback_suggestion_source_check" CHECK ((("suggestion_source" IS NULL) OR ("suggestion_source" = ANY (ARRAY['dictionary'::"text", 'model'::"text", 'name'::"text"]))))
);


ALTER TABLE "public"."packing_label_feedback" OWNER TO "postgres";


COMMENT ON TABLE "public"."packing_label_feedback" IS 'Décisions humaines sur les lignes de packing, avec la proposition affichée à ce moment. Entraîne et calibre le classement de packing-api. Écrite par trigger uniquement.';



CREATE TABLE IF NOT EXISTS "public"."packing_list" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "arrivage_manuel_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'en_traitement'::"text" NOT NULL,
    "source_filename" "text",
    "error_message" "text",
    "imported_by" "uuid" DEFAULT "auth"."uid"(),
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "validated_by" "uuid",
    "validated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "declared_package_count" integer,
    "container_label" "text",
    "source_sheet" "text",
    "classifier_meta" "jsonb",
    CONSTRAINT "packing_list_declared_package_count_check" CHECK ((("declared_package_count" IS NULL) OR ("declared_package_count" >= 0))),
    CONSTRAINT "packing_list_status_check" CHECK (("status" = ANY (ARRAY['en_traitement'::"text", 'a_verifier'::"text", 'validee'::"text", 'echec'::"text"]))),
    CONSTRAINT "packing_list_validated_consistency" CHECK ((("status" = 'validee'::"text") = ("validated_at" IS NOT NULL)))
);


ALTER TABLE "public"."packing_list" OWNER TO "postgres";


COMMENT ON COLUMN "public"."packing_list"."declared_package_count" IS 'Total de colis annoncé par le fichier lui-même (pied de page).';



COMMENT ON COLUMN "public"."packing_list"."container_label" IS 'Titre lu en tête du fichier, à rapprocher de arrivage_manuel.container_no.';



COMMENT ON COLUMN "public"."packing_list"."classifier_meta" IS 'État du classement au moment de l''import : version, seuil calibré, précision mesurée, exemples, répartition des lignes.';



CREATE TABLE IF NOT EXISTS "public"."packing_list_ligne" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "packing_list_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "raw_label" "text" NOT NULL,
    "raw_label_key" "text" NOT NULL,
    "raw_row" "jsonb",
    "suggested_category_id" "uuid",
    "match_confidence" numeric,
    "category_id" "uuid",
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "package_count" integer,
    "units_per_package" numeric,
    "unit_kind" "text",
    "declared_total" numeric,
    "source_row" integer,
    "resolution" "text",
    "normalizer_version" smallint DEFAULT 2 NOT NULL,
    "suggestion_source" "text",
    CONSTRAINT "packing_list_ligne_declared_total_check" CHECK ((("declared_total" IS NULL) OR ("declared_total" >= (0)::numeric))),
    CONSTRAINT "packing_list_ligne_match_confidence_check" CHECK ((("match_confidence" IS NULL) OR (("match_confidence" >= (0)::numeric) AND ("match_confidence" <= (1)::numeric)))),
    CONSTRAINT "packing_list_ligne_package_count_check" CHECK ((("package_count" IS NULL) OR ("package_count" >= 0))),
    CONSTRAINT "packing_list_ligne_resolution_check" CHECK ((("resolution" IS NULL) OR ("resolution" = ANY (ARRAY['dictionary'::"text", 'model'::"text", 'human'::"text"])))),
    CONSTRAINT "packing_list_ligne_suggestion_source_check" CHECK ((("suggestion_source" IS NULL) OR ("suggestion_source" = ANY (ARRAY['dictionary'::"text", 'model'::"text", 'name'::"text"])))),
    CONSTRAINT "packing_list_ligne_unit_kind_check" CHECK ((("unit_kind" IS NULL) OR ("unit_kind" = ANY (ARRAY['pcs'::"text", 'kgs'::"text"])))),
    CONSTRAINT "packing_list_ligne_units_per_package_check" CHECK ((("units_per_package" IS NULL) OR ("units_per_package" >= (0)::numeric)))
);


ALTER TABLE "public"."packing_list_ligne" OWNER TO "postgres";


COMMENT ON COLUMN "public"."packing_list_ligne"."package_count" IS 'Colonne QTY du fichier : nombre de colis. Seule grandeur additive.';



COMMENT ON COLUMN "public"."packing_list_ligne"."units_per_package" IS 'Contenu d''un colis : pièces si unit_kind = pcs, kilos si unit_kind = kgs.';



COMMENT ON COLUMN "public"."packing_list_ligne"."declared_total" IS 'Colonne TOTAL PCS/KG telle que lue, sans recalcul. NULL = absente du fichier.';



COMMENT ON COLUMN "public"."packing_list_ligne"."resolution" IS 'NULL = suggestion non retenue. dictionary = libellé déjà validé. model = classée par le modèle sous garde calibrée. human = arbitrage humain.';



COMMENT ON COLUMN "public"."packing_list_ligne"."suggestion_source" IS 'Provenance de suggested_category_id : dictionary (correspondance exacte), model (appris), name (nom de catégorie, au démarrage).';



CREATE TABLE IF NOT EXISTS "public"."pake_credentials" (
    "user_id" "uuid",
    "cred_id" "uuid",
    "client_id" "uuid",
    "record" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pake_credentials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pake_server_params" (
    "id" bigint NOT NULL,
    "config" "text",
    "server_id" "uuid",
    "server_public_key" "text",
    "server_private_key" "text",
    "oprf_seed" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pake_server_params" OWNER TO "postgres";


ALTER TABLE "public"."pake_server_params" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."pake_server_params_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."palettes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "livraison_id" "uuid" NOT NULL,
    "numero" integer NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "palettes_numero_check" CHECK (("numero" > 0))
);


ALTER TABLE "public"."palettes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text",
    "label" "text",
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pg_net_watchdog_state" (
    "id" boolean DEFAULT true NOT NULL,
    "last_min_id" bigint,
    "last_progress_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_restart_at" timestamp with time zone,
    "restart_count" integer DEFAULT 0 NOT NULL,
    "stall_streak" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "pg_net_watchdog_state_id_check" CHECK ("id")
);


ALTER TABLE "public"."pg_net_watchdog_state" OWNER TO "postgres";


COMMENT ON TABLE "public"."pg_net_watchdog_state" IS 'État du watchdog pg_net (ligne unique). Sert à comparer deux passages du cron pour distinguer une file qui avance d''une file bloquée.';



CREATE TABLE IF NOT EXISTS "public"."ping_pong_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "elo_rating" integer DEFAULT 500 NOT NULL,
    "wins" integer DEFAULT 0 NOT NULL,
    "losses" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."ping_pong_players" REPLICA IDENTITY FULL;


ALTER TABLE "public"."ping_pong_players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plan_layout_handpick" (
    "id" "text" NOT NULL,
    "layout" "jsonb" DEFAULT '{}'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid"
);


ALTER TABLE "public"."plan_layout_handpick" OWNER TO "postgres";


COMMENT ON TABLE "public"."plan_layout_handpick" IS 'Disposition du plan de l''entrepôt handpick (onglet Plan), en JSON. Géométrie seule : les emplacements adressables restent dans zones_handpick / emplacements_handpick.';



CREATE TABLE IF NOT EXISTS "public"."product" (
    "id" bigint NOT NULL,
    "type" "uuid",
    "stock" numeric,
    "price" numeric,
    "name" "text",
    "categorie" "text",
    "sales" numeric,
    "description" "text",
    "fournisseur" "uuid",
    "facturation" "text"
);


ALTER TABLE "public"."product" OWNER TO "postgres";


ALTER TABLE "public"."product" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."product_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."product_image" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "data" "text"
);


ALTER TABLE "public"."product_image" OWNER TO "postgres";


ALTER TABLE "public"."product_image" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."product_image_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "role" "text" DEFAULT 'Employé'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "avatar_url" "text",
    "last_login" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role_id" "uuid",
    "service_id" "uuid",
    "privacy_accepted_at" timestamp with time zone,
    "privacy_accepted_version" "text",
    "archived_at" timestamp with time zone,
    "phone" "text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['SuperAdmin'::"text", 'Admin'::"text", 'Market'::"text", 'Compta'::"text", 'Employé'::"text"]))),
    CONSTRAINT "profiles_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'pending'::"text"])))
);

ALTER TABLE ONLY "public"."profiles" REPLICA IDENTITY FULL;


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."archived_at" IS 'Non NULL = utilisateur supprimé (compte auth détruit). Le profil est conservé pour la traçabilité ; les listes applicatives filtrent sur IS NULL.';



CREATE TABLE IF NOT EXISTS "public"."project_sprints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "goal" "text",
    "status" "public"."project_sprint_status" DEFAULT 'planned'::"public"."project_sprint_status" NOT NULL,
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."project_sprints" REPLICA IDENTITY FULL;


ALTER TABLE "public"."project_sprints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_task_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "size_bytes" bigint DEFAULT 0 NOT NULL,
    "uploaded_by" "uuid" DEFAULT "auth"."uid"(),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_task_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sprint_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "status" "public"."project_task_status" DEFAULT 'todo'::"public"."project_task_status" NOT NULL,
    "assignee_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "due_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "priority" "public"."Priorities",
    "last_moved_by" "uuid",
    "last_moved_at" timestamp with time zone
);

ALTER TABLE ONLY "public"."project_tasks" REPLICA IDENTITY FULL;


ALTER TABLE "public"."project_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."project_team_members" REPLICA IDENTITY FULL;


ALTER TABLE "public"."project_team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "public"."project_team_status" DEFAULT 'active'::"public"."project_team_status" NOT NULL
);

ALTER TABLE ONLY "public"."project_teams" REPLICA IDENTITY FULL;


ALTER TABLE "public"."project_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "endpoint" "text",
    "subscription" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "device_id" "uuid",
    "device_secret" "text"
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rdv_reschedule_mail_queue" (
    "event_id" "uuid" NOT NULL,
    "send_after" timestamp with time zone NOT NULL,
    "queued_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rdv_reschedule_mail_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."rdv_reschedule_mail_queue" IS 'Notifications de changement d''horaire en attente. Une ligne par RDV : chaque modification repousse send_after, si bien qu''une série d''ajustements au drag & drop ne produit qu''un seul mail, avec l''horaire final. Vidée par le cron rdv-reschedule-mail.';



CREATE TABLE IF NOT EXISTS "public"."results" (
    "key" "text",
    "html" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text" NOT NULL,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles_permissions" (
    "role_id" "uuid",
    "permission_id" "uuid"
);


ALTER TABLE "public"."roles_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text" NOT NULL,
    "permissions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services_permissions" (
    "service_id" "uuid",
    "permission_id" "uuid"
);


ALTER TABLE "public"."services_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sorting_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "fournisseur_uid" "uuid",
    "time" "text",
    "quantity" numeric,
    "comments" "text",
    "quality" numeric,
    "uid_balle" "uuid",
    "category" "text",
    "mag_piece" numeric,
    "export_piece" numeric,
    "client_piece" numeric,
    "so3_piece" numeric,
    "kssummer_piece" numeric,
    "kswinter_piece" numeric,
    "mag_kg" numeric,
    "export_kg" numeric,
    "client_kg" numeric,
    "so3_kg" numeric,
    "kssummer_kg" numeric,
    "kswinter_kg" numeric,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sorting_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sync_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "crm_event_id" "uuid",
    "wp_block_id" bigint,
    "item_type" "text",
    "synced_at" timestamp with time zone
);


ALTER TABLE "public"."sync_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tableau_devis" (
    "id_tab" numeric,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "number" numeric,
    "produit" "text",
    "description" "text",
    "qty" numeric,
    "poid" numeric,
    "prix" numeric,
    "totalHT" numeric,
    "TVA" numeric,
    "mode" "text"
);


ALTER TABLE "public"."tableau_devis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_chat_table" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid",
    "assigned_user" "uuid",
    "owner_user" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "closed_at" timestamp with time zone
);


ALTER TABLE "public"."ticket_chat_table" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_message" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "send_by" "uuid",
    "chat_id" "uuid",
    "text" "text",
    "joint" "jsonb"
);


ALTER TABLE "public"."ticket_message" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_table" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "title" "text",
    "description" "text",
    "status" "text",
    "created_by" "uuid",
    "assigned_to" "uuid",
    "priority" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "from" "text",
    "category" "text",
    "type" "text"
);


ALTER TABLE "public"."ticket_table" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "assigned_to" "uuid",
    "service" "text" NOT NULL,
    "subject" "text" NOT NULL,
    "description" "text" NOT NULL,
    "status" "text" DEFAULT 'Envoyé'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "close_reason" "text",
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "tickets_service_check" CHECK (("service" = ANY (ARRAY['Tech'::"text", 'Commerce'::"text", 'Informatique'::"text", 'RH'::"text"]))),
    CONSTRAINT "tickets_status_check" CHECK (("status" = ANY (ARRAY['Envoyé'::"text", 'Reçu'::"text", 'Traité'::"text", 'Terminé'::"text", 'Refusé'::"text"])))
);

ALTER TABLE ONLY "public"."tickets" REPLICA IDENTITY FULL;


ALTER TABLE "public"."tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournament_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tournament_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "seed" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE ONLY "public"."tournament_participants" REPLICA IDENTITY FULL;


ALTER TABLE "public"."tournament_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tournaments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "start_date" timestamp with time zone NOT NULL,
    "end_date" timestamp with time zone,
    "status" "text" DEFAULT 'upcoming'::"text" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "points_per_game" integer DEFAULT 11 NOT NULL,
    "games_per_set" integer DEFAULT 3 NOT NULL,
    "sets_to_win" integer DEFAULT 2 NOT NULL,
    CONSTRAINT "tournaments_status_check" CHECK (("status" = ANY (ARRAY['upcoming'::"text", 'active'::"text", 'completed'::"text"])))
);

ALTER TABLE ONLY "public"."tournaments" REPLICA IDENTITY FULL;


ALTER TABLE "public"."tournaments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tri_sorties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "libelle" "text" NOT NULL,
    "ordre" integer DEFAULT 0 NOT NULL,
    "actif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tri_sorties_code_check" CHECK (("btrim"("code") <> ''::"text")),
    CONSTRAINT "tri_sorties_libelle_check" CHECK (("btrim"("libelle") <> ''::"text"))
);


ALTER TABLE "public"."tri_sorties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trieurs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text" NOT NULL,
    "actif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trieurs_nom_check" CHECK (("btrim"("nom") <> ''::"text"))
);


ALTER TABLE "public"."trieurs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_calendar_connections" (
    "source_type" "text",
    "connection_id" "uuid",
    "user_id" "uuid",
    "email" "text",
    "is_active" boolean,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."user_calendar_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_crm_analytics_layout" (
    "user_id" "uuid" NOT NULL,
    "section_order" "jsonb" DEFAULT '["header", "kpis", "charts"]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_crm_analytics_layout_shape" CHECK (("jsonb_typeof"("section_order") = 'array'::"text"))
);


ALTER TABLE "public"."user_crm_analytics_layout" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_crm_analytics_layout" IS 'Ordre des sections (Header/KPIs/Charts) de l''onglet CRM Analytics, propre à un utilisateur. Absence de ligne = ordre par défaut ["header","kpis","charts"].';



CREATE TABLE IF NOT EXISTS "public"."user_dashboard_layout" (
    "user_id" "uuid",
    "layout" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_dashboard_layout" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_dashboard_layout" IS 'Disposition du dashboard propre à un utilisateur. Absence de ligne = il suit le gabarit de son rôle/service.';



CREATE TABLE IF NOT EXISTS "public"."user_keys" (
    "user_id" "uuid",
    "device_id" "uuid",
    "pubkey" "jsonb" DEFAULT '{}'::"jsonb",
    "encrypted_privkey" "text",
    "iv" "text",
    "kdf" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_keys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_preferences" (
    "user_id" "uuid" NOT NULL,
    "theme" "text" DEFAULT 'system'::"text" NOT NULL,
    "push_enabled" boolean DEFAULT true NOT NULL,
    "notify_ticket" boolean DEFAULT true NOT NULL,
    "notify_message" boolean DEFAULT true NOT NULL,
    "notify_system" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_preferences_theme_check" CHECK (("theme" = ANY (ARRAY['light'::"text", 'dark'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."user_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "permission_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."users_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."v_arrivages" (
    "container_no" "text",
    "facture_id" bigint,
    "arrivee_depart_id" bigint,
    "invoice_no" "text",
    "invoice_date" "date",
    "invoice_total" numeric,
    "shipping_charges" numeric,
    "total_invoice_value" numeric,
    "total_invoice_usd" numeric,
    "convert_rate_thb_usd" numeric,
    "location" "text",
    "origin_country" "text",
    "origin_location" "text",
    "transport_mode" "text",
    "departure_date" "date",
    "port_arrival_date" "date",
    "prev_dechargement_jour" "text",
    "prev_dechargement_date" "date",
    "prev_dechargement_heure" "text",
    "total_weight_kg" numeric,
    "total_qty" numeric,
    "status" "text",
    "fournisseur_id" "uuid",
    "docked_at" timestamp with time zone,
    "received_date" "date",
    "notes" "text",
    "livraison_id" "uuid",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "prev_dechargement_libre" "text",
    "reference_interne" "text",
    "kind" "text",
    "conteneur_no_raw" "text",
    "mode_raw" "text",
    "invoice_items_count" numeric,
    "invoice_total_qty" numeric
);


ALTER TABLE "public"."v_arrivages" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_cartons" WITH ("security_invoker"='true') AS
 SELECT "c"."id",
    "c"."livraison_id",
    "c"."palette_id",
    "c"."numero",
    "c"."category_id",
    "c"."poids_kg_prevu",
    "c"."statut",
    "c"."etat",
    "c"."poids_kg_recu",
    "c"."recu_at",
    "c"."recu_par",
    "c"."note_reception",
    "c"."created_at",
    (("public"."code_livraison"("l"."numero") || '-C'::"text") || "lpad"(("c"."numero")::"text", 2, '0'::"text")) AS "code",
        CASE
            WHEN ("p"."id" IS NULL) THEN NULL::"text"
            ELSE (("public"."code_livraison"("l"."numero") || '-P'::"text") || "p"."numero")
        END AS "palette_code",
    "p"."numero" AS "palette_numero",
    "l"."numero" AS "livraison_numero",
    "l"."statut" AS "livraison_statut",
    "l"."boutique_id",
    "l"."commande_id",
    COALESCE("cat"."name", '?'::"text") AS "category_nom",
        CASE
            WHEN ("c"."etat" = 'ecart_poids'::"text") THEN "abs"(("c"."poids_kg_prevu" - COALESCE("c"."poids_kg_recu", "c"."poids_kg_prevu")))
            WHEN ("c"."etat" = ANY (ARRAY['manquant'::"text", 'mauvaise_categorie'::"text", 'endommage'::"text"])) THEN "c"."poids_kg_prevu"
            ELSE (0)::numeric
        END AS "ecart_kg"
   FROM ((("public"."cartons" "c"
     JOIN "public"."livraisons_boutique" "l" ON (("l"."id" = "c"."livraison_id")))
     JOIN "public"."categories_gestion" "cat" ON (("cat"."id" = "c"."category_id")))
     LEFT JOIN "public"."palettes" "p" ON (("p"."id" = "c"."palette_id")));


ALTER VIEW "public"."v_cartons" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_commande_avancement" WITH ("security_invoker"='true') AS
 SELECT "cl"."id" AS "ligne_id",
    "cl"."commande_id",
    "cl"."category_id",
    COALESCE("cat"."name", '?'::"text") AS "category_nom",
    "cl"."poids_kg_demande" AS "kg_demande",
    COALESCE("m"."kg_prepare", (0)::numeric) AS "kg_prepare",
    COALESCE("m"."kg_expedie", (0)::numeric) AS "kg_expedie",
    COALESCE("m"."kg_recu", (0)::numeric) AS "kg_recu",
    COALESCE("m"."kg_manquant", (0)::numeric) AS "kg_manquant",
    GREATEST(((("cl"."poids_kg_demande" - COALESCE("m"."kg_prepare", (0)::numeric)) - COALESCE("m"."kg_expedie", (0)::numeric)) - COALESCE("m"."kg_recu", (0)::numeric)), (0)::numeric) AS "kg_reste"
   FROM (("public"."commande_lignes" "cl"
     JOIN "public"."categories_gestion" "cat" ON (("cat"."id" = "cl"."category_id")))
     LEFT JOIN LATERAL ( SELECT "sum"("c"."poids_kg_prevu") FILTER (WHERE ("c"."statut" = 'prepare'::"text")) AS "kg_prepare",
            "sum"("c"."poids_kg_prevu") FILTER (WHERE ("c"."statut" = 'expedie'::"text")) AS "kg_expedie",
            "sum"(COALESCE("c"."poids_kg_recu", "c"."poids_kg_prevu")) FILTER (WHERE (("c"."statut" = ANY (ARRAY['recu_conforme'::"text", 'recu_ecart'::"text"])) AND ("c"."etat" IS DISTINCT FROM 'mauvaise_categorie'::"text"))) AS "kg_recu",
            "sum"("c"."poids_kg_prevu") FILTER (WHERE (("c"."statut" = 'manquant'::"text") OR ("c"."etat" = 'mauvaise_categorie'::"text"))) AS "kg_manquant"
           FROM ("public"."cartons" "c"
             JOIN "public"."livraisons_boutique" "l" ON (("l"."id" = "c"."livraison_id")))
          WHERE (("l"."commande_id" = "cl"."commande_id") AND ("l"."statut" <> 'annulee'::"text") AND ("c"."category_id" = "cl"."category_id"))) "m" ON (true));


ALTER VIEW "public"."v_commande_avancement" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_commandes_boutique" WITH ("security_invoker"='true') AS
 SELECT "cmd"."id",
    "cmd"."numero",
    "cmd"."boutique_id",
    "cmd"."date_souhaitee",
    "cmd"."statut",
    "cmd"."motif_cloture",
    "cmd"."note",
    "cmd"."created_by",
    "cmd"."created_at",
    "cmd"."updated_at",
    "public"."code_commande"("cmd"."numero") AS "code",
    "b"."nom" AS "boutique_nom",
    "b"."code" AS "boutique_code",
    COALESCE("av"."kg_demande", (0)::numeric) AS "kg_demande",
    COALESCE("av"."kg_prepare", (0)::numeric) AS "kg_prepare",
    COALESCE("av"."kg_expedie", (0)::numeric) AS "kg_expedie",
    COALESCE("av"."kg_recu", (0)::numeric) AS "kg_recu",
    COALESCE("av"."kg_reste", (0)::numeric) AS "kg_reste",
    COALESCE("av"."nb_lignes", (0)::bigint) AS "nb_lignes",
    COALESCE("lv"."nb_livraisons", (0)::bigint) AS "nb_livraisons",
    "lv"."derniere_livraison_at"
   FROM ((("public"."commandes_boutique" "cmd"
     JOIN "public"."boutiques" "b" ON (("b"."id" = "cmd"."boutique_id")))
     LEFT JOIN LATERAL ( SELECT "sum"("v"."kg_demande") AS "kg_demande",
            "sum"("v"."kg_prepare") AS "kg_prepare",
            "sum"("v"."kg_expedie") AS "kg_expedie",
            "sum"("v"."kg_recu") AS "kg_recu",
            "sum"("v"."kg_reste") AS "kg_reste",
            "count"(*) AS "nb_lignes"
           FROM "public"."v_commande_avancement" "v"
          WHERE ("v"."commande_id" = "cmd"."id")) "av" ON (true))
     LEFT JOIN LATERAL ( SELECT "count"(*) AS "nb_livraisons",
            "max"(COALESCE("l"."expediee_at", "l"."created_at")) AS "derniere_livraison_at"
           FROM "public"."livraisons_boutique" "l"
          WHERE (("l"."commande_id" = "cmd"."id") AND ("l"."statut" <> 'annulee'::"text"))) "lv" ON (true));


ALTER VIEW "public"."v_commandes_boutique" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_fiches_tri_balles" WITH ("security_invoker"='true') AS
 SELECT "b"."id",
    "b"."fiche_id",
    "b"."ordre",
    "b"."fournisseur_id",
    "b"."category_id",
    "b"."poids_initial_kg",
    "b"."qualite",
    "b"."note",
    "fo"."name" AS "fournisseur_nom",
    COALESCE("r"."reparti_kg", (0)::numeric) AS "poids_reparti_kg",
    (COALESCE("r"."reparti_kg", (0)::numeric) - "b"."poids_initial_kg") AS "ecart_kg"
   FROM (("public"."fiches_tri_balles" "b"
     LEFT JOIN "public"."fournisseur_gestion" "fo" ON (("fo"."id" = "b"."fournisseur_id")))
     LEFT JOIN LATERAL ( SELECT "sum"("rp"."poids_kg") AS "reparti_kg"
           FROM "public"."fiches_tri_repartition" "rp"
          WHERE ("rp"."balle_id" = "b"."id")) "r" ON (true));


ALTER VIEW "public"."v_fiches_tri_balles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_fiches_tri" WITH ("security_invoker"='true') AS
 SELECT "f"."id",
    "f"."numero",
    "f"."date_tri",
    "f"."trieur_id",
    "f"."heure_debut",
    "f"."heure_fin",
    "f"."duree_minutes",
    "f"."created_by",
    "f"."created_at",
    "f"."updated_at",
    ('T-'::"text" || "lpad"(("f"."numero")::"text", 4, '0'::"text")) AS "code",
    "t"."nom" AS "trieur_nom",
    COALESCE("agg"."fournisseur_ids", '{}'::"uuid"[]) AS "fournisseur_ids",
    "agg"."fournisseurs_noms",
    COALESCE("agg"."poids_initial_kg", (0)::numeric) AS "poids_initial_kg",
    COALESCE("agg"."poids_reparti_kg", (0)::numeric) AS "poids_reparti_kg",
    COALESCE("agg"."ecart_kg", (0)::numeric) AS "ecart_kg",
    COALESCE("agg"."nb_balles", (0)::bigint) AS "nb_balles",
    COALESCE("agg"."nb_balles_ecart", (0)::bigint) AS "nb_balles_ecart",
    "agg"."qualite_moyenne"
   FROM (("public"."fiches_tri" "f"
     JOIN "public"."trieurs" "t" ON (("t"."id" = "f"."trieur_id")))
     LEFT JOIN LATERAL ( SELECT "array_agg"(DISTINCT "b"."fournisseur_id") AS "fournisseur_ids",
            "string_agg"(DISTINCT "b"."fournisseur_nom", ', '::"text") AS "fournisseurs_noms",
            "sum"("b"."poids_initial_kg") AS "poids_initial_kg",
            "sum"("b"."poids_reparti_kg") AS "poids_reparti_kg",
            "sum"("b"."ecart_kg") AS "ecart_kg",
            "count"(*) AS "nb_balles",
            "count"(*) FILTER (WHERE ("abs"("b"."ecart_kg") >= 0.01)) AS "nb_balles_ecart",
            "round"(("sum"(("b"."poids_initial_kg" * ("b"."qualite")::numeric)) / NULLIF("sum"("b"."poids_initial_kg"), (0)::numeric)), 2) AS "qualite_moyenne"
           FROM "public"."v_fiches_tri_balles" "b"
          WHERE ("b"."fiche_id" = "f"."id")) "agg" ON (true));


ALTER VIEW "public"."v_fiches_tri" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_livraisons_boutique" WITH ("security_invoker"='true') AS
 SELECT "l"."id",
    "l"."numero",
    "l"."commande_id",
    "l"."boutique_id",
    "l"."statut",
    "l"."date_preparation_prevue",
    "l"."date_expedition_prevue",
    "l"."date_livraison_prevue",
    "l"."expediee_at",
    "l"."expediee_par",
    "l"."receptionnee_at",
    "l"."note",
    "l"."created_by",
    "l"."created_at",
    "l"."updated_at",
    "public"."code_livraison"("l"."numero") AS "code",
    "b"."nom" AS "boutique_nom",
    "b"."code" AS "boutique_code",
        CASE
            WHEN ("cmd"."id" IS NULL) THEN NULL::"text"
            ELSE "public"."code_commande"("cmd"."numero")
        END AS "commande_code",
    COALESCE("pal"."nb", (0)::bigint) AS "nb_palettes",
    COALESCE("agg"."nb_cartons", (0)::bigint) AS "nb_cartons",
    COALESCE("agg"."nb_recus", (0)::bigint) AS "nb_recus",
    COALESCE("agg"."nb_ecarts", (0)::bigint) AS "nb_ecarts",
    COALESCE("agg"."kg_prevu", (0)::numeric) AS "kg_prevu",
    COALESCE("agg"."kg_recu", (0)::numeric) AS "kg_recu",
    COALESCE("agg"."kg_ecart", (0)::numeric) AS "kg_ecart"
   FROM (((("public"."livraisons_boutique" "l"
     JOIN "public"."boutiques" "b" ON (("b"."id" = "l"."boutique_id")))
     LEFT JOIN "public"."commandes_boutique" "cmd" ON (("cmd"."id" = "l"."commande_id")))
     LEFT JOIN LATERAL ( SELECT "count"(*) AS "nb"
           FROM "public"."palettes" "p"
          WHERE ("p"."livraison_id" = "l"."id")) "pal" ON (true))
     LEFT JOIN LATERAL ( SELECT "count"(*) AS "nb_cartons",
            "count"(*) FILTER (WHERE ("vc"."statut" = ANY (ARRAY['recu_conforme'::"text", 'recu_ecart'::"text"]))) AS "nb_recus",
            "count"(*) FILTER (WHERE ("vc"."statut" = ANY (ARRAY['recu_ecart'::"text", 'manquant'::"text"]))) AS "nb_ecarts",
            "sum"("vc"."poids_kg_prevu") AS "kg_prevu",
            "sum"(COALESCE("vc"."poids_kg_recu", "vc"."poids_kg_prevu")) FILTER (WHERE (("vc"."statut" = ANY (ARRAY['recu_conforme'::"text", 'recu_ecart'::"text"])) AND ("vc"."etat" <> 'mauvaise_categorie'::"text"))) AS "kg_recu",
            "sum"("vc"."ecart_kg") AS "kg_ecart"
           FROM "public"."v_cartons" "vc"
          WHERE ("vc"."livraison_id" = "l"."id")) "agg" ON (true));


ALTER VIEW "public"."v_livraisons_boutique" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_packing_list_summary" AS
SELECT
    NULL::"uuid" AS "id",
    NULL::"uuid" AS "arrivage_manuel_id",
    NULL::"text" AS "status",
    NULL::"text" AS "source_filename",
    NULL::"text" AS "error_message",
    NULL::"uuid" AS "imported_by",
    NULL::timestamp with time zone AS "imported_at",
    NULL::"uuid" AS "validated_by",
    NULL::timestamp with time zone AS "validated_at",
    NULL::timestamp with time zone AS "created_at",
    NULL::timestamp with time zone AS "updated_at",
    NULL::integer AS "declared_package_count",
    NULL::"text" AS "container_label",
    NULL::"text" AS "source_sheet",
    NULL::"jsonb" AS "classifier_meta",
    NULL::integer AS "line_count",
    NULL::integer AS "lines_unmatched",
    NULL::integer AS "lines_from_dictionary",
    NULL::integer AS "lines_from_model",
    NULL::integer AS "lines_reviewed",
    NULL::integer AS "total_packages",
    NULL::numeric AS "total_pieces",
    NULL::numeric AS "total_weight_kg",
    NULL::integer AS "rows_failing_math",
    NULL::integer AS "package_count_gap";


ALTER VIEW "public"."v_packing_list_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_packing_list_summary" IS 'Synthèse d''une packing list. total_pieces et total_weight_kg retiennent le total déclaré par le fichier, et à défaut contenu par colis × nombre de colis — le fournisseur laisse la colonne TOTAL vide sur la plupart des lignes en kilos.';



CREATE TABLE IF NOT EXISTS "public"."v_users_mfa_status" (
    "id" "uuid",
    "email" "text",
    "created_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    "has_mfa_enrolled" boolean,
    "verified_factor_count" numeric,
    "verified_factor_types" "text"[]
);


ALTER TABLE "public"."v_users_mfa_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."watch_config" (
    "id" bigint NOT NULL,
    "name" "text",
    "topic" "text",
    "language" "text",
    "horizon" "text",
    "persona" "text",
    "active" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "service_ids" "uuid"[]
);


ALTER TABLE "public"."watch_config" OWNER TO "postgres";


COMMENT ON COLUMN "public"."watch_config"."service_ids" IS 'UUIDs des services pour lesquels cette configuration est active. NULL = tous les services';



ALTER TABLE "public"."watch_config" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."watch_config_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."wiki_article_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_id" "uuid",
    "user_id" "uuid",
    "viewed_at" timestamp with time zone,
    "dwell_ms" numeric,
    "completed" boolean DEFAULT false,
    "source" "text"
);


ALTER TABLE "public"."wiki_article_views" OWNER TO "postgres";


COMMENT ON TABLE "public"."wiki_article_views" IS 'Consultations d''articles du wiki (nominatif). Une ligne par ouverture ; dwell_ms/completed patchés à la fermeture. Rétention 6 mois via app_logs_retention_config.';



CREATE TABLE IF NOT EXISTS "public"."wiki_articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid",
    "title" "text",
    "slug" "text",
    "body" "text",
    "sections" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text",
    "position" numeric,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wiki_articles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."wiki_article_views_measured" WITH ("security_invoker"='true') AS
 SELECT "v"."id",
    "v"."article_id",
    "v"."user_id",
    "v"."viewed_at",
    "v"."dwell_ms",
    "v"."completed",
    "v"."source",
    "a"."title" AS "article_title",
    "a"."status" AS "article_status",
    "a"."category_id" AS "article_category_id"
   FROM ("public"."wiki_article_views" "v"
     JOIN "public"."wiki_articles" "a" ON (("a"."id" = "v"."article_id")))
  WHERE ("v"."user_id" IS DISTINCT FROM "a"."created_by");


ALTER VIEW "public"."wiki_article_views_measured" OWNER TO "postgres";


COMMENT ON VIEW "public"."wiki_article_views_measured" IS 'Consultations retenues pour la mesure d''audience : les auto-consultations d''un auteur sur son propre article sont exclues.';



CREATE TABLE IF NOT EXISTS "public"."wiki_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_id" "uuid",
    "name" "text",
    "position" numeric,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."wiki_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zones_handpick" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_id" "uuid",
    "kind" "text",
    "code" "text",
    "label" "text",
    "pos_x" numeric,
    "pos_y" numeric,
    "width" numeric,
    "height" numeric,
    "rotation" numeric,
    "color" "text",
    "sort_order" numeric,
    "is_active" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."zones_handpick" OWNER TO "postgres";


COMMENT ON TABLE "public"."zones_handpick" IS 'Conteneurs du plan de l''entrepôt handpick : zones, allées ET étagères, distinguées par la colonne `kind` et organisées en arbre via parent_id. Le nom retenu est celui du vocabulaire métier ; les feuilles adressables vivent dans emplacements_handpick.';



COMMENT ON COLUMN "public"."zones_handpick"."pos_x" IS 'Coordonnée relative au parent, en unités de plan. NULL = pas encore placé.';



CREATE TABLE IF NOT EXISTS "public"."zones_magasin" (
    "forme" "jsonb",
    "etage_id" "uuid" NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "magasin_id" "uuid",
    "parent_id" "uuid",
    "kind" "text",
    "code" "text",
    "label" "text",
    "pos_x" numeric,
    "pos_y" numeric,
    "width" numeric,
    "height" numeric,
    "rotation" numeric,
    "color" "text",
    "sort_order" numeric,
    "is_active" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "zones_magasin_forme_polygon" CHECK ((("forme" IS NULL) OR (("jsonb_typeof"("forme") = 'array'::"text") AND ("jsonb_array_length"("forme") >= 3))))
);


ALTER TABLE "public"."zones_magasin" OWNER TO "postgres";


ALTER TABLE ONLY "public"."cryptedmessage" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."cryptedmessage_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."Changelog"
    ADD CONSTRAINT "Changelog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Client_activite"
    ADD CONSTRAINT "Client_activite_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Devis"
    ADD CONSTRAINT "Devis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Event_calendar_Comm"
    ADD CONSTRAINT "Event_calendar_Comm_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Event_calendar"
    ADD CONSTRAINT "Event_calendar_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."Event_calendar"
    ADD CONSTRAINT "Event_calendar_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Fournisseur_crm"
    ADD CONSTRAINT "Fournisseur_crm_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."Fournisseur_crm"
    ADD CONSTRAINT "Fournisseur_crm_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Kanban_comm"
    ADD CONSTRAINT "Kanban_comm_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Maintenance"
    ADD CONSTRAINT "Maintenance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."News"
    ADD CONSTRAINT "News_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Tache_crm"
    ADD CONSTRAINT "Tache_crm_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."Type_product_CRM"
    ADD CONSTRAINT "Type_product_CRM_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."Type_product_CRM"
    ADD CONSTRAINT "Type_product_CRM_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_log_handpick"
    ADD CONSTRAINT "activity_log_handpick_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_watch_reports"
    ADD CONSTRAINT "ai_watch_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."amelia_availability_closures"
    ADD CONSTRAINT "amelia_availability_closures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."amelia_availability_days_off"
    ADD CONSTRAINT "amelia_availability_days_off_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."amelia_availability_special"
    ADD CONSTRAINT "amelia_availability_special_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."amelia_availability_weekly"
    ADD CONSTRAINT "amelia_availability_weekly_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."amelia_company_closures"
    ADD CONSTRAINT "amelia_company_closures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."amelia_company_days_off"
    ADD CONSTRAINT "amelia_company_days_off_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."amelia_company_special"
    ADD CONSTRAINT "amelia_company_special_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."amelia_company_weekly"
    ADD CONSTRAINT "amelia_company_weekly_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_export_collaborators"
    ADD CONSTRAINT "analytics_export_collaborators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_export_collaborators"
    ADD CONSTRAINT "analytics_export_collaborators_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."analyze_content_generation"
    ADD CONSTRAINT "analyze_content_generation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."annonce"
    ADD CONSTRAINT "annonce_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."annonce"
    ADD CONSTRAINT "annonce_type_check" CHECK (("type" = ANY (ARRAY['news'::"text", 'event'::"text", 'message'::"text", 'celebration'::"text", 'release'::"text"]))) NOT VALID;



ALTER TABLE ONLY "public"."app_logs"
    ADD CONSTRAINT "app_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_logs_retention_audit"
    ADD CONSTRAINT "app_logs_retention_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_logs_retention_config"
    ADD CONSTRAINT "app_logs_retention_config_pkey" PRIMARY KEY ("table_name");



ALTER TABLE ONLY "public"."app_maintenance"
    ADD CONSTRAINT "app_maintenance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."apple_calendar_connections"
    ADD CONSTRAINT "apple_calendar_connections_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."apple_calendar_connections"
    ADD CONSTRAINT "apple_calendar_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."arrivage_manuel"
    ADD CONSTRAINT "arrivage_manuel_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."arrivage_subscribers"
    ADD CONSTRAINT "arrivage_subscribers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."arrivage_subscribers"
    ADD CONSTRAINT "arrivage_subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."arrivees_departs"
    ADD CONSTRAINT "arrivees_departs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."balles_emplacements_handpick"
    ADD CONSTRAINT "balles_emplacements_handpick_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."balles_gestion"
    ADD CONSTRAINT "balles_gestion_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."balles_gestion"
    ADD CONSTRAINT "balles_gestion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."balles_handpick"
    ADD CONSTRAINT "balles_handpick_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."balles_handpick"
    ADD CONSTRAINT "balles_handpick_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."balles"
    ADD CONSTRAINT "balles_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."balles"
    ADD CONSTRAINT "balles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bibliotheque_brief"
    ADD CONSTRAINT "bibliotheque_brief_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bibliotheque_format_reponses"
    ADD CONSTRAINT "bibliotheque_format_reponses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bibliotheque_format_reponses"
    ADD CONSTRAINT "bibliotheque_format_reponses_quest_rep_id_key" UNIQUE ("quest_rep_id");



ALTER TABLE ONLY "public"."bibliotheque_questions_reponses"
    ADD CONSTRAINT "bibliotheque_questions_reponses_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."bibliotheque_questions_reponses"
    ADD CONSTRAINT "bibliotheque_questions_reponses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bibliotheque_thematiques"
    ADD CONSTRAINT "bibliotheque_thematiques_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."bibliotheque_thematiques"
    ADD CONSTRAINT "bibliotheque_thematiques_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boutiques"
    ADD CONSTRAINT "boutiques_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boutiques"
    ADD CONSTRAINT "boutiques_retail_shop_id_key" UNIQUE ("retail_shop_id");



ALTER TABLE ONLY "public"."brief.crm"
    ADD CONSTRAINT "brief.crm_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."brief_cat"
    ADD CONSTRAINT "brief_cat_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_sync_logs"
    ADD CONSTRAINT "calendar_sync_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_sync_mappings"
    ADD CONSTRAINT "calendar_sync_mappings_outlook_event_id_connection_id_key" UNIQUE ("outlook_event_id", "connection_id");



ALTER TABLE ONLY "public"."calendar_sync_mappings"
    ADD CONSTRAINT "calendar_sync_mappings_nokk_project_event_id_connection_id_key" UNIQUE ("nokk_project_event_id", "connection_id");



ALTER TABLE ONLY "public"."calendar_sync_mappings"
    ADD CONSTRAINT "calendar_sync_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cartons"
    ADD CONSTRAINT "cartons_livraison_id_numero_key" UNIQUE ("livraison_id", "numero");



ALTER TABLE ONLY "public"."cartons"
    ADD CONSTRAINT "cartons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories_gestion"
    ADD CONSTRAINT "categories_gestion_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."categories_gestion"
    ADD CONSTRAINT "categories_gestion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories_handpick"
    ADD CONSTRAINT "categories_handpick_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."categories_handpick"
    ADD CONSTRAINT "categories_handpick_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_price_history"
    ADD CONSTRAINT "category_price_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."changelog_categories"
    ADD CONSTRAINT "changelog_categories_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."changelog_categories"
    ADD CONSTRAINT "changelog_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."changelog_items"
    ADD CONSTRAINT "changelog_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."changelog_versions"
    ADD CONSTRAINT "changelog_versions_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."changelog_versions"
    ADD CONSTRAINT "changelog_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_amelia_submissions"
    ADD CONSTRAINT "client_amelia_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_crm"
    ADD CONSTRAINT "client_crm_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."client_crm"
    ADD CONSTRAINT "client_crm_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_newsletter_sends"
    ADD CONSTRAINT "client_newsletter_sends_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commande_lignes"
    ADD CONSTRAINT "commande_lignes_commande_id_category_id_key" UNIQUE ("commande_id", "category_id");



ALTER TABLE ONLY "public"."commande_lignes"
    ADD CONSTRAINT "commande_lignes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commandes_boutique"
    ADD CONSTRAINT "commandes_boutique_numero_key" UNIQUE ("numero");



ALTER TABLE ONLY "public"."commandes_boutique"
    ADD CONSTRAINT "commandes_boutique_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_generation"
    ADD CONSTRAINT "content_generation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."created_chat"
    ADD CONSTRAINT "created_chat_id_chat_uq" UNIQUE ("id_chat");



ALTER TABLE ONLY "public"."created_chat"
    ADD CONSTRAINT "created_chat_pkey" PRIMARY KEY ("id_chat");



ALTER TABLE ONLY "public"."crm_produit_recherche_monthly_stats"
    ADD CONSTRAINT "crm_produit_recherche_monthly_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_produit_recherche_stats"
    ADD CONSTRAINT "crm_produit_recherche_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_produit_recherche_stats"
    ADD CONSTRAINT "crm_produit_recherche_stats_snapshot_month_key" UNIQUE ("snapshot_month");



ALTER TABLE ONLY "public"."cryptedmessage_group_members"
    ADD CONSTRAINT "cryptedmessage_group_members_pkey" PRIMARY KEY ("group_id", "user_id");



ALTER TABLE ONLY "public"."cryptedmessage_groups"
    ADD CONSTRAINT "cryptedmessage_groups_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."cryptedmessage_groups"
    ADD CONSTRAINT "cryptedmessage_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cryptedmessage"
    ADD CONSTRAINT "cryptedmessage_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."cryptedmessage_keybundles"
    ADD CONSTRAINT "cryptedmessage_keybundles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."cryptedmessage"
    ADD CONSTRAINT "cryptedmessage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cryptedmessage_shared_exportkeys"
    ADD CONSTRAINT "cryptedmessage_shared_exportkeys_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."cryptedmessage_userkeys"
    ADD CONSTRAINT "cryptedmessage_userkeys_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."dashboard_layout_templates"
    ADD CONSTRAINT "dashboard_layout_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliveries_gestion"
    ADD CONSTRAINT "deliveries_gestion_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."deliveries_gestion"
    ADD CONSTRAINT "deliveries_gestion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."description_corrections"
    ADD CONSTRAINT "description_corrections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."direct_conversations"
    ADD CONSTRAINT "direct_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."direct_conversations"
    ADD CONSTRAINT "direct_conversations_user_pair_key" UNIQUE ("user_low", "user_high");



ALTER TABLE ONLY "public"."emplacements_handpick"
    ADD CONSTRAINT "emplacements_handpick_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."emplacements_handpick"
    ADD CONSTRAINT "emplacements_handpick_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emplacements_magasin"
    ADD CONSTRAINT "emplacements_magasin_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipements_magasin"
    ADD CONSTRAINT "equipements_magasin_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."etages_magasin"
    ADD CONSTRAINT "etages_magasin_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."etages_magasin"
    ADD CONSTRAINT "etages_magasin_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."factures"
    ADD CONSTRAINT "factures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fiches_tri_balles"
    ADD CONSTRAINT "fiches_tri_balles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fiches_tri"
    ADD CONSTRAINT "fiches_tri_numero_key" UNIQUE ("numero");



ALTER TABLE ONLY "public"."fiches_tri"
    ADD CONSTRAINT "fiches_tri_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fiches_tri_repartition"
    ADD CONSTRAINT "fiches_tri_repartition_pkey" PRIMARY KEY ("balle_id", "sortie_id");



ALTER TABLE ONLY "public"."flux_handpick"
    ADD CONSTRAINT "flux_handpick_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."flux_handpick"
    ADD CONSTRAINT "flux_handpick_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fournisseur_gestion"
    ADD CONSTRAINT "fournisseur_gestion_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."fournisseur_gestion"
    ADD CONSTRAINT "fournisseur_gestion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fournisseur"
    ADD CONSTRAINT "fournisseur_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."fournisseur"
    ADD CONSTRAINT "fournisseur_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fournisseurs_handpick"
    ADD CONSTRAINT "fournisseurs_handpick_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."fournisseurs_handpick"
    ADD CONSTRAINT "fournisseurs_handpick_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gallery_pictures"
    ADD CONSTRAINT "gallery_pictures_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."gallery_pictures"
    ADD CONSTRAINT "gallery_pictures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gestion_arrivage_packing"
    ADD CONSTRAINT "gestion_arrivage_packing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gestion_arrivage_row"
    ADD CONSTRAINT "gestion_arrivage_row_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."gestion_arrivage_row"
    ADD CONSTRAINT "gestion_arrivage_row_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_read_receipts"
    ADD CONSTRAINT "group_read_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groupe_participant"
    ADD CONSTRAINT "groupe_participant_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."journal_entry"
    ADD CONSTRAINT "journal_entry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpis"
    ADD CONSTRAINT "kpis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."livraisons_boutique"
    ADD CONSTRAINT "livraisons_boutique_numero_key" UNIQUE ("numero");



ALTER TABLE ONLY "public"."livraisons_boutique"
    ADD CONSTRAINT "livraisons_boutique_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logs_crm"
    ADD CONSTRAINT "logs_crm_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."magasins"
    ADD CONSTRAINT "magasins_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."magasins"
    ADD CONSTRAINT "magasins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mouvements_handpick"
    ADD CONSTRAINT "mouvements_handpick_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."murs_magasin"
    ADD CONSTRAINT "murs_magasin_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."new_ticket"
    ADD CONSTRAINT "new_ticket_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletter_api_logs"
    ADD CONSTRAINT "newsletter_api_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletter_invitation_codes"
    ADD CONSTRAINT "newsletter_invitation_codes_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."newsletter_invitation_codes"
    ADD CONSTRAINT "newsletter_invitation_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletter_send_events"
    ADD CONSTRAINT "newsletter_send_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletter_send_runs"
    ADD CONSTRAINT "newsletter_send_runs_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."newsletter_send_runs"
    ADD CONSTRAINT "newsletter_send_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsletter_subscriptions"
    ADD CONSTRAINT "newsletter_subscriptions_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."notification"
    ADD CONSTRAINT "notification_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outlook_connections"
    ADD CONSTRAINT "outlook_connections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outlook_connections"
    ADD CONSTRAINT "outlook_connections_user_id_email_key" UNIQUE ("user_id", "email");



ALTER TABLE ONLY "public"."outlook_webhook_subscriptions"
    ADD CONSTRAINT "outlook_webhook_subscriptions_connection_id_subscription_id_key" UNIQUE ("connection_id", "subscription_id");



ALTER TABLE ONLY "public"."outlook_webhook_subscriptions"
    ADD CONSTRAINT "outlook_webhook_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_label_category"
    ADD CONSTRAINT "packing_label_category_pkey" PRIMARY KEY ("raw_label_key");



ALTER TABLE ONLY "public"."packing_label_feedback"
    ADD CONSTRAINT "packing_label_feedback_pkey" PRIMARY KEY ("packing_list_ligne_id");



ALTER TABLE ONLY "public"."packing_list"
    ADD CONSTRAINT "packing_list_arrivage_manuel_id_key" UNIQUE ("arrivage_manuel_id");



ALTER TABLE ONLY "public"."packing_list_ligne"
    ADD CONSTRAINT "packing_list_ligne_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packing_list"
    ADD CONSTRAINT "packing_list_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pake_server_params"
    ADD CONSTRAINT "pake_server_params_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."palettes"
    ADD CONSTRAINT "palettes_livraison_id_numero_key" UNIQUE ("livraison_id", "numero");



ALTER TABLE ONLY "public"."palettes"
    ADD CONSTRAINT "palettes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pg_net_watchdog_state"
    ADD CONSTRAINT "pg_net_watchdog_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ping_pong_players"
    ADD CONSTRAINT "ping_pong_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plan_layout_handpick"
    ADD CONSTRAINT "plan_layout_handpick_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_image"
    ADD CONSTRAINT "product_image_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product"
    ADD CONSTRAINT "product_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_uq" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."project_sprints"
    ADD CONSTRAINT "project_sprints_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."project_sprints"
    ADD CONSTRAINT "project_sprints_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_task_attachments"
    ADD CONSTRAINT "project_task_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_task_attachments"
    ADD CONSTRAINT "project_task_attachments_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."project_tasks"
    ADD CONSTRAINT "project_tasks_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."project_tasks"
    ADD CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_team_members"
    ADD CONSTRAINT "project_team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_team_members"
    ADD CONSTRAINT "project_team_members_team_id_user_id_key" UNIQUE ("team_id", "user_id");



ALTER TABLE ONLY "public"."project_teams"
    ADD CONSTRAINT "project_teams_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."project_teams"
    ADD CONSTRAINT "project_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rdv_reschedule_mail_queue"
    ADD CONSTRAINT "rdv_reschedule_mail_queue_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_nom_key" UNIQUE ("nom");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_nom_key" UNIQUE ("nom");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sorting_reports"
    ADD CONSTRAINT "sorting_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sync_history"
    ADD CONSTRAINT "sync_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tableau_devis"
    ADD CONSTRAINT "tableau_devis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_chat_table"
    ADD CONSTRAINT "ticket_chat_table_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."ticket_chat_table"
    ADD CONSTRAINT "ticket_chat_table_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_message"
    ADD CONSTRAINT "ticket_message_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_table"
    ADD CONSTRAINT "ticket_table_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."ticket_table"
    ADD CONSTRAINT "ticket_table_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournament_participants"
    ADD CONSTRAINT "tournament_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."tournaments"
    ADD CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tri_sorties"
    ADD CONSTRAINT "tri_sorties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trieurs"
    ADD CONSTRAINT "trieurs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_crm_analytics_layout"
    ADD CONSTRAINT "user_crm_analytics_layout_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."users_permissions"
    ADD CONSTRAINT "users_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."watch_config"
    ADD CONSTRAINT "watch_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wiki_article_views"
    ADD CONSTRAINT "wiki_article_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wiki_articles"
    ADD CONSTRAINT "wiki_articles_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."wiki_articles"
    ADD CONSTRAINT "wiki_articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."wiki_categories"
    ADD CONSTRAINT "wiki_categories_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."wiki_categories"
    ADD CONSTRAINT "wiki_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zones_handpick"
    ADD CONSTRAINT "zones_handpick_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."zones_handpick"
    ADD CONSTRAINT "zones_handpick_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zones_magasin"
    ADD CONSTRAINT "zones_magasin_id_uq" UNIQUE ("id");



ALTER TABLE ONLY "public"."zones_magasin"
    ADD CONSTRAINT "zones_magasin_pkey" PRIMARY KEY ("id");



CREATE INDEX "analytics_export_collaborators_order_idx" ON "public"."analytics_export_collaborators" USING "btree" ("group_index", "member_index");



CREATE INDEX "annonce_active_idx" ON "public"."annonce" USING "btree" ("pinned" DESC, "start_date" DESC) WHERE ("archived_at" IS NULL);



CREATE UNIQUE INDEX "app_maintenance_feature_uniq" ON "public"."app_maintenance" USING "btree" ("feature_key") WHERE ("scope" = 'feature'::"text");



CREATE UNIQUE INDEX "app_maintenance_global_uniq" ON "public"."app_maintenance" USING "btree" ("scope") WHERE ("scope" = 'global'::"text");



CREATE INDEX "arrivage_subscribers_active_idx" ON "public"."arrivage_subscribers" USING "btree" ("active") WHERE ("active" = true);



CREATE INDEX "bibliotheque_questions_reponses_thematique_id_idx" ON "public"."bibliotheque_questions_reponses" USING "btree" ("thematique_id", "position");



CREATE UNIQUE INDEX "bibliotheque_thematiques_icon_url_uidx" ON "public"."bibliotheque_thematiques" USING "btree" ("icon_url") WHERE ("icon_url" <> ''::"text");



CREATE UNIQUE INDEX "bibliotheque_thematiques_image_url_uidx" ON "public"."bibliotheque_thematiques" USING "btree" ("image_url") WHERE ("image_url" <> ''::"text");



CREATE INDEX "bibliotheque_thematiques_position_idx" ON "public"."bibliotheque_thematiques" USING "btree" ("position", "created_at");



CREATE UNIQUE INDEX "boutiques_code_unique" ON "public"."boutiques" USING "btree" ("code");



CREATE INDEX "brief_cat_categorie_available_idx" ON "public"."brief_cat" USING "btree" ("categorie", "available");



CREATE INDEX "cartons_category_idx" ON "public"."cartons" USING "btree" ("category_id");



CREATE INDEX "cartons_livraison_idx" ON "public"."cartons" USING "btree" ("livraison_id");



CREATE INDEX "client_amelia_submissions_client_idx" ON "public"."client_amelia_submissions" USING "btree" ("client_id", "submitted_at" DESC);



CREATE INDEX "client_crm_closers_collum_idx" ON "public"."client_crm" USING "btree" ("closers", "collum");



CREATE INDEX "client_crm_closers_collum_updated_at_idx" ON "public"."client_crm" USING "btree" ("closers", "collum", "updated_at" DESC);



CREATE INDEX "client_crm_collum_idx" ON "public"."client_crm" USING "btree" ("collum");



CREATE INDEX "client_crm_collum_updated_at_idx" ON "public"."client_crm" USING "btree" ("collum", "updated_at" DESC);



CREATE INDEX "client_crm_customer_collum_idx" ON "public"."client_crm" USING "btree" ("customer", "collum");



CREATE INDEX "client_crm_customer_collum_updated_at_idx" ON "public"."client_crm" USING "btree" ("customer", "collum", "updated_at" DESC);



CREATE INDEX "client_crm_newsletter_idx" ON "public"."client_crm" USING "btree" ("id") WHERE "newsletter";



CREATE INDEX "client_newsletter_sends_created_at_idx" ON "public"."client_newsletter_sends" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "client_newsletter_sends_one_sending_idx" ON "public"."client_newsletter_sends" USING "btree" ("status") WHERE ("status" = 'sending'::"text");



CREATE INDEX "commandes_boutique_boutique_idx" ON "public"."commandes_boutique" USING "btree" ("boutique_id");



CREATE UNIQUE INDEX "dashboard_layout_templates_role_uniq" ON "public"."dashboard_layout_templates" USING "btree" ("role_id") WHERE ("role_id" IS NOT NULL);



CREATE UNIQUE INDEX "dashboard_layout_templates_service_uniq" ON "public"."dashboard_layout_templates" USING "btree" ("service_id") WHERE ("service_id" IS NOT NULL);



CREATE INDEX "direct_conversations_user_pair_idx" ON "public"."direct_conversations" USING "btree" ("user_low", "user_high");



CREATE INDEX "event_calendar_customer_debut_idx" ON "public"."Event_calendar" USING "btree" ("customer", "debut");



CREATE INDEX "event_calendar_debut_idx" ON "public"."Event_calendar" USING "btree" ("debut");



CREATE INDEX "event_calendar_id_client_idx" ON "public"."Event_calendar" USING "btree" ("id_client");



CREATE INDEX "event_calendar_unconfirmed_idx" ON "public"."Event_calendar" USING "btree" ("id_client") WHERE ("confirmed" = false);



CREATE INDEX "fiches_tri_balles_category_idx" ON "public"."fiches_tri_balles" USING "btree" ("category_id");



CREATE INDEX "fiches_tri_balles_fiche_idx" ON "public"."fiches_tri_balles" USING "btree" ("fiche_id");



CREATE INDEX "fiches_tri_balles_fournisseur_idx" ON "public"."fiches_tri_balles" USING "btree" ("fournisseur_id");



CREATE INDEX "fiches_tri_date_idx" ON "public"."fiches_tri" USING "btree" ("date_tri" DESC);



CREATE INDEX "fiches_tri_repartition_sortie_idx" ON "public"."fiches_tri_repartition" USING "btree" ("sortie_id");



CREATE INDEX "fiches_tri_trieur_idx" ON "public"."fiches_tri" USING "btree" ("trieur_id");



CREATE INDEX "idx_activity_log_handpick_created" ON "public"."activity_log_handpick" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_log_handpick_entity_id" ON "public"."activity_log_handpick" USING "btree" ("entity_id");



CREATE INDEX "idx_activity_log_handpick_entity_type" ON "public"."activity_log_handpick" USING "btree" ("entity_type", "created_at" DESC);



CREATE INDEX "idx_app_logs_created_at" ON "public"."app_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_app_logs_retention_audit_executed_at" ON "public"."app_logs_retention_audit" USING "btree" ("executed_at" DESC);



CREATE INDEX "idx_app_logs_user_id" ON "public"."app_logs" USING "btree" ("user_id");



CREATE INDEX "idx_balles_emplacements_handpick_balle" ON "public"."balles_emplacements_handpick" USING "btree" ("balle_id", "created_at" DESC);



CREATE INDEX "idx_balles_handpick_borrowed" ON "public"."balles_handpick" USING "btree" ("borrowed_at" DESC) WHERE ("borrowed_by" IS NOT NULL);



CREATE INDEX "idx_balles_handpick_category" ON "public"."balles_handpick" USING "btree" ("category_id");



CREATE INDEX "idx_balles_handpick_eclatee" ON "public"."balles_handpick" USING "btree" ("eclatee_at" DESC) WHERE "is_eclatee";



CREATE INDEX "idx_balles_handpick_emplacement" ON "public"."balles_handpick" USING "btree" ("emplacement_id");



CREATE INDEX "idx_balles_handpick_fournisseur" ON "public"."balles_handpick" USING "btree" ("fournisseur_id");



CREATE INDEX "idx_balles_handpick_import_date" ON "public"."balles_handpick" USING "btree" ("import_date" DESC);



CREATE INDEX "idx_balles_handpick_parent" ON "public"."balles_handpick" USING "btree" ("parent_balle_id") WHERE ("parent_balle_id" IS NOT NULL);



CREATE INDEX "idx_balles_handpick_status" ON "public"."balles_handpick" USING "btree" ("status");



CREATE INDEX "idx_balles_handpick_stocked" ON "public"."balles_handpick" USING "btree" ("created_at" DESC) WHERE ("status" = 'stocked'::"text");



CREATE INDEX "idx_calendar_sync_logs_connection" ON "public"."calendar_sync_logs" USING "btree" ("connection_id");



CREATE INDEX "idx_calendar_sync_mappings_outlook" ON "public"."calendar_sync_mappings" USING "btree" ("outlook_event_id");



CREATE INDEX "idx_calendar_sync_mappings_pa" ON "public"."calendar_sync_mappings" USING "btree" ("nokk_project_event_id");



CREATE INDEX "idx_categories_handpick_active" ON "public"."categories_handpick" USING "btree" ("is_active") WHERE "is_active";



CREATE INDEX "idx_cryptedmessage_chat_created" ON "public"."cryptedmessage" USING "btree" ("chat_id", "created_at" DESC);



CREATE INDEX "idx_cryptedmessage_chat_id" ON "public"."cryptedmessage" USING "btree" ("chat_id");



CREATE INDEX "idx_cryptedmessage_created_at" ON "public"."cryptedmessage" USING "btree" ("created_at");



CREATE INDEX "idx_cryptedmessage_group_members_group_id" ON "public"."cryptedmessage_group_members" USING "btree" ("group_id");



CREATE INDEX "idx_cryptedmessage_group_members_user_id" ON "public"."cryptedmessage_group_members" USING "btree" ("user_id");



CREATE INDEX "idx_cryptedmessage_recipient_id" ON "public"."cryptedmessage" USING "btree" ("recipient_id");



CREATE INDEX "idx_cryptedmessage_reply_to" ON "public"."cryptedmessage" USING "btree" ("reply_to_id") WHERE ("reply_to_id" IS NOT NULL);



CREATE INDEX "idx_cryptedmessage_sender_id" ON "public"."cryptedmessage" USING "btree" ("sender_id");



CREATE INDEX "idx_emplacements_handpick_zone" ON "public"."emplacements_handpick" USING "btree" ("zone_id");



CREATE INDEX "idx_emplacements_magasin_magasin" ON "public"."emplacements_magasin" USING "btree" ("magasin_id");



CREATE INDEX "idx_equipements_magasin_etage" ON "public"."equipements_magasin" USING "btree" ("etage_id");



CREATE INDEX "idx_equipements_magasin_groupe" ON "public"."equipements_magasin" USING "btree" ("groupe") WHERE ("groupe" IS NOT NULL);



CREATE INDEX "idx_equipements_magasin_magasin" ON "public"."equipements_magasin" USING "btree" ("magasin_id");



CREATE INDEX "idx_equipements_magasin_zone" ON "public"."equipements_magasin" USING "btree" ("zone_id") WHERE ("zone_id" IS NOT NULL);



CREATE INDEX "idx_flux_handpick_direction_dechargement" ON "public"."flux_handpick" USING "btree" ("direction", "prev_dechargement_at" DESC NULLS LAST);



CREATE INDEX "idx_flux_handpick_fournisseur" ON "public"."flux_handpick" USING "btree" ("fournisseur_id");



CREATE INDEX "idx_flux_handpick_status" ON "public"."flux_handpick" USING "btree" ("status");



CREATE INDEX "idx_fournisseurs_categories_handpick_category" ON "public"."fournisseurs_categories_handpick" USING "btree" ("category_id");



CREATE INDEX "idx_fournisseurs_handpick_active" ON "public"."fournisseurs_handpick" USING "btree" ("is_active") WHERE "is_active";



CREATE INDEX "idx_logs_crm_change_at" ON "public"."logs_crm" USING "btree" ("change_at" DESC NULLS LAST);



CREATE INDEX "idx_matches_source_matches" ON "public"."matches" USING "btree" ("player1_source_match_id", "player2_source_match_id");



CREATE INDEX "idx_matches_tournament_round" ON "public"."matches" USING "btree" ("tournament_id", "round_number", "match_index");



CREATE INDEX "idx_messages_chat_id" ON "public"."messages" USING "btree" ("chat_id");



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at");



CREATE INDEX "idx_messages_group_id" ON "public"."messages" USING "btree" ("group_id");



CREATE INDEX "idx_messages_groupe_id" ON "public"."messages" USING "btree" ("groupe_id");



CREATE INDEX "idx_messages_recipient_id" ON "public"."messages" USING "btree" ("recipient_id");



CREATE INDEX "idx_messages_sender_id" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_mouvements_handpick_balle" ON "public"."mouvements_handpick" USING "btree" ("balle_id");



CREATE INDEX "idx_mouvements_handpick_category" ON "public"."mouvements_handpick" USING "btree" ("category_id");



CREATE INDEX "idx_mouvements_handpick_flux" ON "public"."mouvements_handpick" USING "btree" ("flux_id");



CREATE INDEX "idx_mouvements_handpick_to" ON "public"."mouvements_handpick" USING "btree" ("emplacement_to_id");



CREATE INDEX "idx_murs_magasin_etage" ON "public"."murs_magasin" USING "btree" ("etage_id");



CREATE INDEX "idx_murs_magasin_magasin" ON "public"."murs_magasin" USING "btree" ("magasin_id");



CREATE INDEX "idx_newsletter_api_logs_level_ts" ON "public"."newsletter_api_logs" USING "btree" ("level", "ts" DESC);



CREATE INDEX "idx_newsletter_api_logs_req_id" ON "public"."newsletter_api_logs" USING "btree" ("req_id");



CREATE INDEX "idx_newsletter_api_logs_ts" ON "public"."newsletter_api_logs" USING "btree" ("ts" DESC);



CREATE INDEX "idx_newsletter_send_events_created_at" ON "public"."newsletter_send_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_newsletter_send_events_run_id" ON "public"."newsletter_send_events" USING "btree" ("run_id");



CREATE INDEX "idx_newsletter_send_events_status" ON "public"."newsletter_send_events" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_newsletter_send_events_user_id" ON "public"."newsletter_send_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_newsletter_send_runs_started_at" ON "public"."newsletter_send_runs" USING "btree" ("started_at" DESC);



CREATE INDEX "idx_newsletter_send_runs_status" ON "public"."newsletter_send_runs" USING "btree" ("status", "started_at" DESC);



CREATE INDEX "idx_notification_user_title_created_at" ON "public"."notification" USING "btree" ("user_id", "title", "created_at" DESC);



CREATE INDEX "idx_outlook_connections_active" ON "public"."outlook_connections" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_outlook_connections_user_id" ON "public"."outlook_connections" USING "btree" ("user_id");



CREATE INDEX "idx_outlook_webhook_subs_connection" ON "public"."outlook_webhook_subscriptions" USING "btree" ("connection_id");



CREATE INDEX "idx_packing_label_category_category" ON "public"."packing_label_category" USING "btree" ("category_id");



CREATE INDEX "idx_packing_label_feedback_key" ON "public"."packing_label_feedback" USING "btree" ("raw_label_key");



CREATE INDEX "idx_packing_label_feedback_packing" ON "public"."packing_label_feedback" USING "btree" ("packing_list_id");



CREATE INDEX "idx_packing_list_ligne_group" ON "public"."packing_list_ligne" USING "btree" ("packing_list_id", "raw_label_key");



CREATE INDEX "idx_packing_list_ligne_position" ON "public"."packing_list_ligne" USING "btree" ("packing_list_id", "position");



CREATE INDEX "idx_profiles_privacy_not_accepted" ON "public"."profiles" USING "btree" ("user_id") WHERE ("privacy_accepted_at" IS NULL);



CREATE INDEX "idx_shared_exportkeys_user_id" ON "public"."cryptedmessage_shared_exportkeys" USING "btree" ("user_id");



CREATE INDEX "idx_tache_crm_overdue_scan" ON "public"."Tache_crm" USING "btree" ("date") WHERE (("overdue_notified_at" IS NULL) AND (COALESCE("valide", false) = false) AND ("owner" IS NOT NULL));



CREATE INDEX "idx_tournament_participants_tournament" ON "public"."tournament_participants" USING "btree" ("tournament_id", "seed");



CREATE INDEX "idx_watch_config_service_ids" ON "public"."watch_config" USING "gin" ("service_ids");



CREATE INDEX "idx_zones_handpick_parent" ON "public"."zones_handpick" USING "btree" ("parent_id", "sort_order");



CREATE INDEX "idx_zones_magasin_etage" ON "public"."zones_magasin" USING "btree" ("etage_id");



CREATE INDEX "idx_zones_magasin_magasin" ON "public"."zones_magasin" USING "btree" ("magasin_id", "parent_id", "sort_order");



CREATE INDEX "livraisons_boutique_commande_idx" ON "public"."livraisons_boutique" USING "btree" ("commande_id");



CREATE INDEX "livraisons_boutique_planning_idx" ON "public"."livraisons_boutique" USING "btree" ("date_expedition_prevue");



CREATE UNIQUE INDEX "magasins_retail_shop_id_key" ON "public"."magasins" USING "btree" ("retail_shop_id") WHERE ("retail_shop_id" IS NOT NULL);



CREATE INDEX "profiles_archived_at_idx" ON "public"."profiles" USING "btree" ("archived_at") WHERE ("archived_at" IS NULL);



CREATE INDEX "project_sprints_status_idx" ON "public"."project_sprints" USING "btree" ("status");



CREATE INDEX "project_sprints_team_id_idx" ON "public"."project_sprints" USING "btree" ("team_id");



CREATE INDEX "project_task_attachments_task_id_idx" ON "public"."project_task_attachments" USING "btree" ("task_id");



CREATE INDEX "project_tasks_assignee_id_idx" ON "public"."project_tasks" USING "btree" ("assignee_id");



CREATE INDEX "project_tasks_last_moved_by_idx" ON "public"."project_tasks" USING "btree" ("last_moved_by");



CREATE INDEX "project_tasks_sprint_id_idx" ON "public"."project_tasks" USING "btree" ("sprint_id");



CREATE INDEX "project_tasks_status_idx" ON "public"."project_tasks" USING "btree" ("status");



CREATE INDEX "project_team_members_team_id_idx" ON "public"."project_team_members" USING "btree" ("team_id");



CREATE INDEX "project_team_members_user_id_idx" ON "public"."project_team_members" USING "btree" ("user_id");



CREATE INDEX "project_teams_status_idx" ON "public"."project_teams" USING "btree" ("status");



CREATE INDEX "rdv_reschedule_mail_queue_due_idx" ON "public"."rdv_reschedule_mail_queue" USING "btree" ("send_after");



CREATE INDEX "tache_crm_creator_id_idx" ON "public"."Tache_crm" USING "btree" ("creator_id");



CREATE UNIQUE INDEX "tri_sorties_code_unique" ON "public"."tri_sorties" USING "btree" ("upper"("btrim"("code")));



CREATE UNIQUE INDEX "trieurs_nom_unique" ON "public"."trieurs" USING "btree" ("lower"("btrim"("nom")));



CREATE UNIQUE INDEX "uq_categories_handpick_name" ON "public"."categories_handpick" USING "btree" ("lower"("btrim"("name")));



CREATE UNIQUE INDEX "uq_emplacements_handpick_zone_code" ON "public"."emplacements_handpick" USING "btree" ("zone_id", "lower"("btrim"("code")));



CREATE UNIQUE INDEX "uq_emplacements_magasin_zone_code" ON "public"."emplacements_magasin" USING "btree" ("zone_id", "lower"("btrim"("code")));



CREATE UNIQUE INDEX "uq_etages_magasin_niveau" ON "public"."etages_magasin" USING "btree" ("magasin_id", "niveau");



CREATE UNIQUE INDEX "uq_fournisseurs_handpick_name" ON "public"."fournisseurs_handpick" USING "btree" ("lower"("btrim"("name")));



CREATE UNIQUE INDEX "uq_magasins_code" ON "public"."magasins" USING "btree" ("lower"("btrim"("code")));



CREATE UNIQUE INDEX "uq_zones_handpick_parent_code" ON "public"."zones_handpick" USING "btree" (COALESCE("parent_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "lower"("btrim"("code")));



CREATE UNIQUE INDEX "uq_zones_magasin_etage_parent_code" ON "public"."zones_magasin" USING "btree" ("etage_id", COALESCE("parent_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "lower"("btrim"("code")));



CREATE INDEX "users_permissions_user_id_idx" ON "public"."users_permissions" USING "btree" ("user_id");



CREATE INDEX "wiki_article_views_article_idx" ON "public"."wiki_article_views" USING "btree" ("article_id", "viewed_at" DESC);



CREATE INDEX "wiki_article_views_user_idx" ON "public"."wiki_article_views" USING "btree" ("user_id", "viewed_at" DESC);



CREATE INDEX "wiki_article_views_viewed_at_idx" ON "public"."wiki_article_views" USING "btree" ("viewed_at" DESC);



CREATE INDEX "wiki_articles_category_idx" ON "public"."wiki_articles" USING "btree" ("category_id");



CREATE INDEX "wiki_articles_status_idx" ON "public"."wiki_articles" USING "btree" ("status");



CREATE INDEX "wiki_categories_parent_idx" ON "public"."wiki_categories" USING "btree" ("parent_id");



CREATE INDEX "wiki_categories_parent_position_idx" ON "public"."wiki_categories" USING "btree" ("parent_id", "position");



CREATE OR REPLACE VIEW "public"."v_packing_list_summary" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."arrivage_manuel_id",
    "p"."status",
    "p"."source_filename",
    "p"."error_message",
    "p"."imported_by",
    "p"."imported_at",
    "p"."validated_by",
    "p"."validated_at",
    "p"."created_at",
    "p"."updated_at",
    "p"."declared_package_count",
    "p"."container_label",
    "p"."source_sheet",
    "p"."classifier_meta",
    ("count"("l"."id"))::integer AS "line_count",
    ("count"("l"."id") FILTER (WHERE ("l"."category_id" IS NULL)))::integer AS "lines_unmatched",
    ("count"("l"."id") FILTER (WHERE ("l"."resolution" = 'dictionary'::"text")))::integer AS "lines_from_dictionary",
    ("count"("l"."id") FILTER (WHERE ("l"."resolution" = 'model'::"text")))::integer AS "lines_from_model",
    ("count"("l"."id") FILTER (WHERE ("l"."resolution" = 'human'::"text")))::integer AS "lines_reviewed",
    (COALESCE("sum"("l"."package_count"), (0)::bigint))::integer AS "total_packages",
    COALESCE("sum"(COALESCE("l"."declared_total", ("l"."units_per_package" * ("l"."package_count")::numeric))) FILTER (WHERE ("l"."unit_kind" = 'pcs'::"text")), (0)::numeric) AS "total_pieces",
    COALESCE("sum"(COALESCE("l"."declared_total", ("l"."units_per_package" * ("l"."package_count")::numeric))) FILTER (WHERE ("l"."unit_kind" = 'kgs'::"text")), (0)::numeric) AS "total_weight_kg",
    ("count"("l"."id") FILTER (WHERE (("l"."package_count" IS NOT NULL) AND ("l"."units_per_package" IS NOT NULL) AND (("l"."declared_total" IS NULL) OR ("l"."declared_total" <> ("l"."units_per_package" * ("l"."package_count")::numeric))))))::integer AS "rows_failing_math",
        CASE
            WHEN ("p"."declared_package_count" IS NULL) THEN NULL::integer
            ELSE ((COALESCE("sum"("l"."package_count"), (0)::bigint))::integer - "p"."declared_package_count")
        END AS "package_count_gap"
   FROM ("public"."packing_list" "p"
     LEFT JOIN "public"."packing_list_ligne" "l" ON (("l"."packing_list_id" = "p"."id")))
  GROUP BY "p"."id";



CREATE OR REPLACE TRIGGER "Chrono_lead" BEFORE UPDATE ON "public"."client_crm" FOR EACH ROW EXECUTE FUNCTION "public"."Chronos_trg"();



CREATE OR REPLACE TRIGGER "app_maintenance_set_updated_at" BEFORE UPDATE ON "public"."app_maintenance" FOR EACH ROW EXECUTE FUNCTION "public"."app_maintenance_set_updated_at"();



CREATE OR REPLACE TRIGGER "arrivage_activity_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."arrivage_manuel" FOR EACH ROW EXECUTE FUNCTION "public"."log_arrivage_activity"();



CREATE OR REPLACE TRIGGER "arrivage_invoice_reminder_trigger" AFTER INSERT OR UPDATE ON "public"."arrivage_manuel" FOR EACH ROW EXECUTE FUNCTION "public"."check_arrivage_invoice_reminder"();



CREATE OR REPLACE TRIGGER "arrivage_manuel_updated_at" BEFORE UPDATE ON "public"."arrivage_manuel" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "arrivage_status_auto_trigger" BEFORE INSERT OR UPDATE ON "public"."arrivage_manuel" FOR EACH ROW EXECUTE FUNCTION "public"."auto_set_arrivage_status"();



CREATE OR REPLACE TRIGGER "balle_activity_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."balles_gestion" FOR EACH ROW EXECUTE FUNCTION "public"."log_balle_activity"();



CREATE OR REPLACE TRIGGER "call_go_api_on_false" AFTER INSERT OR UPDATE OF "confirmed" ON "public"."Event_calendar" FOR EACH ROW EXECUTE FUNCTION "public"."function_call_go_api_on_new_event"();



CREATE OR REPLACE TRIGGER "carton_activity_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."cartons" FOR EACH ROW EXECUTE FUNCTION "public"."log_carton_activity"();



CREATE OR REPLACE TRIGGER "carton_coherence_trigger" BEFORE INSERT OR UPDATE ON "public"."cartons" FOR EACH ROW EXECUTE FUNCTION "public"."carton_coherence"();



CREATE OR REPLACE TRIGGER "carton_refresh_commande_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."cartons" FOR EACH ROW EXECUTE FUNCTION "public"."carton_refresh_commande"();



CREATE OR REPLACE TRIGGER "category_activity_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."categories_gestion" FOR EACH ROW EXECUTE FUNCTION "public"."log_category_activity"();



CREATE OR REPLACE TRIGGER "commande_boutique_activity_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."commandes_boutique" FOR EACH ROW EXECUTE FUNCTION "public"."log_commande_boutique_activity"();



CREATE OR REPLACE TRIGGER "commande_boutique_notify_trigger" AFTER INSERT OR UPDATE OF "statut" ON "public"."commandes_boutique" FOR EACH ROW EXECUTE FUNCTION "public"."commande_boutique_notify"();



CREATE OR REPLACE TRIGGER "commande_ligne_refresh_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."commande_lignes" FOR EACH ROW EXECUTE FUNCTION "public"."commande_ligne_refresh"();



CREATE OR REPLACE TRIGGER "created_chat_touch" BEFORE UPDATE ON "public"."created_chat" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "crm_new_lead_notify" AFTER INSERT ON "public"."client_crm" FOR EACH ROW EXECUTE FUNCTION "public"."notify_crm_new_lead"();



CREATE OR REPLACE TRIGGER "crm_task_assigned_notify" AFTER INSERT ON "public"."Tache_crm" FOR EACH ROW EXECUTE FUNCTION "public"."notify_crm_task_assigned"();



CREATE OR REPLACE TRIGGER "cryptedmessage_groups_updated_at" BEFORE UPDATE ON "public"."cryptedmessage_groups" FOR EACH ROW EXECUTE FUNCTION "public"."update_cryptedmessage_groups_updated_at"();



CREATE OR REPLACE TRIGGER "cryptedmessage_keybundles_touch" BEFORE UPDATE ON "public"."cryptedmessage_keybundles" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "cryptedmessage_notify" AFTER INSERT ON "public"."cryptedmessage" FOR EACH ROW EXECUTE FUNCTION "public"."notify_cryptedmessage"();



CREATE OR REPLACE TRIGGER "cryptedmessage_userkeys_touch" BEFORE UPDATE ON "public"."cryptedmessage_userkeys" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "dashboard_layout_templates_set_updated_at" BEFORE UPDATE ON "public"."dashboard_layout_templates" FOR EACH ROW EXECUTE FUNCTION "public"."dashboard_layout_set_updated_at"();



CREATE OR REPLACE TRIGGER "delivery_activity_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."deliveries_gestion" FOR EACH ROW EXECUTE FUNCTION "public"."log_delivery_activity"();



CREATE OR REPLACE TRIGGER "detach_eclatees_before_fournisseur_delete" BEFORE DELETE ON "public"."fournisseurs_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."detach_eclatees_from_fournisseur_handpick"();



CREATE OR REPLACE TRIGGER "emplacements_magasin_check_zone" BEFORE INSERT OR UPDATE ON "public"."emplacements_magasin" FOR EACH ROW EXECUTE FUNCTION "public"."emplacements_magasin_check_zone"();



CREATE OR REPLACE TRIGGER "equipements_magasin_check_etage" BEFORE INSERT OR UPDATE ON "public"."equipements_magasin" FOR EACH ROW EXECUTE FUNCTION "public"."magasin_check_etage"();



CREATE OR REPLACE TRIGGER "equipements_magasin_check_zone" BEFORE INSERT OR UPDATE OF "zone_id", "etage_id" ON "public"."equipements_magasin" FOR EACH ROW EXECUTE FUNCTION "public"."equipements_magasin_check_zone"();



CREATE OR REPLACE TRIGGER "fiche_tri_delete_log" BEFORE DELETE ON "public"."fiches_tri" FOR EACH ROW EXECUTE FUNCTION "public"."log_fiche_tri_delete"();



CREATE OR REPLACE TRIGGER "fournisseur_activity_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."fournisseur_gestion" FOR EACH ROW EXECUTE FUNCTION "public"."log_fournisseur_activity"();



CREATE OR REPLACE TRIGGER "leads_client_crm_sync" AFTER INSERT ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."leads_client_crm_sync"();



CREATE OR REPLACE TRIGGER "livraison_boutique_activity_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."livraisons_boutique" FOR EACH ROW EXECUTE FUNCTION "public"."log_livraison_boutique_activity"();



CREATE OR REPLACE TRIGGER "livraison_boutique_coherence_trigger" BEFORE INSERT OR UPDATE ON "public"."livraisons_boutique" FOR EACH ROW EXECUTE FUNCTION "public"."livraison_boutique_coherence"();



CREATE OR REPLACE TRIGGER "livraison_boutique_notify_trigger" AFTER UPDATE OF "statut" ON "public"."livraisons_boutique" FOR EACH ROW EXECUTE FUNCTION "public"."livraison_boutique_notify"();



CREATE OR REPLACE TRIGGER "livraison_refresh_commande_trigger" AFTER DELETE OR UPDATE OF "statut", "commande_id" ON "public"."livraisons_boutique" FOR EACH ROW EXECUTE FUNCTION "public"."livraison_refresh_commande"();



CREATE OR REPLACE TRIGGER "log_balle_emplacement_handpick" AFTER INSERT OR UPDATE OF "emplacement_id", "borrowed_by" ON "public"."balles_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."log_balle_emplacement_handpick"();



CREATE OR REPLACE TRIGGER "log_balles_handpick_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."balles_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."log_handpick_activity"('balle', 'raw_name');



CREATE OR REPLACE TRIGGER "log_categories_handpick_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."categories_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."log_handpick_activity"('category', 'name');



CREATE OR REPLACE TRIGGER "log_emplacements_handpick_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."emplacements_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."log_handpick_activity"('emplacement', 'code');



CREATE OR REPLACE TRIGGER "log_flux_handpick_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."flux_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."log_handpick_activity"('flux', 'container_no,conteneur_no_raw,invoice_no');



CREATE OR REPLACE TRIGGER "log_fournisseurs_categories_handpick_activity" AFTER INSERT OR DELETE ON "public"."fournisseurs_categories_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."log_handpick_fournisseur_category_activity"();



CREATE OR REPLACE TRIGGER "log_fournisseurs_handpick_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."fournisseurs_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."log_handpick_activity"('fournisseur', 'name');



CREATE OR REPLACE TRIGGER "log_mouvements_handpick_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."mouvements_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."log_handpick_activity"('mouvement', 'balle_label');



CREATE OR REPLACE TRIGGER "log_zones_handpick_activity" AFTER INSERT OR DELETE OR UPDATE ON "public"."zones_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."log_handpick_activity"('zone', 'code');



CREATE OR REPLACE TRIGGER "magasins_create_rdc" AFTER INSERT ON "public"."magasins" FOR EACH ROW EXECUTE FUNCTION "public"."magasins_create_rdc"();



CREATE OR REPLACE TRIGGER "murs_magasin_check_etage" BEFORE INSERT OR UPDATE ON "public"."murs_magasin" FOR EACH ROW EXECUTE FUNCTION "public"."magasin_check_etage"();



CREATE OR REPLACE TRIGGER "newsletter_api_error_notify" AFTER INSERT ON "public"."newsletter_api_logs" FOR EACH ROW WHEN (("new"."level" = 'ERROR'::"text")) EXECUTE FUNCTION "public"."notify_newsletter_api_error"();



CREATE OR REPLACE TRIGGER "packing_label_feedback_on_status" AFTER UPDATE OF "status" ON "public"."packing_list" FOR EACH ROW WHEN (("old"."status" IS DISTINCT FROM "new"."status")) EXECUTE FUNCTION "public"."packing_label_feedback_on_status"();



CREATE OR REPLACE TRIGGER "packing_label_feedback_record" AFTER UPDATE OF "category_id", "resolution" ON "public"."packing_list_ligne" FOR EACH ROW WHEN ((("old"."category_id" IS DISTINCT FROM "new"."category_id") OR ("old"."resolution" IS DISTINCT FROM "new"."resolution"))) EXECUTE FUNCTION "public"."packing_label_feedback_record"();



CREATE OR REPLACE TRIGGER "packing_list_ligne_set_reviewer" BEFORE UPDATE ON "public"."packing_list_ligne" FOR EACH ROW EXECUTE FUNCTION "public"."packing_list_ligne_set_reviewer"();



CREATE OR REPLACE TRIGGER "palette_numerotation_trigger" BEFORE INSERT ON "public"."palettes" FOR EACH ROW EXECUTE FUNCTION "public"."palette_numerotation"();



CREATE OR REPLACE TRIGGER "plan_layout_handpick_stamp" BEFORE INSERT OR UPDATE ON "public"."plan_layout_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."plan_layout_handpick_stamp"();



CREATE OR REPLACE TRIGGER "set_balles_handpick_updated_at" BEFORE UPDATE ON "public"."balles_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_bibliotheque_brief_updated_at" BEFORE UPDATE ON "public"."bibliotheque_brief" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_bibliotheque_format_reponses_updated_at" BEFORE UPDATE ON "public"."bibliotheque_format_reponses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_bibliotheque_questions_reponses_updated_at" BEFORE UPDATE ON "public"."bibliotheque_questions_reponses" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_bibliotheque_thematiques_updated_at" BEFORE UPDATE ON "public"."bibliotheque_thematiques" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_categories_handpick_updated_at" BEFORE UPDATE ON "public"."categories_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_emplacements_handpick_updated_at" BEFORE UPDATE ON "public"."emplacements_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_emplacements_magasin_updated_at" BEFORE UPDATE ON "public"."emplacements_magasin" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_equipements_magasin_updated_at" BEFORE UPDATE ON "public"."equipements_magasin" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_etages_magasin_updated_at" BEFORE UPDATE ON "public"."etages_magasin" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_flux_handpick_status" BEFORE INSERT OR UPDATE ON "public"."flux_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."auto_set_flux_handpick_status"();



CREATE OR REPLACE TRIGGER "set_flux_handpick_updated_at" BEFORE UPDATE ON "public"."flux_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_fournisseurs_handpick_updated_at" BEFORE UPDATE ON "public"."fournisseurs_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_magasins_updated_at" BEFORE UPDATE ON "public"."magasins" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_mouvements_handpick_updated_at" BEFORE UPDATE ON "public"."mouvements_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_murs_magasin_updated_at" BEFORE UPDATE ON "public"."murs_magasin" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_zones_handpick_updated_at" BEFORE UPDATE ON "public"."zones_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "set_zones_magasin_updated_at" BEFORE UPDATE ON "public"."zones_magasin" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "snapshot_fournisseur_on_eclatement" BEFORE UPDATE OF "is_eclatee" ON "public"."balles_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."snapshot_fournisseur_on_eclatement_handpick"();



CREATE OR REPLACE TRIGGER "trg_apply_elo_on_match" BEFORE UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."apply_elo_on_match"();



CREATE OR REPLACE TRIGGER "trg_assign_closer_on_event_insert" AFTER INSERT OR UPDATE OF "customer", "id_client" ON "public"."Event_calendar" FOR EACH ROW EXECUTE FUNCTION "public"."assign_closer_on_event_insert"();



CREATE OR REPLACE TRIGGER "trg_check_amelia_source" BEFORE INSERT ON "public"."Event_calendar" FOR EACH ROW EXECUTE FUNCTION "public"."set_confirmation_amelia"();



CREATE OR REPLACE TRIGGER "trg_confirm_events_on_client_column_change" AFTER UPDATE OF "collum" ON "public"."client_crm" FOR EACH ROW EXECUTE FUNCTION "public"."confirm_events_on_client_column_change"();



CREATE OR REPLACE TRIGGER "trg_create_relance_tasks_on_rdv_achat" AFTER INSERT OR UPDATE ON "public"."Event_calendar" FOR EACH ROW EXECUTE FUNCTION "public"."create_relance_tasks_on_rdv_achat"();



CREATE OR REPLACE TRIGGER "trg_move_client_column_on_event" AFTER INSERT OR UPDATE ON "public"."Event_calendar" FOR EACH ROW EXECUTE FUNCTION "public"."move_client_column_on_event"();



CREATE OR REPLACE TRIGGER "trg_queue_rdv_reschedule_mail" AFTER UPDATE OF "debut", "fin" ON "public"."Event_calendar" FOR EACH ROW EXECUTE FUNCTION "public"."queue_rdv_reschedule_mail"();



CREATE OR REPLACE TRIGGER "trg_set_client_setter_on_confirm" AFTER UPDATE OF "confirmed" ON "public"."Event_calendar" FOR EACH ROW EXECUTE FUNCTION "public"."set_client_setter_on_confirm"();



CREATE OR REPLACE TRIGGER "trg_set_event_customer_from_closer" BEFORE INSERT OR UPDATE ON "public"."Event_calendar" FOR EACH ROW EXECUTE FUNCTION "public"."set_event_customer_from_closer"();



CREATE OR REPLACE TRIGGER "trg_stamp_event_confirmation" BEFORE INSERT OR UPDATE ON "public"."Event_calendar" FOR EACH ROW EXECUTE FUNCTION "public"."stamp_event_confirmation"();



CREATE OR REPLACE TRIGGER "trg_sync_customer_to_closer" AFTER INSERT OR UPDATE ON "public"."Event_calendar" FOR EACH ROW EXECUTE FUNCTION "public"."sync_customer_to_closer"();



CREATE OR REPLACE TRIGGER "trg_sync_relance_tasks_on_rdv_update" AFTER UPDATE ON "public"."Event_calendar" FOR EACH ROW EXECUTE FUNCTION "public"."sync_relance_tasks_on_rdv_update"();



CREATE OR REPLACE TRIGGER "trieur_activity_trigger" AFTER INSERT OR DELETE OR UPDATE ON "public"."trieurs" FOR EACH ROW EXECUTE FUNCTION "public"."log_trieur_activity"();



CREATE OR REPLACE TRIGGER "trigger_event_calendar_updated_at" BEFORE UPDATE ON "public"."Event_calendar" FOR EACH ROW EXECUTE FUNCTION "public"."update_event_calendar_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_log_client_crm_changes" AFTER UPDATE ON "public"."client_crm" FOR EACH ROW EXECUTE FUNCTION "public"."log_client_crm_changes"();



CREATE OR REPLACE TRIGGER "trigger_outlook_connections_updated_at" BEFORE UPDATE ON "public"."outlook_connections" FOR EACH ROW EXECUTE FUNCTION "public"."update_outlook_connection_updated_at"();



CREATE OR REPLACE TRIGGER "update_matches_updated_at" BEFORE UPDATE ON "public"."matches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_packing_label_category_updated_at" BEFORE UPDATE ON "public"."packing_label_category" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_packing_label_feedback_updated_at" BEFORE UPDATE ON "public"."packing_label_feedback" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_packing_list_ligne_updated_at" BEFORE UPDATE ON "public"."packing_list_ligne" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_packing_list_updated_at" BEFORE UPDATE ON "public"."packing_list" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ping_pong_players_updated_at" BEFORE UPDATE ON "public"."ping_pong_players" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_sprints_updated_at" BEFORE UPDATE ON "public"."project_sprints" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_tasks_updated_at" BEFORE UPDATE ON "public"."project_tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_project_teams_updated_at" BEFORE UPDATE ON "public"."project_teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_roles_updated_at" BEFORE UPDATE ON "public"."roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_services_updated_at" BEFORE UPDATE ON "public"."services" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tickets_updated_at" BEFORE UPDATE ON "public"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tournaments_updated_at" BEFORE UPDATE ON "public"."tournaments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "user_crm_analytics_layout_set_updated_at" BEFORE UPDATE ON "public"."user_crm_analytics_layout" FOR EACH ROW EXECUTE FUNCTION "public"."crm_analytics_layout_set_updated_at"();



CREATE OR REPLACE TRIGGER "user_dashboard_layout_set_updated_at" BEFORE UPDATE ON "public"."user_dashboard_layout" FOR EACH ROW EXECUTE FUNCTION "public"."dashboard_layout_set_updated_at"();



CREATE OR REPLACE TRIGGER "user_preferences_set_updated_at" BEFORE UPDATE ON "public"."user_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."user_preferences_set_updated_at"();



CREATE OR REPLACE TRIGGER "wiki_articles_set_updated_at" BEFORE UPDATE ON "public"."wiki_articles" FOR EACH ROW EXECUTE FUNCTION "public"."wiki_articles_set_updated_at"();



CREATE OR REPLACE TRIGGER "zones_handpick_check_hierarchy" BEFORE INSERT OR UPDATE ON "public"."zones_handpick" FOR EACH ROW EXECUTE FUNCTION "public"."zones_handpick_check_hierarchy"();



CREATE OR REPLACE TRIGGER "zones_magasin_check_etage" BEFORE INSERT OR UPDATE ON "public"."zones_magasin" FOR EACH ROW EXECUTE FUNCTION "public"."magasin_check_etage"();



CREATE OR REPLACE TRIGGER "zones_magasin_check_hierarchy" BEFORE INSERT OR UPDATE ON "public"."zones_magasin" FOR EACH ROW EXECUTE FUNCTION "public"."zones_magasin_check_hierarchy"();



ALTER TABLE ONLY "public"."Client_activite"
    ADD CONSTRAINT "Client_activite_client_fkey" FOREIGN KEY ("client") REFERENCES "public"."client_crm"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Client_activite"
    ADD CONSTRAINT "Client_activite_owner_fkey" FOREIGN KEY ("owner") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Event_calendar_Comm"
    ADD CONSTRAINT "Event_calendar_Comm_customer_fkey" FOREIGN KEY ("customer") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Event_calendar"
    ADD CONSTRAINT "Event_calendar_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."Event_calendar"
    ADD CONSTRAINT "Event_calendar_id_client_fkey" FOREIGN KEY ("id_client") REFERENCES "public"."client_crm"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Kanban_comm"
    ADD CONSTRAINT "Kanban_comm_assigned_fkey" FOREIGN KEY ("assigned") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Kanban_comm"
    ADD CONSTRAINT "Kanban_comm_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Tache_crm"
    ADD CONSTRAINT "Tache_crm_client_fkey" FOREIGN KEY ("client") REFERENCES "public"."client_crm"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Tache_crm"
    ADD CONSTRAINT "Tache_crm_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Tache_crm"
    ADD CONSTRAINT "Tache_crm_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."Event_calendar"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Tache_crm"
    ADD CONSTRAINT "Tache_crm_owner_fkey" FOREIGN KEY ("owner") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_log_handpick"
    ADD CONSTRAINT "activity_log_handpick_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."annonce"
    ADD CONSTRAINT "annonce_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_logs"
    ADD CONSTRAINT "app_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."arrivage_state"
    ADD CONSTRAINT "arrivage_state_livraison_id_fkey" FOREIGN KEY ("livraison_id") REFERENCES "public"."deliveries_gestion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balles"
    ADD CONSTRAINT "balles_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balles_emplacements_handpick"
    ADD CONSTRAINT "balles_emplacements_handpick_balle_id_fkey" FOREIGN KEY ("balle_id") REFERENCES "public"."balles_handpick"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balles_emplacements_handpick"
    ADD CONSTRAINT "balles_emplacements_handpick_emplacement_from_id_fkey" FOREIGN KEY ("emplacement_from_id") REFERENCES "public"."emplacements_handpick"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balles_emplacements_handpick"
    ADD CONSTRAINT "balles_emplacements_handpick_emplacement_to_id_fkey" FOREIGN KEY ("emplacement_to_id") REFERENCES "public"."emplacements_handpick"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balles_emplacements_handpick"
    ADD CONSTRAINT "balles_emplacements_handpick_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balles"
    ADD CONSTRAINT "balles_fournisseur_uid_fkey" FOREIGN KEY ("fournisseur_uid") REFERENCES "public"."fournisseur"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balles_gestion"
    ADD CONSTRAINT "balles_gestion_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories_gestion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balles_gestion"
    ADD CONSTRAINT "balles_gestion_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balles_gestion"
    ADD CONSTRAINT "balles_gestion_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "public"."deliveries_gestion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balles_gestion"
    ADD CONSTRAINT "balles_gestion_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseur_gestion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balles_gestion"
    ADD CONSTRAINT "balles_gestion_parent_balle_id_fkey" FOREIGN KEY ("parent_balle_id") REFERENCES "public"."balles_gestion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balles_handpick"
    ADD CONSTRAINT "balles_handpick_borrowed_by_fkey" FOREIGN KEY ("borrowed_by") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."balles_handpick"
    ADD CONSTRAINT "balles_handpick_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories_handpick"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balles_handpick"
    ADD CONSTRAINT "balles_handpick_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balles_handpick"
    ADD CONSTRAINT "balles_handpick_eclatee_by_fkey" FOREIGN KEY ("eclatee_by") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."balles_handpick"
    ADD CONSTRAINT "balles_handpick_emplacement_id_fkey" FOREIGN KEY ("emplacement_id") REFERENCES "public"."emplacements_handpick"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balles_handpick"
    ADD CONSTRAINT "balles_handpick_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseurs_handpick"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balles_handpick"
    ADD CONSTRAINT "balles_handpick_parent_balle_id_fkey" FOREIGN KEY ("parent_balle_id") REFERENCES "public"."balles_handpick"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."balles"
    ADD CONSTRAINT "balles_owner_fkey" FOREIGN KEY ("owner") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bibliotheque_format_reponses"
    ADD CONSTRAINT "bibliotheque_format_reponses_quest_rep_id_fkey" FOREIGN KEY ("quest_rep_id") REFERENCES "public"."bibliotheque_questions_reponses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bibliotheque_questions_reponses"
    ADD CONSTRAINT "bibliotheque_questions_reponses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bibliotheque_questions_reponses"
    ADD CONSTRAINT "bibliotheque_questions_reponses_thematique_id_fkey" FOREIGN KEY ("thematique_id") REFERENCES "public"."bibliotheque_thematiques"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bibliotheque_thematiques"
    ADD CONSTRAINT "bibliotheque_thematiques_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."brief.crm"
    ADD CONSTRAINT "brief.crm_customer_fkey" FOREIGN KEY ("customer") REFERENCES "public"."client_crm"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_sync_logs"
    ADD CONSTRAINT "calendar_sync_logs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."outlook_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_sync_mappings"
    ADD CONSTRAINT "calendar_sync_mappings_apple_connection_id_fkey" FOREIGN KEY ("apple_connection_id") REFERENCES "public"."apple_calendar_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_sync_mappings"
    ADD CONSTRAINT "calendar_sync_mappings_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."outlook_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_sync_mappings"
    ADD CONSTRAINT "calendar_sync_mappings_nokk_project_event_id_fkey" FOREIGN KEY ("nokk_project_event_id") REFERENCES "public"."Event_calendar"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cartons"
    ADD CONSTRAINT "cartons_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories_gestion"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cartons"
    ADD CONSTRAINT "cartons_livraison_id_fkey" FOREIGN KEY ("livraison_id") REFERENCES "public"."livraisons_boutique"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cartons"
    ADD CONSTRAINT "cartons_palette_id_fkey" FOREIGN KEY ("palette_id") REFERENCES "public"."palettes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."categories_handpick"
    ADD CONSTRAINT "categories_handpick_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_price_history"
    ADD CONSTRAINT "category_price_history_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories_gestion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."changelog_items"
    ADD CONSTRAINT "changelog_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."changelog_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."changelog_items"
    ADD CONSTRAINT "changelog_items_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."changelog_versions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."changelog_versions"
    ADD CONSTRAINT "changelog_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_amelia_submissions"
    ADD CONSTRAINT "client_amelia_submissions_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."client_crm"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_amelia_submissions"
    ADD CONSTRAINT "client_amelia_submissions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."Event_calendar"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."client_crm"
    ADD CONSTRAINT "client_crm_closers_fkey" FOREIGN KEY ("closers") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_crm"
    ADD CONSTRAINT "client_crm_customer_fkey" FOREIGN KEY ("customer") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commande_lignes"
    ADD CONSTRAINT "commande_lignes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories_gestion"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."commande_lignes"
    ADD CONSTRAINT "commande_lignes_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes_boutique"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commandes_boutique"
    ADD CONSTRAINT "commandes_boutique_boutique_id_fkey" FOREIGN KEY ("boutique_id") REFERENCES "public"."boutiques"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."content_generation"
    ADD CONSTRAINT "content_generation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."created_chat"
    ADD CONSTRAINT "created_chat_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."created_chat"
    ADD CONSTRAINT "created_chat_with_id_fkey" FOREIGN KEY ("with_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."cryptedmessage_group_members"
    ADD CONSTRAINT "cryptedmessage_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."cryptedmessage_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cryptedmessage_group_members"
    ADD CONSTRAINT "cryptedmessage_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cryptedmessage_groups"
    ADD CONSTRAINT "cryptedmessage_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cryptedmessage_keybundles"
    ADD CONSTRAINT "cryptedmessage_keybundles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."cryptedmessage"
    ADD CONSTRAINT "cryptedmessage_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cryptedmessage"
    ADD CONSTRAINT "cryptedmessage_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."cryptedmessage"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cryptedmessage"
    ADD CONSTRAINT "cryptedmessage_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cryptedmessage_shared_exportkeys"
    ADD CONSTRAINT "cryptedmessage_shared_exportkeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cryptedmessage_userkeys"
    ADD CONSTRAINT "cryptedmessage_userkeys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cryptedmessage_userkeys"
    ADD CONSTRAINT "cryptedmessage_userkeys_user_id_fkey2" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."dashboard_layout_templates"
    ADD CONSTRAINT "dashboard_layout_templates_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dashboard_layout_templates"
    ADD CONSTRAINT "dashboard_layout_templates_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliveries_gestion"
    ADD CONSTRAINT "deliveries_gestion_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliveries_gestion"
    ADD CONSTRAINT "deliveries_gestion_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseur_gestion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Devis"
    ADD CONSTRAINT "devis_by_fkey" FOREIGN KEY ("by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Devis"
    ADD CONSTRAINT "devis_client_fkey" FOREIGN KEY ("client") REFERENCES "public"."client_crm"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."direct_conversations"
    ADD CONSTRAINT "direct_conversations_user_a_fkey" FOREIGN KEY ("user_a") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."direct_conversations"
    ADD CONSTRAINT "direct_conversations_user_b_fkey" FOREIGN KEY ("user_b") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emplacements_handpick"
    ADD CONSTRAINT "emplacements_handpick_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emplacements_handpick"
    ADD CONSTRAINT "emplacements_handpick_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones_handpick"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emplacements_magasin"
    ADD CONSTRAINT "emplacements_magasin_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emplacements_magasin"
    ADD CONSTRAINT "emplacements_magasin_magasin_id_fkey" FOREIGN KEY ("magasin_id") REFERENCES "public"."magasins"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emplacements_magasin"
    ADD CONSTRAINT "emplacements_magasin_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones_magasin"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipements_magasin"
    ADD CONSTRAINT "equipements_magasin_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipements_magasin"
    ADD CONSTRAINT "equipements_magasin_magasin_id_fkey" FOREIGN KEY ("magasin_id") REFERENCES "public"."magasins"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."etages_magasin"
    ADD CONSTRAINT "etages_magasin_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."etages_magasin"
    ADD CONSTRAINT "etages_magasin_magasin_id_fkey" FOREIGN KEY ("magasin_id") REFERENCES "public"."magasins"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."Event_calendar"
    ADD CONSTRAINT "event_calendar_customer_fkey" FOREIGN KEY ("customer") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fiches_tri_balles"
    ADD CONSTRAINT "fiches_tri_balles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories_gestion"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fiches_tri_balles"
    ADD CONSTRAINT "fiches_tri_balles_fiche_id_fkey" FOREIGN KEY ("fiche_id") REFERENCES "public"."fiches_tri"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fiches_tri_balles"
    ADD CONSTRAINT "fiches_tri_balles_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseur_gestion"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fiches_tri_repartition"
    ADD CONSTRAINT "fiches_tri_repartition_balle_id_fkey" FOREIGN KEY ("balle_id") REFERENCES "public"."fiches_tri_balles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fiches_tri_repartition"
    ADD CONSTRAINT "fiches_tri_repartition_sortie_id_fkey" FOREIGN KEY ("sortie_id") REFERENCES "public"."tri_sorties"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."fiches_tri"
    ADD CONSTRAINT "fiches_tri_trieur_id_fkey" FOREIGN KEY ("trieur_id") REFERENCES "public"."trieurs"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "fk_messages_chat" FOREIGN KEY ("chat_id") REFERENCES "public"."created_chat"("id_chat") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flux_handpick"
    ADD CONSTRAINT "flux_handpick_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."flux_handpick"
    ADD CONSTRAINT "flux_handpick_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseurs_handpick"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fournisseurs_categories_handpick"
    ADD CONSTRAINT "fournisseurs_categories_handpick_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories_handpick"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fournisseurs_categories_handpick"
    ADD CONSTRAINT "fournisseurs_categories_handpick_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fournisseurs_categories_handpick"
    ADD CONSTRAINT "fournisseurs_categories_handpick_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseurs_handpick"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fournisseurs_handpick"
    ADD CONSTRAINT "fournisseurs_handpick_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gallery_permissions"
    ADD CONSTRAINT "gallery_permissions_picture_id_fkey" FOREIGN KEY ("picture_id") REFERENCES "public"."gallery_pictures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gallery_pictures"
    ADD CONSTRAINT "gallery_pictures_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."gallery_pictures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gestion_arrivage_packing"
    ADD CONSTRAINT "gestion_arrivage_packing_arrivage_id_fkey" FOREIGN KEY ("arrivage_id") REFERENCES "public"."gestion_arrivage_row"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gestion_arrivage_row"
    ADD CONSTRAINT "gestion_arrivage_row_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories_gestion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gestion_arrivage_row"
    ADD CONSTRAINT "gestion_arrivage_row_fournisseur_id_fkey" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseur_gestion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gestion_arrivage_row"
    ADD CONSTRAINT "gestion_arrivage_row_livraison_id_fkey" FOREIGN KEY ("livraison_id") REFERENCES "public"."deliveries_gestion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_read_receipts"
    ADD CONSTRAINT "group_read_receipts_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_read_receipts"
    ADD CONSTRAINT "group_read_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."groupe_participant"
    ADD CONSTRAINT "groupe_participant_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id");



ALTER TABLE ONLY "public"."groupe_participant"
    ADD CONSTRAINT "groupe_participant_participant_fkey" FOREIGN KEY ("participant") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."items"
    ADD CONSTRAINT "items_facture_id_fkey" FOREIGN KEY ("facture_id") REFERENCES "public"."factures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."livraisons_boutique"
    ADD CONSTRAINT "livraisons_boutique_boutique_id_fkey" FOREIGN KEY ("boutique_id") REFERENCES "public"."boutiques"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."livraisons_boutique"
    ADD CONSTRAINT "livraisons_boutique_commande_id_fkey" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes_boutique"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."logs_crm"
    ADD CONSTRAINT "logs_crm_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."magasins"
    ADD CONSTRAINT "magasins_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_player1_source_match_id_fkey" FOREIGN KEY ("player1_source_match_id") REFERENCES "public"."matches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_player2_source_match_id_fkey" FOREIGN KEY ("player2_source_match_id") REFERENCES "public"."matches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_groupe_id_fkey" FOREIGN KEY ("groupe_id") REFERENCES "public"."groups"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messaging_favorites"
    ADD CONSTRAINT "messaging_favorites_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messaging_favorites"
    ADD CONSTRAINT "messaging_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mouvements_handpick"
    ADD CONSTRAINT "mouvements_handpick_balle_id_fkey" FOREIGN KEY ("balle_id") REFERENCES "public"."balles_handpick"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mouvements_handpick"
    ADD CONSTRAINT "mouvements_handpick_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories_handpick"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mouvements_handpick"
    ADD CONSTRAINT "mouvements_handpick_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mouvements_handpick"
    ADD CONSTRAINT "mouvements_handpick_emplacement_from_id_fkey" FOREIGN KEY ("emplacement_from_id") REFERENCES "public"."emplacements_handpick"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mouvements_handpick"
    ADD CONSTRAINT "mouvements_handpick_emplacement_to_id_fkey" FOREIGN KEY ("emplacement_to_id") REFERENCES "public"."emplacements_handpick"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mouvements_handpick"
    ADD CONSTRAINT "mouvements_handpick_flux_fk" FOREIGN KEY ("flux_id") REFERENCES "public"."flux_handpick"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."murs_magasin"
    ADD CONSTRAINT "murs_magasin_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."murs_magasin"
    ADD CONSTRAINT "murs_magasin_etage_id_fkey" FOREIGN KEY ("etage_id") REFERENCES "public"."etages_magasin"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."murs_magasin"
    ADD CONSTRAINT "murs_magasin_magasin_id_fkey" FOREIGN KEY ("magasin_id") REFERENCES "public"."magasins"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."new_ticket"
    ADD CONSTRAINT "new_ticket_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."new_ticket"
    ADD CONSTRAINT "new_ticket_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."newsletter_invitation_codes"
    ADD CONSTRAINT "newsletter_invitation_codes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."newsletter_invitation_codes"
    ADD CONSTRAINT "newsletter_invitation_codes_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."newsletter_send_events"
    ADD CONSTRAINT "newsletter_send_events_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "public"."newsletter_send_runs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."newsletter_subscriptions"
    ADD CONSTRAINT "newsletter_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outlook_connections"
    ADD CONSTRAINT "outlook_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outlook_webhook_subscriptions"
    ADD CONSTRAINT "outlook_webhook_subscriptions_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "public"."outlook_connections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packages"
    ADD CONSTRAINT "packages_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packing_label_category"
    ADD CONSTRAINT "packing_label_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories_gestion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packing_label_feedback"
    ADD CONSTRAINT "packing_label_feedback_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories_gestion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packing_label_feedback"
    ADD CONSTRAINT "packing_label_feedback_packing_list_id_fkey" FOREIGN KEY ("packing_list_id") REFERENCES "public"."packing_list"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packing_label_feedback"
    ADD CONSTRAINT "packing_label_feedback_packing_list_ligne_id_fkey" FOREIGN KEY ("packing_list_ligne_id") REFERENCES "public"."packing_list_ligne"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packing_label_feedback"
    ADD CONSTRAINT "packing_label_feedback_suggested_category_id_fkey" FOREIGN KEY ("suggested_category_id") REFERENCES "public"."categories_gestion"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."packing_list_ligne"
    ADD CONSTRAINT "packing_list_ligne_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories_gestion"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."packing_list_ligne"
    ADD CONSTRAINT "packing_list_ligne_packing_list_id_fkey" FOREIGN KEY ("packing_list_id") REFERENCES "public"."packing_list"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packing_list_ligne"
    ADD CONSTRAINT "packing_list_ligne_suggested_category_id_fkey" FOREIGN KEY ("suggested_category_id") REFERENCES "public"."categories_gestion"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."palettes"
    ADD CONSTRAINT "palettes_livraison_id_fkey" FOREIGN KEY ("livraison_id") REFERENCES "public"."livraisons_boutique"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."plan_layout_handpick"
    ADD CONSTRAINT "plan_layout_handpick_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product"
    ADD CONSTRAINT "product_fournisseur_fkey" FOREIGN KEY ("fournisseur") REFERENCES "public"."Fournisseur_crm"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product"
    ADD CONSTRAINT "product_type_fkey" FOREIGN KEY ("type") REFERENCES "public"."Type_product_CRM"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."project_sprints"
    ADD CONSTRAINT "project_sprints_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."project_sprints"
    ADD CONSTRAINT "project_sprints_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."project_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_task_attachments"
    ADD CONSTRAINT "project_task_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_task_attachments"
    ADD CONSTRAINT "project_task_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_tasks"
    ADD CONSTRAINT "project_tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."project_tasks"
    ADD CONSTRAINT "project_tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id");



ALTER TABLE ONLY "public"."project_tasks"
    ADD CONSTRAINT "project_tasks_last_moved_by_fkey" FOREIGN KEY ("last_moved_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_tasks"
    ADD CONSTRAINT "project_tasks_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "public"."project_sprints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_team_members"
    ADD CONSTRAINT "project_team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."project_teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_team_members"
    ADD CONSTRAINT "project_team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_teams"
    ADD CONSTRAINT "project_teams_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rdv_reschedule_mail_queue"
    ADD CONSTRAINT "rdv_reschedule_mail_queue_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."Event_calendar"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roles_permissions"
    ADD CONSTRAINT "roles_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roles_permissions"
    ADD CONSTRAINT "roles_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services_permissions"
    ADD CONSTRAINT "services_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."services_permissions"
    ADD CONSTRAINT "services_permissions_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sorting_reports"
    ADD CONSTRAINT "sorting_reports_fournisseur_uid_fkey" FOREIGN KEY ("fournisseur_uid") REFERENCES "public"."fournisseur"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sorting_reports"
    ADD CONSTRAINT "sorting_reports_uid_balle_fkey" FOREIGN KEY ("uid_balle") REFERENCES "public"."balles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sorting_reports"
    ADD CONSTRAINT "sorting_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_chat_table"
    ADD CONSTRAINT "ticket_chat_table_assigned_user_fkey" FOREIGN KEY ("assigned_user") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_chat_table"
    ADD CONSTRAINT "ticket_chat_table_owner_user_fkey" FOREIGN KEY ("owner_user") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_chat_table"
    ADD CONSTRAINT "ticket_chat_table_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."ticket_table"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_message"
    ADD CONSTRAINT "ticket_message_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."ticket_chat_table"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_message"
    ADD CONSTRAINT "ticket_message_send_by_fkey" FOREIGN KEY ("send_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_table"
    ADD CONSTRAINT "ticket_table_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_table"
    ADD CONSTRAINT "ticket_table_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_participants"
    ADD CONSTRAINT "tournament_participants_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tournament_participants"
    ADD CONSTRAINT "tournament_participants_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_crm_analytics_layout"
    ADD CONSTRAINT "user_crm_analytics_layout_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_preferences"
    ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users_permissions"
    ADD CONSTRAINT "users_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wiki_article_views"
    ADD CONSTRAINT "wiki_article_views_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "public"."wiki_articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wiki_article_views"
    ADD CONSTRAINT "wiki_article_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wiki_articles"
    ADD CONSTRAINT "wiki_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."wiki_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."wiki_categories"
    ADD CONSTRAINT "wiki_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."wiki_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zones_handpick"
    ADD CONSTRAINT "zones_handpick_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zones_handpick"
    ADD CONSTRAINT "zones_handpick_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."zones_handpick"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zones_magasin"
    ADD CONSTRAINT "zones_magasin_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zones_magasin"
    ADD CONSTRAINT "zones_magasin_magasin_id_fkey" FOREIGN KEY ("magasin_id") REFERENCES "public"."magasins"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zones_magasin"
    ADD CONSTRAINT "zones_magasin_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."zones_magasin"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can update profiles" ON "public"."profiles" FOR UPDATE USING ("public"."user_is_global_admin"()) WITH CHECK ("public"."user_is_global_admin"());



CREATE POLICY "All authenticated users can view KPIs" ON "public"."kpis" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow all operations on results" ON "public"."results" USING (true);



CREATE POLICY "Authenticated can read amelia submissions" ON "public"."client_amelia_submissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can create teams they own" ON "public"."project_teams" FOR INSERT WITH CHECK ((("owner_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."user_can_create_projects"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Authenticated users can view changelog categories" ON "public"."changelog_categories" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));



CREATE POLICY "Authenticated users — brief" ON "public"."bibliotheque_brief" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users — format reponses" ON "public"."bibliotheque_format_reponses" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users — qas" ON "public"."bibliotheque_questions_reponses" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users — thematiques" ON "public"."bibliotheque_thematiques" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Enable delete for owners or admins" ON "public"."project_teams" FOR DELETE USING ((("owner_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."user_can_manage_projects"(( SELECT "auth"."uid"() AS "uid")) AS "user_can_manage_projects") OR ( SELECT "public"."user_is_global_admin"(( SELECT "auth"."uid"() AS "uid")) AS "user_is_global_admin")));



CREATE POLICY "Everyone can view matches" ON "public"."matches" FOR SELECT USING (true);



CREATE POLICY "Everyone can view ping pong players" ON "public"."ping_pong_players" FOR SELECT USING (true);



CREATE POLICY "Everyone can view tournament participants" ON "public"."tournament_participants" FOR SELECT USING (true);



CREATE POLICY "Everyone can view tournaments" ON "public"."tournaments" FOR SELECT USING (true);



CREATE POLICY "Group creators can update their groups" ON "public"."groups" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "Managers can add members" ON "public"."project_team_members" FOR INSERT WITH CHECK (("public"."user_can_manage_projects"(( SELECT "auth"."uid"() AS "uid")) AND (("public"."user_service_slug"(( SELECT "auth"."uid"() AS "uid")) = 'tech'::"text") OR ("public"."user_service_slug"(( SELECT "auth"."uid"() AS "uid")) = "public"."project_owner_service_slug"("team_id"))) AND "public"."user_has_project_service"("user_id")));



CREATE POLICY "Managers can update members" ON "public"."project_team_members" FOR UPDATE USING (("public"."user_can_manage_projects"(( SELECT "auth"."uid"() AS "uid")) AND (("public"."user_service_slug"(( SELECT "auth"."uid"() AS "uid")) = 'tech'::"text") OR ("public"."user_service_slug"(( SELECT "auth"."uid"() AS "uid")) = "public"."project_owner_service_slug"("team_id"))))) WITH CHECK (("public"."user_can_manage_projects"(( SELECT "auth"."uid"() AS "uid")) AND (("public"."user_service_slug"(( SELECT "auth"."uid"() AS "uid")) = 'tech'::"text") OR ("public"."user_service_slug"(( SELECT "auth"."uid"() AS "uid")) = "public"."project_owner_service_slug"("team_id")))));



CREATE POLICY "Members can view team membership" ON "public"."project_team_members" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR ( SELECT "public"."user_is_global_admin"(( SELECT "auth"."uid"() AS "uid")) AS "user_is_global_admin") OR (( SELECT "public"."user_can_manage_projects"(( SELECT "auth"."uid"() AS "uid")) AS "user_can_manage_projects") AND (("public"."user_service_slug"(( SELECT "auth"."uid"() AS "uid")) = 'tech'::"text") OR ("public"."user_service_slug"(( SELECT "auth"."uid"() AS "uid")) = "public"."project_owner_service_slug"("team_id"))))));



CREATE POLICY "Members or managers can remove memberships" ON "public"."project_team_members" FOR DELETE USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR ("public"."user_can_manage_projects"(( SELECT "auth"."uid"() AS "uid")) AND (("public"."user_service_slug"(( SELECT "auth"."uid"() AS "uid")) = 'tech'::"text") OR ("public"."user_service_slug"(( SELECT "auth"."uid"() AS "uid")) = "public"."project_owner_service_slug"("team_id"))))));



CREATE POLICY "Members or owners can remove memberships" ON "public"."project_team_members" FOR DELETE USING (("public"."user_can_view_projects"(( SELECT "auth"."uid"() AS "uid")) AND ((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."project_teams" "t"
  WHERE (("t"."id" = "project_team_members"."team_id") AND ("t"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."user_is_global_admin"(( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "News_service_only" ON "public"."News" AS RESTRICTIVE USING (false) WITH CHECK (false);



CREATE POLICY "Only team owners can delete teams" ON "public"."project_teams" FOR DELETE USING ((("owner_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."user_can_manage_projects"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Only team owners can update teams" ON "public"."project_teams" FOR UPDATE USING ((("owner_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."user_can_manage_projects"(( SELECT "auth"."uid"() AS "uid")))) WITH CHECK ((("owner_id" = ( SELECT "auth"."uid"() AS "uid")) AND "public"."user_can_manage_projects"(( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Owners can add members to their team" ON "public"."project_team_members" FOR INSERT WITH CHECK (("public"."user_can_manage_projects"(( SELECT "auth"."uid"() AS "uid")) AND "public"."user_has_project_service"("user_id") AND (EXISTS ( SELECT 1
   FROM "public"."project_teams" "t"
  WHERE (("t"."id" = "project_team_members"."team_id") AND ("t"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Owners can update member roles" ON "public"."project_team_members" FOR UPDATE USING (("public"."user_can_manage_projects"(( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."project_teams" "t"
  WHERE (("t"."id" = "project_team_members"."team_id") AND ("t"."owner_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK (("public"."user_can_manage_projects"(( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."project_teams" "t"
  WHERE (("t"."id" = "project_team_members"."team_id") AND ("t"."owner_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Project team members can view teams" ON "public"."project_teams" FOR SELECT USING ("public"."user_can_access_project"("id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Service can insert logs" ON "public"."calendar_sync_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Super Admin can delete logs" ON "public"."app_logs" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'Super Admin'::"text")))));



CREATE POLICY "Super Admin can read all logs" ON "public"."app_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'Super Admin'::"text")))));



CREATE POLICY "Super Admin can read retention audit" ON "public"."app_logs_retention_audit" FOR SELECT TO "authenticated" USING (("public"."user_is_global_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE ((("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) OR ("profiles"."user_id" = ( SELECT "auth"."uid"() AS "uid"))) AND ("profiles"."role" = 'Super Admin'::"text"))))));



CREATE POLICY "SuperAdmin and Admin can create roles" ON "public"."roles" FOR INSERT WITH CHECK (true);



CREATE POLICY "SuperAdmin and Admin can create services" ON "public"."services" FOR INSERT WITH CHECK (true);



CREATE POLICY "SuperAdmin and Admin can delete roles" ON "public"."roles" FOR DELETE USING (true);



CREATE POLICY "SuperAdmin and Admin can delete services" ON "public"."services" FOR DELETE USING (true);



CREATE POLICY "SuperAdmin and Admin can update roles" ON "public"."roles" FOR UPDATE USING (true);



CREATE POLICY "SuperAdmin and Admin can update services" ON "public"."services" FOR UPDATE USING (true);



CREATE POLICY "Task viewers can view attachments" ON "public"."project_task_attachments" FOR SELECT TO "authenticated" USING ("public"."user_can_access_task"("task_id"));



CREATE POLICY "Team members can add attachments" ON "public"."project_task_attachments" FOR INSERT TO "authenticated" WITH CHECK ((("uploaded_by" = ( SELECT "auth"."uid"() AS "uid")) AND ("storage_path" ~~ (("task_id")::"text" || '/%'::"text")) AND "public"."user_can_access_task"("task_id", true)));



CREATE POLICY "Team members can create sprints" ON "public"."project_sprints" FOR INSERT WITH CHECK (("public"."user_can_access_project"("team_id", ( SELECT "auth"."uid"() AS "uid")) AND ("public"."user_is_project_team_member"("team_id", ( SELECT "auth"."uid"() AS "uid")) OR "public"."user_can_manage_projects"(( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Team members can create tasks" ON "public"."project_tasks" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."project_sprints" "s"
  WHERE (("s"."id" = "project_tasks"."sprint_id") AND "public"."user_can_access_project"("s"."team_id", ( SELECT "auth"."uid"() AS "uid")) AND "public"."user_is_project_team_member"("s"."team_id", ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Team members can delete attachments" ON "public"."project_task_attachments" FOR DELETE TO "authenticated" USING ("public"."user_can_access_task"("task_id", true));



CREATE POLICY "Team members can delete tasks" ON "public"."project_tasks" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."project_sprints" "s"
  WHERE (("s"."id" = "project_tasks"."sprint_id") AND "public"."user_can_access_project"("s"."team_id", ( SELECT "auth"."uid"() AS "uid")) AND "public"."user_is_project_team_member"("s"."team_id", ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Team members can update sprints" ON "public"."project_sprints" FOR UPDATE USING ("public"."user_can_access_project"("team_id", ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK ("public"."user_can_access_project"("team_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Team members can update tasks" ON "public"."project_tasks" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."project_sprints" "s"
  WHERE (("s"."id" = "project_tasks"."sprint_id") AND "public"."user_can_access_project"("s"."team_id", ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."project_sprints" "s"
  WHERE (("s"."id" = "project_tasks"."sprint_id") AND "public"."user_can_access_project"("s"."team_id", ( SELECT "auth"."uid"() AS "uid")) AND "public"."user_is_project_team_member"("s"."team_id", ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Team members can view sprints" ON "public"."project_sprints" FOR SELECT USING ("public"."user_can_access_project"("team_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Team members can view tasks" ON "public"."project_tasks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."project_sprints" "s"
  WHERE (("s"."id" = "project_tasks"."sprint_id") AND "public"."user_can_access_project"("s"."team_id", ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Team owners can delete sprints" ON "public"."project_sprints" FOR DELETE USING (("public"."user_can_manage_projects"(( SELECT "auth"."uid"() AS "uid")) AND "public"."user_can_access_project"("team_id", ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "Tournament members manage matches" ON "public"."matches" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = ( SELECT "tournaments"."created_by"
   FROM "public"."tournaments"
  WHERE ("tournaments"."id" = "matches"."tournament_id"))));



CREATE POLICY "Tournament members update matches" ON "public"."matches" FOR UPDATE USING (((( SELECT "auth"."uid"() AS "uid") = ( SELECT "tournaments"."created_by"
   FROM "public"."tournaments"
  WHERE ("tournaments"."id" = "matches"."tournament_id"))) OR (( SELECT "auth"."uid"() AS "uid") = "player1_id") OR (( SELECT "auth"."uid"() AS "uid") = "player2_id"))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = ( SELECT "tournaments"."created_by"
   FROM "public"."tournaments"
  WHERE ("tournaments"."id" = "matches"."tournament_id"))) OR (( SELECT "auth"."uid"() AS "uid") = "player1_id") OR (( SELECT "auth"."uid"() AS "uid") = "player2_id")));



CREATE POLICY "Tournament owner deletes tournaments" ON "public"."tournaments" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "Tournament owner manages participants" ON "public"."tournament_participants" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = ( SELECT "tournaments"."created_by"
   FROM "public"."tournaments"
  WHERE ("tournaments"."id" = "tournament_participants"."tournament_id"))));



CREATE POLICY "Tournament owner manages tournaments" ON "public"."tournaments" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "created_by")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "Tournament owner removes participants" ON "public"."tournament_participants" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = ( SELECT "tournaments"."created_by"
   FROM "public"."tournaments"
  WHERE ("tournaments"."id" = "tournament_participants"."tournament_id"))));



CREATE POLICY "Tournament owner updates participants" ON "public"."tournament_participants" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = ( SELECT "tournaments"."created_by"
   FROM "public"."tournaments"
  WHERE ("tournaments"."id" = "tournament_participants"."tournament_id")))) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = ( SELECT "tournaments"."created_by"
   FROM "public"."tournaments"
  WHERE ("tournaments"."id" = "tournament_participants"."tournament_id"))));



CREATE POLICY "Users access own mappings" ON "public"."calendar_sync_mappings" USING (("connection_id" IN ( SELECT "outlook_connections"."id"
   FROM "public"."outlook_connections"
  WHERE ("outlook_connections"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users access own subscriptions" ON "public"."outlook_webhook_subscriptions" USING (("connection_id" IN ( SELECT "outlook_connections"."id"
   FROM "public"."outlook_connections"
  WHERE ("outlook_connections"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users can claim unassigned tickets" ON "public"."tickets" FOR UPDATE USING ((("assigned_to" IS NULL) AND (( SELECT "auth"."uid"() AS "uid") <> "user_id"))) WITH CHECK (("assigned_to" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "Users can create content" ON "public"."content_generation" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can create direct conversations" ON "public"."direct_conversations" FOR INSERT WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_a") OR (( SELECT "auth"."uid"() AS "uid") = "user_b")));



CREATE POLICY "Users can create groups" ON "public"."groups" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "Users can create their own ping pong profile" ON "public"."ping_pong_players" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can create tickets" ON "public"."tickets" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can create tournaments" ON "public"."tournaments" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "Users can delete direct conversations" ON "public"."direct_conversations" FOR DELETE USING (((( SELECT "auth"."uid"() AS "uid") = "user_a") OR (( SELECT "auth"."uid"() AS "uid") = "user_b")));



CREATE POLICY "Users can delete messages" ON "public"."messages" FOR DELETE USING (((( SELECT "auth"."uid"() AS "uid") = "sender_id") OR (COALESCE("group_id", "groupe_id") IN ( SELECT "groups"."id"
   FROM "public"."groups"
  WHERE ("groups"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can delete own connections" ON "public"."outlook_connections" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete own shared exportkey" ON "public"."cryptedmessage_shared_exportkeys" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can delete their completed tickets" ON "public"."tickets" FOR DELETE USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") AND ("status" = 'Terminé'::"text")));



CREATE POLICY "Users can delete their own preferences" ON "public"."user_preferences" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own connections" ON "public"."outlook_connections" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own logs" ON "public"."app_logs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert own shared exportkey" ON "public"."cryptedmessage_shared_exportkeys" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own preferences" ON "public"."user_preferences" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can manage crypted key bundles" ON "public"."cryptedmessage_keybundles" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can manage crypted keys" ON "public"."cryptedmessage_userkeys" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can read crypted public keys" ON "public"."cryptedmessage_userkeys" FOR SELECT USING (true);



CREATE POLICY "Users can read own shared exportkey" ON "public"."cryptedmessage_shared_exportkeys" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can send crypted messages" ON "public"."cryptedmessage" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "sender_id"));



CREATE POLICY "Users can send messages" ON "public"."messages" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "sender_id"));



CREATE POLICY "Users can update crypted messages" ON "public"."cryptedmessage" FOR UPDATE USING (((( SELECT "auth"."uid"() AS "uid") = "sender_id") OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id"))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "sender_id") OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id")));



CREATE POLICY "Users can update direct conversations" ON "public"."direct_conversations" FOR UPDATE USING (((( SELECT "auth"."uid"() AS "uid") = "user_a") OR (( SELECT "auth"."uid"() AS "uid") = "user_b"))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "user_a") OR (( SELECT "auth"."uid"() AS "uid") = "user_b")));



CREATE POLICY "Users can update messages" ON "public"."messages" FOR UPDATE USING (((( SELECT "auth"."uid"() AS "uid") = "sender_id") OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id") OR (COALESCE("group_id", "groupe_id") IN ( SELECT "groups"."id"
   FROM "public"."groups"
  WHERE ("groups"."created_by" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "sender_id") OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id") OR (COALESCE("group_id", "groupe_id") IN ( SELECT "groups"."id"
   FROM "public"."groups"
  WHERE ("groups"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can update own connections" ON "public"."outlook_connections" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update own shared exportkey" ON "public"."cryptedmessage_shared_exportkeys" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update relevant tickets" ON "public"."tickets" FOR UPDATE USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (( SELECT "auth"."uid"() AS "uid") = "assigned_to")));



CREATE POLICY "Users can update their content" ON "public"."content_generation" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own ping pong profile" ON "public"."ping_pong_players" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own preferences" ON "public"."user_preferences" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view all groups" ON "public"."groups" FOR SELECT USING (true);



CREATE POLICY "Users can view all profiles" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Users can view all roles" ON "public"."roles" FOR SELECT USING (true);



CREATE POLICY "Users can view all services" ON "public"."services" FOR SELECT USING (true);



CREATE POLICY "Users can view changelog items of visible versions" ON "public"."changelog_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."changelog_versions" "v"
  WHERE (("v"."id" = "changelog_items"."version_id") AND (("v"."status" = 'published'::"public"."changelog_version_status") OR "public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'manager.changelog'::"text"))))));



CREATE POLICY "Users can view crypted messages" ON "public"."cryptedmessage" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "sender_id") OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id")));



CREATE POLICY "Users can view own connections" ON "public"."outlook_connections" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view published changelog versions" ON "public"."changelog_versions" FOR SELECT USING ((("status" = 'published'::"public"."changelog_version_status") OR "public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'manager.changelog'::"text")));



CREATE POLICY "Users can view relevant tickets" ON "public"."tickets" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "user_id") OR (( SELECT "auth"."uid"() AS "uid") = "assigned_to") OR ("assigned_to" IS NULL)));



CREATE POLICY "Users can view their direct conversations" ON "public"."direct_conversations" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "user_a") OR (( SELECT "auth"."uid"() AS "uid") = "user_b")));



CREATE POLICY "Users can view their messages" ON "public"."messages" FOR SELECT USING (((( SELECT "auth"."uid"() AS "uid") = "sender_id") OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id") OR (("chat_id" IS NOT NULL) AND ("chat_id" IN ( SELECT "created_chat"."id_chat"
   FROM "public"."created_chat"
  WHERE (("created_chat"."created_by" = ( SELECT "auth"."uid"() AS "uid")) OR ("created_chat"."with_id" = ( SELECT "auth"."uid"() AS "uid")))))) OR ((COALESCE("group_id", "groupe_id") IS NOT NULL) AND ((COALESCE("group_id", "groupe_id") IN ( SELECT "groups"."id"
   FROM "public"."groups"
  WHERE ("groups"."created_by" = ( SELECT "auth"."uid"() AS "uid")))) OR (COALESCE("group_id", "groupe_id") IN ( SELECT "groupe_participant"."group_id"
   FROM "public"."groupe_participant"
  WHERE ("groupe_participant"."participant" = ( SELECT "auth"."uid"() AS "uid"))))))));



CREATE POLICY "Users can view their own content" ON "public"."content_generation" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users can view their own individual permissions" ON "public"."users_permissions" FOR SELECT USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'users.update'::"text")));



CREATE POLICY "Users can view their own preferences" ON "public"."user_preferences" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "Users view own logs" ON "public"."calendar_sync_logs" FOR SELECT USING (("connection_id" IN ( SELECT "outlook_connections"."id"
   FROM "public"."outlook_connections"
  WHERE ("outlook_connections"."user_id" = ( SELECT "auth"."uid"() AS "uid")))));



CREATE POLICY "Users with changelogs.create can insert changelog versions" ON "public"."changelog_versions" FOR INSERT WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'changelogs.create'::"text"));



CREATE POLICY "Users with changelogs.delete can delete changelog versions" ON "public"."changelog_versions" FOR DELETE USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'changelogs.delete'::"text"));



CREATE POLICY "Users with changelogs.edit can update changelog versions" ON "public"."changelog_versions" FOR UPDATE USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'changelogs.edit'::"text")) WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'changelogs.edit'::"text"));



CREATE POLICY "Users with manager.changelog can delete changelog categories" ON "public"."changelog_categories" FOR DELETE USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'manager.changelog'::"text"));



CREATE POLICY "Users with manager.changelog can insert changelog categories" ON "public"."changelog_categories" FOR INSERT WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'manager.changelog'::"text"));



CREATE POLICY "Users with manager.changelog can update changelog categories" ON "public"."changelog_categories" FOR UPDATE USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'manager.changelog'::"text")) WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'manager.changelog'::"text"));



CREATE POLICY "Users with users.update can grant individual permissions" ON "public"."users_permissions" FOR INSERT WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'users.update'::"text"));



CREATE POLICY "Users with users.update can revoke individual permissions" ON "public"."users_permissions" FOR DELETE USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'users.update'::"text"));



CREATE POLICY "Users with wiki.manage can delete wiki articles" ON "public"."wiki_articles" FOR DELETE USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'wiki.manage'::"text"));



CREATE POLICY "Users with wiki.manage can delete wiki categories" ON "public"."wiki_categories" FOR DELETE USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'wiki.manage'::"text"));



CREATE POLICY "Users with wiki.manage can insert wiki articles" ON "public"."wiki_articles" FOR INSERT WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'wiki.manage'::"text"));



CREATE POLICY "Users with wiki.manage can insert wiki categories" ON "public"."wiki_categories" FOR INSERT WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'wiki.manage'::"text"));



CREATE POLICY "Users with wiki.manage can update wiki articles" ON "public"."wiki_articles" FOR UPDATE USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'wiki.manage'::"text")) WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'wiki.manage'::"text"));



CREATE POLICY "Users with wiki.manage can update wiki categories" ON "public"."wiki_categories" FOR UPDATE USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'wiki.manage'::"text")) WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'wiki.manage'::"text"));



CREATE POLICY "Users with wiki.view can view wiki articles" ON "public"."wiki_articles" FOR SELECT USING (("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'wiki.view'::"text") AND (("status" = 'published'::"text") OR "public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'wiki.manage'::"text"))));



CREATE POLICY "Users with wiki.view can view wiki categories" ON "public"."wiki_categories" FOR SELECT USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'wiki.view'::"text"));



ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_log_handpick" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_log_handpick_select" ON "public"."activity_log_handpick" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.history.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "admin_can_read_all_subscriptions" ON "public"."newsletter_subscriptions" FOR SELECT USING ("public"."has_permission"('users.view'::"text"));



CREATE POLICY "ai_watch_reports_delete" ON "public"."ai_watch_reports" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'veille.admin'::"text"));



CREATE POLICY "ai_watch_reports_insert" ON "public"."ai_watch_reports" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'veille.admin'::"text"));



CREATE POLICY "ai_watch_reports_select" ON "public"."ai_watch_reports" FOR SELECT TO "authenticated" USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'veille.view'::"text"));



CREATE POLICY "ai_watch_reports_service_write" ON "public"."ai_watch_reports" TO "content_generation" USING (true) WITH CHECK (true);



CREATE POLICY "ai_watch_reports_update" ON "public"."ai_watch_reports" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'veille.admin'::"text")) WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'veille.admin'::"text"));



CREATE POLICY "amelia_company_closures_service_only" ON "public"."amelia_company_closures" AS RESTRICTIVE USING (false) WITH CHECK (false);



CREATE POLICY "amelia_company_days_off_service_only" ON "public"."amelia_company_days_off" AS RESTRICTIVE USING (false) WITH CHECK (false);



CREATE POLICY "amelia_company_special_service_only" ON "public"."amelia_company_special" AS RESTRICTIVE USING (false) WITH CHECK (false);



CREATE POLICY "amelia_company_weekly_service_only" ON "public"."amelia_company_weekly" AS RESTRICTIVE USING (false) WITH CHECK (false);



ALTER TABLE "public"."analytics_export_collaborators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."annonce" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "annonce_delete" ON "public"."annonce" FOR DELETE TO "authenticated" USING (( SELECT "public"."has_permission"('manager.annonce'::"text") AS "has_permission"));



CREATE POLICY "annonce_insert" ON "public"."annonce" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."has_permission"('manager.annonce'::"text") AS "has_permission"));



CREATE POLICY "annonce_select" ON "public"."annonce" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('manager.annonce'::"text") AS "has_permission") OR (("archived_at" IS NULL) AND ("start_date" <= "now"()) AND (("end_date" IS NULL) OR ("end_date" > "now"())) AND "public"."annonce_targets_viewer"("target_role_ids", "target_service_ids"))));



CREATE POLICY "annonce_update" ON "public"."annonce" FOR UPDATE TO "authenticated" USING (( SELECT "public"."has_permission"('manager.annonce'::"text") AS "has_permission")) WITH CHECK (( SELECT "public"."has_permission"('manager.annonce'::"text") AS "has_permission"));



ALTER TABLE "public"."app_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_logs_delete" ON "public"."app_logs" FOR DELETE TO "authenticated" USING (( SELECT "public"."has_permission"('manager.console'::"text") AS "has_permission"));



CREATE POLICY "app_logs_insert_own" ON "public"."app_logs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."app_logs_retention_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."app_logs_retention_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_logs_retention_config_service_only" ON "public"."app_logs_retention_config" AS RESTRICTIVE USING (false) WITH CHECK (false);



CREATE POLICY "app_logs_select" ON "public"."app_logs" FOR SELECT TO "authenticated" USING (( SELECT "public"."has_permission"('manager.console'::"text") AS "has_permission"));



ALTER TABLE "public"."app_maintenance" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "app_maintenance_delete" ON "public"."app_maintenance" FOR DELETE TO "authenticated" USING (( SELECT "public"."has_permission"('manager.maintenance'::"text") AS "has_permission"));



CREATE POLICY "app_maintenance_insert" ON "public"."app_maintenance" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."has_permission"('manager.maintenance'::"text") AS "has_permission"));



CREATE POLICY "app_maintenance_select" ON "public"."app_maintenance" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "app_maintenance_update" ON "public"."app_maintenance" FOR UPDATE TO "authenticated" USING (( SELECT "public"."has_permission"('manager.maintenance'::"text") AS "has_permission")) WITH CHECK (( SELECT "public"."has_permission"('manager.maintenance'::"text") AS "has_permission"));



CREATE POLICY "arrivage_admin_can_update_stats_preference" ON "public"."newsletter_subscriptions" FOR UPDATE USING ("public"."has_permission"('stock.arrivage.newsletter.admin'::"text")) WITH CHECK ("public"."has_permission"('stock.arrivage.newsletter.admin'::"text"));



ALTER TABLE "public"."arrivage_manuel" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "arrivage_manuel_delete" ON "public"."arrivage_manuel" FOR DELETE USING (("public"."has_permission"('stock.arrivage.delete'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "arrivage_manuel_insert" ON "public"."arrivage_manuel" FOR INSERT WITH CHECK (("public"."has_permission"('stock.arrivage.create'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "arrivage_manuel_select" ON "public"."arrivage_manuel" FOR SELECT USING (("public"."has_permission"('stock.arrivage.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "arrivage_manuel_update" ON "public"."arrivage_manuel" FOR UPDATE USING (("public"."has_permission"('stock.arrivage.update'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK (("public"."has_permission"('stock.arrivage.update'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."arrivage_subscribers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth_insert_activity_log" ON "public"."activity_log" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "auth_insert_price_history" ON "public"."category_price_history" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "auth_read_activity_log" ON "public"."activity_log" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth_read_price_history" ON "public"."category_price_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated_can_create_groups" ON "public"."cryptedmessage_groups" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "balles_delete" ON "public"."balles" FOR DELETE TO "authenticated" USING (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."balles_emplacements_handpick" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "balles_emplacements_handpick_select" ON "public"."balles_emplacements_handpick" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.inventaire.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."balles_handpick" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "balles_handpick_delete" ON "public"."balles_handpick" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.inventaire.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "balles_handpick_insert" ON "public"."balles_handpick" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.inventaire.create'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "balles_handpick_select" ON "public"."balles_handpick" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.inventaire.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "balles_handpick_update" ON "public"."balles_handpick" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.inventaire.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.inventaire.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "balles_insert" ON "public"."balles" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "bibliotheque.manage can delete brief" ON "public"."bibliotheque_brief" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'bibliotheque.manage'::"text"));



CREATE POLICY "bibliotheque.manage can delete format reponses" ON "public"."bibliotheque_format_reponses" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'bibliotheque.manage'::"text"));



CREATE POLICY "bibliotheque.manage can delete qas" ON "public"."bibliotheque_questions_reponses" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'bibliotheque.manage'::"text"));



CREATE POLICY "bibliotheque.manage can delete thematiques" ON "public"."bibliotheque_thematiques" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'bibliotheque.manage'::"text"));



CREATE POLICY "bibliotheque.manage can insert brief" ON "public"."bibliotheque_brief" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'bibliotheque.manage'::"text"));



CREATE POLICY "bibliotheque.manage can insert format reponses" ON "public"."bibliotheque_format_reponses" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'bibliotheque.manage'::"text"));



CREATE POLICY "bibliotheque.manage can insert qas" ON "public"."bibliotheque_questions_reponses" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'bibliotheque.manage'::"text"));



CREATE POLICY "bibliotheque.manage can update brief" ON "public"."bibliotheque_brief" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'bibliotheque.manage'::"text")) WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'bibliotheque.manage'::"text"));



CREATE POLICY "bibliotheque.manage can update format reponses" ON "public"."bibliotheque_format_reponses" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'bibliotheque.manage'::"text")) WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'bibliotheque.manage'::"text"));



CREATE POLICY "bibliotheque.manage can update qas" ON "public"."bibliotheque_questions_reponses" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'bibliotheque.manage'::"text")) WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'bibliotheque.manage'::"text"));



CREATE POLICY "bibliotheque.manage can update thematiques" ON "public"."bibliotheque_thematiques" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'bibliotheque.manage'::"text")) WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'bibliotheque.manage'::"text"));



CREATE POLICY "bibliotheque.manage can write thematiques" ON "public"."bibliotheque_thematiques" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'bibliotheque.manage'::"text"));



CREATE POLICY "bibliotheque.view can read brief" ON "public"."bibliotheque_brief" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "bibliotheque.view can read format reponses" ON "public"."bibliotheque_format_reponses" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "bibliotheque.view can read qas" ON "public"."bibliotheque_questions_reponses" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "bibliotheque.view can read thematiques" ON "public"."bibliotheque_thematiques" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."bibliotheque_brief" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bibliotheque_format_reponses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bibliotheque_questions_reponses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bibliotheque_thematiques" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."boutiques" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "boutiques_select" ON "public"."boutiques" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.commandes.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "boutiques_write" ON "public"."boutiques" TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.commandes.manage'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('stock.commandes.manage'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."brief_cat" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_sync_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calendar_sync_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cartons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cartons_select" ON "public"."cartons" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.commandes.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "cartons_write" ON "public"."cartons" TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.commandes.manage'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2") AND "public"."livraison_modifiable"("livraison_id"))) WITH CHECK ((( SELECT "public"."has_permission"('stock.commandes.manage'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2") AND "public"."livraison_modifiable"("livraison_id")));



ALTER TABLE "public"."categories_gestion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_gestion_delete" ON "public"."categories_gestion" FOR DELETE USING (("public"."has_permission"('stock.settings.delete'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "categories_gestion_insert" ON "public"."categories_gestion" FOR INSERT WITH CHECK (("public"."has_permission"('stock.settings.create'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "categories_gestion_select" ON "public"."categories_gestion" FOR SELECT USING ((("public"."has_permission"('stock.view'::"text") OR "public"."has_permission"('crm.view'::"text") OR "public"."has_permission"('stock.tri.view'::"text") OR "public"."has_permission"('stock.commandes.view'::"text")) AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "categories_gestion_update" ON "public"."categories_gestion" FOR UPDATE USING (("public"."has_permission"('stock.settings.update'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK (("public"."has_permission"('stock.settings.update'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."categories_handpick" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_handpick_delete" ON "public"."categories_handpick" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.settings.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "categories_handpick_insert" ON "public"."categories_handpick" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.settings.create'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "categories_handpick_select" ON "public"."categories_handpick" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "categories_handpick_update" ON "public"."categories_handpick" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.settings.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.settings.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."category_price_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "changelog_items_delete" ON "public"."changelog_items" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('changelogs.edit'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('changelogs.delete'::"text") AS "has_permission")));



CREATE POLICY "changelog_items_insert" ON "public"."changelog_items" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('changelogs.create'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('changelogs.edit'::"text") AS "has_permission")));



CREATE POLICY "changelog_items_update" ON "public"."changelog_items" FOR UPDATE TO "authenticated" USING (( SELECT "public"."has_permission"('changelogs.edit'::"text") AS "has_permission")) WITH CHECK (( SELECT "public"."has_permission"('changelogs.edit'::"text") AS "has_permission"));



ALTER TABLE "public"."client_amelia_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_newsletter_sends" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commande_lignes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "commande_lignes_boutique" ON "public"."commande_lignes" TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.commandes.boutique'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2") AND "public"."commande_modifiable_boutique"("commande_id"))) WITH CHECK ((( SELECT "public"."has_permission"('stock.commandes.boutique'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2") AND "public"."commande_modifiable_boutique"("commande_id")));



CREATE POLICY "commande_lignes_select" ON "public"."commande_lignes" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.commandes.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "commande_lignes_write" ON "public"."commande_lignes" TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.commandes.manage'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('stock.commandes.manage'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."commandes_boutique" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "commandes_boutique_boutique_insert" ON "public"."commandes_boutique" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('stock.commandes.boutique'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2") AND ("statut" = 'ouverte'::"text")));



CREATE POLICY "commandes_boutique_boutique_update" ON "public"."commandes_boutique" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.commandes.boutique'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2") AND "public"."commande_modifiable_boutique"("id"))) WITH CHECK ((( SELECT "public"."has_permission"('stock.commandes.boutique'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2") AND ("statut" = ANY (ARRAY['ouverte'::"text", 'annulee'::"text"])) AND ("motif_cloture" IS NULL)));



CREATE POLICY "commandes_boutique_select" ON "public"."commandes_boutique" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.commandes.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "commandes_boutique_write" ON "public"."commandes_boutique" TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.commandes.manage'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('stock.commandes.manage'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."content_generation" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crm.brief_options.manage can delete brief options" ON "public"."brief_cat" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.brief_options.manage'::"text"));



CREATE POLICY "crm.brief_options.manage can insert brief options" ON "public"."brief_cat" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.brief_options.manage'::"text"));



CREATE POLICY "crm.brief_options.manage can update brief options" ON "public"."brief_cat" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.brief_options.manage'::"text")) WITH CHECK ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.brief_options.manage'::"text"));



CREATE POLICY "crm.view can read brief options" ON "public"."brief_cat" FOR SELECT TO "authenticated" USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.view'::"text"));



CREATE POLICY "crm.view can read produit recherche monthly stats" ON "public"."crm_produit_recherche_monthly_stats" FOR SELECT TO "authenticated" USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.view'::"text"));



CREATE POLICY "crm.view can read produit recherche stats" ON "public"."crm_produit_recherche_stats" FOR SELECT TO "authenticated" USING ("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'crm.view'::"text"));



CREATE POLICY "crm_client_delete" ON "public"."client_crm" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('crm.view'::"text") AS "has_permission") AND COALESCE((((( SELECT "current_setting"('request.jwt.claims'::"text", true) AS "current_setting"))::"jsonb" ->> 'aal'::"text") = 'aal2'::"text"), false)));



CREATE POLICY "crm_event_update" ON "public"."Event_calendar" FOR UPDATE TO "authenticated" USING ("public"."has_permission"('crm.view'::"text")) WITH CHECK ("public"."has_permission"('crm.view'::"text"));



ALTER TABLE "public"."crm_produit_recherche_monthly_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."crm_produit_recherche_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cryptedmessage" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cryptedmessage_delete" ON "public"."cryptedmessage" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "sender_id"));



ALTER TABLE "public"."cryptedmessage_group_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cryptedmessage_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cryptedmessage_groups_delete" ON "public"."cryptedmessage_groups" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "cryptedmessage_groups_insert" ON "public"."cryptedmessage_groups" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "cryptedmessage_groups_select" ON "public"."cryptedmessage_groups" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "created_by") OR "public"."cmg_is_member"("id", ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "cryptedmessage_groups_update" ON "public"."cryptedmessage_groups" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "cryptedmessage_insert" ON "public"."cryptedmessage" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "sender_id") AND (("chat_id" !~~ 'group:%'::"text") OR "public"."cmg_is_member"(("replace"("chat_id", 'group:'::"text", ''::"text"))::"uuid", ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."cryptedmessage_keybundles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cryptedmessage_select" ON "public"."cryptedmessage" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "sender_id") OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id") OR (("chat_id" ~~ 'group:%'::"text") AND "public"."cmg_is_member"(("replace"("chat_id", 'group:'::"text", ''::"text"))::"uuid", ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."cryptedmessage_shared_exportkeys" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cryptedmessage_update" ON "public"."cryptedmessage" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "sender_id") OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id"))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "sender_id") OR (( SELECT "auth"."uid"() AS "uid") = "recipient_id")));



ALTER TABLE "public"."cryptedmessage_userkeys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."dashboard_layout_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dashboard_layout_templates_delete" ON "public"."dashboard_layout_templates" FOR DELETE TO "authenticated" USING (( SELECT "public"."has_permission"('dashboard.templates.manage'::"text") AS "has_permission"));



CREATE POLICY "dashboard_layout_templates_insert" ON "public"."dashboard_layout_templates" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."has_permission"('dashboard.templates.manage'::"text") AS "has_permission"));



CREATE POLICY "dashboard_layout_templates_select" ON "public"."dashboard_layout_templates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "dashboard_layout_templates_update" ON "public"."dashboard_layout_templates" FOR UPDATE TO "authenticated" USING (( SELECT "public"."has_permission"('dashboard.templates.manage'::"text") AS "has_permission")) WITH CHECK (( SELECT "public"."has_permission"('dashboard.templates.manage'::"text") AS "has_permission"));



CREATE POLICY "deliveries_gestion_delete" ON "public"."deliveries_gestion" FOR DELETE TO "authenticated" USING (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "deliveries_gestion_insert" ON "public"."deliveries_gestion" FOR INSERT TO "authenticated" WITH CHECK (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "deliveries_gestion_update" ON "public"."deliveries_gestion" FOR UPDATE TO "authenticated" USING (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."direct_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emplacements_handpick" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "emplacements_handpick_delete" ON "public"."emplacements_handpick" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.plan.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "emplacements_handpick_insert" ON "public"."emplacements_handpick" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.plan.create'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "emplacements_handpick_select" ON "public"."emplacements_handpick" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "emplacements_handpick_update" ON "public"."emplacements_handpick" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.plan.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.plan.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."emplacements_magasin" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "emplacements_magasin_delete" ON "public"."emplacements_magasin" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "emplacements_magasin_insert" ON "public"."emplacements_magasin" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('magasin.create'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "emplacements_magasin_select" ON "public"."emplacements_magasin" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "emplacements_magasin_update" ON "public"."emplacements_magasin" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('magasin.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."equipements_magasin" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "equipements_magasin_delete" ON "public"."equipements_magasin" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "equipements_magasin_insert" ON "public"."equipements_magasin" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('magasin.create'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "equipements_magasin_select" ON "public"."equipements_magasin" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "equipements_magasin_update" ON "public"."equipements_magasin" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('magasin.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."etages_magasin" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "etages_magasin_delete" ON "public"."etages_magasin" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "etages_magasin_insert" ON "public"."etages_magasin" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('magasin.create'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "etages_magasin_select" ON "public"."etages_magasin" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "etages_magasin_update" ON "public"."etages_magasin" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('magasin.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."factures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "factures_delete" ON "public"."factures" FOR DELETE USING (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "factures_insert" ON "public"."factures" FOR INSERT WITH CHECK (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "factures_select" ON "public"."factures" FOR SELECT USING (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "factures_update" ON "public"."factures" FOR UPDATE USING (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."fiches_tri" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fiches_tri_balles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fiches_tri_balles_select" ON "public"."fiches_tri_balles" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.tri.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "fiches_tri_delete" ON "public"."fiches_tri" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.tri.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."fiches_tri_repartition" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fiches_tri_repartition_select" ON "public"."fiches_tri_repartition" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.tri.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "fiches_tri_select" ON "public"."fiches_tri" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.tri.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."flux_handpick" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "flux_handpick_delete" ON "public"."flux_handpick" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.flux.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "flux_handpick_insert" ON "public"."flux_handpick" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.flux.create'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "flux_handpick_select" ON "public"."flux_handpick" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.flux.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "flux_handpick_update" ON "public"."flux_handpick" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.flux.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.flux.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."fournisseur_gestion" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fournisseur_gestion_delete" ON "public"."fournisseur_gestion" FOR DELETE USING (("public"."has_permission"('stock.settings.delete'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "fournisseur_gestion_insert" ON "public"."fournisseur_gestion" FOR INSERT WITH CHECK (("public"."has_permission"('stock.settings.create'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "fournisseur_gestion_select" ON "public"."fournisseur_gestion" FOR SELECT USING ((("public"."has_permission"('stock.view'::"text") OR "public"."has_permission"('crm.view'::"text") OR "public"."has_permission"('stock.tri.view'::"text")) AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "fournisseur_gestion_update" ON "public"."fournisseur_gestion" FOR UPDATE USING (("public"."has_permission"('stock.settings.update'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK (("public"."has_permission"('stock.settings.update'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."fournisseurs_categories_handpick" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fournisseurs_categories_handpick_delete" ON "public"."fournisseurs_categories_handpick" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.settings.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "fournisseurs_categories_handpick_insert" ON "public"."fournisseurs_categories_handpick" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.settings.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "fournisseurs_categories_handpick_select" ON "public"."fournisseurs_categories_handpick" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "fournisseurs_categories_handpick_update" ON "public"."fournisseurs_categories_handpick" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.settings.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.settings.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."fournisseurs_handpick" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fournisseurs_handpick_delete" ON "public"."fournisseurs_handpick" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.settings.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "fournisseurs_handpick_insert" ON "public"."fournisseurs_handpick" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.settings.create'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "fournisseurs_handpick_select" ON "public"."fournisseurs_handpick" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "fournisseurs_handpick_update" ON "public"."fournisseurs_handpick" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.settings.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.settings.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "gallery_permissions_service_only" ON "public"."gallery_permissions" AS RESTRICTIVE USING (false) WITH CHECK (false);



CREATE POLICY "group_admin_can_delete_group" ON "public"."cryptedmessage_groups" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "group_admin_can_update_group" ON "public"."cryptedmessage_groups" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "group_admin_or_creator_can_add_members" ON "public"."cryptedmessage_group_members" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."cryptedmessage_groups" "g"
  WHERE (("g"."id" = "cryptedmessage_group_members"."group_id") AND ("g"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))) OR "public"."cmg_is_admin"("group_id", ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "group_creator_can_select_own_groups" ON "public"."cryptedmessage_groups" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "created_by"));



CREATE POLICY "group_members_can_leave_or_admin_can_remove" ON "public"."cryptedmessage_group_members" FOR DELETE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."cmg_is_admin"("group_id", ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."cryptedmessage_groups" "g"
  WHERE (("g"."id" = "cryptedmessage_group_members"."group_id") AND ("g"."created_by" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "group_members_can_select_groups" ON "public"."cryptedmessage_groups" FOR SELECT USING ("public"."cmg_is_member"("id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "group_members_can_select_members" ON "public"."cryptedmessage_group_members" FOR SELECT USING ("public"."cmg_is_member"("group_id", ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "group_members_can_update_own_row" ON "public"."cryptedmessage_group_members" FOR UPDATE USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."cmg_is_admin"("group_id", ( SELECT "auth"."uid"() AS "uid"))));



ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "items_delete" ON "public"."items" FOR DELETE USING (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "items_insert" ON "public"."items" FOR INSERT WITH CHECK (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "items_select" ON "public"."items" FOR SELECT USING (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "items_update" ON "public"."items" FOR UPDATE USING (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."kpis" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."livraisons_boutique" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "livraisons_boutique_delete" ON "public"."livraisons_boutique" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.commandes.manage'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2") AND ("statut" = ANY (ARRAY['planifiee'::"text", 'preparation'::"text", 'annulee'::"text"]))));



CREATE POLICY "livraisons_boutique_insert" ON "public"."livraisons_boutique" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('stock.commandes.manage'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2") AND ("statut" = 'planifiee'::"text")));



CREATE POLICY "livraisons_boutique_select" ON "public"."livraisons_boutique" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.commandes.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "livraisons_boutique_update" ON "public"."livraisons_boutique" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.commandes.manage'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2") AND ("statut" <> ALL (ARRAY['receptionnee'::"text", 'litige'::"text", 'annulee'::"text"])))) WITH CHECK ((( SELECT "public"."has_permission"('stock.commandes.manage'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."magasins" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "magasins_delete" ON "public"."magasins" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "magasins_insert" ON "public"."magasins" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('magasin.create'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "magasins_select" ON "public"."magasins" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "magasins_update" ON "public"."magasins" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('magasin.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."mouvements_handpick" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "mouvements_handpick_delete" ON "public"."mouvements_handpick" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.flux.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "mouvements_handpick_insert" ON "public"."mouvements_handpick" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.flux.create'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "mouvements_handpick_select" ON "public"."mouvements_handpick" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.flux.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "mouvements_handpick_update" ON "public"."mouvements_handpick" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.flux.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.flux.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."murs_magasin" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "murs_magasin_delete" ON "public"."murs_magasin" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "murs_magasin_insert" ON "public"."murs_magasin" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('magasin.create'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "murs_magasin_select" ON "public"."murs_magasin" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "murs_magasin_update" ON "public"."murs_magasin" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('magasin.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "newsletter_admin_all_codes" ON "public"."newsletter_invitation_codes" USING ("public"."has_permission"('stock.arrivage.newsletter.admin'::"text"));



CREATE POLICY "newsletter_admin_read_events" ON "public"."newsletter_send_events" FOR SELECT USING (( SELECT "public"."has_permission"('stock.arrivage.newsletter.admin'::"text") AS "has_permission"));



CREATE POLICY "newsletter_admin_read_logs" ON "public"."newsletter_api_logs" FOR SELECT USING (( SELECT "public"."has_permission"('stock.arrivage.newsletter.admin'::"text") AS "has_permission"));



CREATE POLICY "newsletter_admin_read_runs" ON "public"."newsletter_send_runs" FOR SELECT USING (( SELECT "public"."has_permission"('stock.arrivage.newsletter.admin'::"text") AS "has_permission"));



ALTER TABLE "public"."newsletter_api_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "newsletter_clients.send can read sends" ON "public"."client_newsletter_sends" FOR SELECT TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'newsletter_clients.send'::"text"));



ALTER TABLE "public"."newsletter_invitation_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."newsletter_send_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."newsletter_send_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."newsletter_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outlook_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outlook_webhook_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "packages_delete" ON "public"."packages" FOR DELETE USING (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "packages_insert" ON "public"."packages" FOR INSERT WITH CHECK (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "packages_select" ON "public"."packages" FOR SELECT USING (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "packages_update" ON "public"."packages" FOR UPDATE USING (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK (("public"."has_permission"('stock.view'::"text") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."packing_label_category" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "packing_label_category_delete" ON "public"."packing_label_category" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.packing.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "packing_label_category_insert" ON "public"."packing_label_category" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('stock.packing.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "packing_label_category_select" ON "public"."packing_label_category" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.packing.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "packing_label_category_update" ON "public"."packing_label_category" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.packing.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('stock.packing.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."packing_label_feedback" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "packing_label_feedback_select" ON "public"."packing_label_feedback" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.packing.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."packing_list" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "packing_list_delete" ON "public"."packing_list" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.packing.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "packing_list_insert" ON "public"."packing_list" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('stock.packing.create'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."packing_list_ligne" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "packing_list_ligne_delete" ON "public"."packing_list_ligne" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.packing.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "packing_list_ligne_insert" ON "public"."packing_list_ligne" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('stock.packing.create'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2") AND (EXISTS ( SELECT 1
   FROM "public"."packing_list" "p"
  WHERE (("p"."id" = "packing_list_ligne"."packing_list_id") AND ("p"."status" = ANY (ARRAY['en_traitement'::"text", 'a_verifier'::"text"])))))));



CREATE POLICY "packing_list_ligne_select" ON "public"."packing_list_ligne" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.packing.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "packing_list_ligne_update" ON "public"."packing_list_ligne" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.packing.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2") AND (EXISTS ( SELECT 1
   FROM "public"."packing_list" "p"
  WHERE (("p"."id" = "packing_list_ligne"."packing_list_id") AND ("p"."status" = 'a_verifier'::"text")))))) WITH CHECK ((( SELECT "public"."has_permission"('stock.packing.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "packing_list_select" ON "public"."packing_list" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.packing.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "packing_list_update" ON "public"."packing_list" FOR UPDATE TO "authenticated" USING (((( SELECT "public"."has_permission"('stock.packing.update'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('stock.packing.create'::"text") AS "has_permission")) AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK (((( SELECT "public"."has_permission"('stock.packing.update'::"text") AS "has_permission") OR ( SELECT "public"."has_permission"('stock.packing.create'::"text") AS "has_permission")) AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."palettes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "palettes_select" ON "public"."palettes" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.commandes.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "palettes_write" ON "public"."palettes" TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.commandes.manage'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2") AND "public"."livraison_modifiable"("livraison_id"))) WITH CHECK ((( SELECT "public"."has_permission"('stock.commandes.manage'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2") AND "public"."livraison_modifiable"("livraison_id")));



ALTER TABLE "public"."pg_net_watchdog_state" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pg_net_watchdog_state_service_only" ON "public"."pg_net_watchdog_state" AS RESTRICTIVE USING (false) WITH CHECK (false);



ALTER TABLE "public"."ping_pong_players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plan_layout_handpick" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plan_layout_handpick_insert" ON "public"."plan_layout_handpick" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.plan.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "plan_layout_handpick_select" ON "public"."plan_layout_handpick" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.plan.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "plan_layout_handpick_update" ON "public"."plan_layout_handpick" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.plan.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.plan.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "product_image_service_only" ON "public"."product_image" AS RESTRICTIVE USING (false) WITH CHECK (false);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_sprints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_task_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rdv_reschedule_mail_queue" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rdv_reschedule_mail_queue_service_only" ON "public"."rdv_reschedule_mail_queue" AS RESTRICTIVE USING (false) WITH CHECK (false);



CREATE POLICY "read analytics export collaborators" ON "public"."analytics_export_collaborators" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "roles_permissions_admin_delete" ON "public"."roles_permissions" FOR DELETE TO "authenticated" USING (( SELECT "public"."user_is_global_admin"() AS "user_is_global_admin"));



CREATE POLICY "roles_permissions_admin_insert" ON "public"."roles_permissions" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."user_is_global_admin"() AS "user_is_global_admin"));



CREATE POLICY "roles_permissions_admin_update" ON "public"."roles_permissions" FOR UPDATE TO "authenticated" USING (( SELECT "public"."user_is_global_admin"() AS "user_is_global_admin")) WITH CHECK (( SELECT "public"."user_is_global_admin"() AS "user_is_global_admin"));



CREATE POLICY "roles_permissions_admin_write" ON "public"."roles_permissions" TO "authenticated" USING ("public"."user_is_global_admin"()) WITH CHECK ("public"."user_is_global_admin"());



CREATE POLICY "service_role full access" ON "public"."arrivage_subscribers" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_api_logs" ON "public"."newsletter_api_logs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_invitation_codes" ON "public"."newsletter_invitation_codes" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_send_events" ON "public"."newsletter_send_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_send_runs" ON "public"."newsletter_send_runs" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "service_role_subscriptions" ON "public"."newsletter_subscriptions" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."services_permissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "services_permissions_admin_write" ON "public"."services_permissions" TO "authenticated" USING ("public"."user_is_global_admin"()) WITH CHECK ("public"."user_is_global_admin"());



CREATE POLICY "services_permissions_delete" ON "public"."services_permissions" FOR DELETE TO "authenticated" USING (("public"."check_is_service_admin"("service_id") OR ( SELECT "public"."user_is_global_admin"() AS "user_is_global_admin")));



CREATE POLICY "services_permissions_insert" ON "public"."services_permissions" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."check_is_super_admin_global"() AS "check_is_super_admin_global") OR ( SELECT "public"."user_is_global_admin"() AS "user_is_global_admin")));



CREATE POLICY "services_permissions_select" ON "public"."services_permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "services_permissions_update" ON "public"."services_permissions" FOR UPDATE TO "authenticated" USING (("public"."check_is_service_admin"("service_id") OR ( SELECT "public"."user_is_global_admin"() AS "user_is_global_admin"))) WITH CHECK (("public"."check_is_service_admin"("service_id") OR ( SELECT "public"."user_is_global_admin"() AS "user_is_global_admin")));



CREATE POLICY "sorting_reports_insert" ON "public"."sorting_reports" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "ticket_chat_table_insert" ON "public"."ticket_chat_table" FOR INSERT TO "authenticated" WITH CHECK (("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'tickets.view'::"text") OR "public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'reports.view'::"text")));



CREATE POLICY "ticket_chat_table_update" ON "public"."ticket_chat_table" FOR UPDATE TO "authenticated" USING (("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'tickets.view'::"text") OR "public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'reports.view'::"text"))) WITH CHECK (("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'tickets.view'::"text") OR "public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'reports.view'::"text")));



CREATE POLICY "ticket_message_insert" ON "public"."ticket_message" FOR INSERT TO "authenticated" WITH CHECK (("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'tickets.view'::"text") OR "public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'reports.view'::"text")));



CREATE POLICY "ticket_message_update" ON "public"."ticket_message" FOR UPDATE TO "authenticated" USING (("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'tickets.view'::"text") OR "public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'reports.view'::"text"))) WITH CHECK (("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'tickets.view'::"text") OR "public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'reports.view'::"text")));



CREATE POLICY "ticket_table_insert" ON "public"."ticket_table" FOR INSERT TO "authenticated" WITH CHECK (("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'tickets.view'::"text") OR "public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'reports.view'::"text")));



CREATE POLICY "ticket_table_update" ON "public"."ticket_table" FOR UPDATE TO "authenticated" USING (("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'tickets.view'::"text") OR "public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'reports.view'::"text"))) WITH CHECK (("public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'tickets.view'::"text") OR "public"."user_has_permission"(( SELECT "auth"."uid"() AS "uid"), 'reports.view'::"text")));



ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournament_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tournaments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tri_sorties" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tri_sorties_delete" ON "public"."tri_sorties" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.tri.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "tri_sorties_insert" ON "public"."tri_sorties" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('stock.tri.create'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "tri_sorties_select" ON "public"."tri_sorties" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.tri.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "tri_sorties_update" ON "public"."tri_sorties" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.tri.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('stock.tri.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."trieurs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trieurs_delete" ON "public"."trieurs" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.tri.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "trieurs_insert" ON "public"."trieurs" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('stock.tri.create'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "trieurs_select" ON "public"."trieurs" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.tri.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "trieurs_update" ON "public"."trieurs" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock.tri.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('stock.tri.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."user_crm_analytics_layout" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_crm_analytics_layout_delete" ON "public"."user_crm_analytics_layout" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_crm_analytics_layout_insert" ON "public"."user_crm_analytics_layout" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_crm_analytics_layout_select" ON "public"."user_crm_analytics_layout" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_crm_analytics_layout_update" ON "public"."user_crm_analytics_layout" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."user_dashboard_layout" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_dashboard_layout_delete" ON "public"."user_dashboard_layout" FOR DELETE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_dashboard_layout_insert" ON "public"."user_dashboard_layout" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_dashboard_layout_select" ON "public"."user_dashboard_layout" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_dashboard_layout_update" ON "public"."user_dashboard_layout" FOR UPDATE TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



CREATE POLICY "user_owns_own_subscription" ON "public"."newsletter_subscriptions" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));



ALTER TABLE "public"."user_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wiki_article_views" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "wiki_article_views_insert_self" ON "public"."wiki_article_views" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ( SELECT "public"."has_permission"('wiki.view'::"text") AS "has_permission")));



CREATE POLICY "wiki_article_views_select" ON "public"."wiki_article_views" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."has_permission"('wiki.manage'::"text") AS "has_permission")));



CREATE POLICY "wiki_article_views_update_self" ON "public"."wiki_article_views" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."wiki_articles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."wiki_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zones_handpick" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "zones_handpick_delete" ON "public"."zones_handpick" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.plan.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "zones_handpick_insert" ON "public"."zones_handpick" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.plan.create'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "zones_handpick_select" ON "public"."zones_handpick" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "zones_handpick_update" ON "public"."zones_handpick" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('stock_handpick.plan.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('stock_handpick.plan.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



ALTER TABLE "public"."zones_magasin" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "zones_magasin_delete" ON "public"."zones_magasin" FOR DELETE TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.delete'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "zones_magasin_insert" ON "public"."zones_magasin" FOR INSERT TO "authenticated" WITH CHECK ((( SELECT "public"."has_permission"('magasin.create'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "zones_magasin_select" ON "public"."zones_magasin" FOR SELECT TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.view'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



CREATE POLICY "zones_magasin_update" ON "public"."zones_magasin" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."has_permission"('magasin.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2"))) WITH CHECK ((( SELECT "public"."has_permission"('magasin.update'::"text") AS "has_permission") AND ( SELECT "public"."auth_session_is_aal2"() AS "auth_session_is_aal2")));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."Chronos_trg"() TO "anon";
GRANT ALL ON FUNCTION "public"."Chronos_trg"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."Chronos_trg"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."annonce_targets_viewer"("p_role_ids" "uuid"[], "p_service_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."annonce_targets_viewer"("p_role_ids" "uuid"[], "p_service_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."annonce_targets_viewer"("p_role_ids" "uuid"[], "p_service_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."app_maintenance_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."app_maintenance_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_maintenance_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_arrivage_status_transitions"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_arrivage_status_transitions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_arrivage_status_transitions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_elo_on_match"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_elo_on_match"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_elo_on_match"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_flux_handpick_status_transitions"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_flux_handpick_status_transitions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."assign_closer_on_event_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."assign_closer_on_event_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_closer_on_event_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_session_is_aal2"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_session_is_aal2"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_session_is_aal2"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_set_arrivage_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_set_arrivage_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_set_arrivage_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_set_flux_handpick_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_set_flux_handpick_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_set_flux_handpick_status"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."carton_coherence"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."carton_coherence"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."carton_refresh_commande"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."carton_refresh_commande"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."changelog_replace_items"("p_version_id" "uuid", "p_items" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."changelog_replace_items"("p_version_id" "uuid", "p_items" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."changelog_replace_items"("p_version_id" "uuid", "p_items" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_arrivage_invoice_reminder"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_arrivage_invoice_reminder"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_arrivage_invoice_reminder"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_is_service_admin"("target_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_is_service_admin"("target_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_is_service_admin"("target_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_is_super_admin_global"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_is_super_admin_global"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_is_super_admin_global"() TO "service_role";



GRANT ALL ON FUNCTION "public"."client_log_val"("v" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."client_log_val"("v" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."client_log_val"("v" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."client_pipe_label"("p" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."client_pipe_label"("p" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."client_pipe_label"("p" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."cloturer_commande"("p_id" "uuid", "p_motif" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cloturer_commande"("p_id" "uuid", "p_motif" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cloturer_commande"("p_id" "uuid", "p_motif" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cloturer_livraison"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cloturer_livraison"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cloturer_livraison"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cm_can_access_chat_folder"("p_folder" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cm_can_access_chat_folder"("p_folder" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cm_can_access_chat_folder"("p_folder" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cm_can_access_chat_folder"("p_folder" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cmg_is_admin"("p_group_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cmg_is_admin"("p_group_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cmg_is_admin"("p_group_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cmg_is_member"("p_group_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."cmg_is_member"("p_group_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cmg_is_member"("p_group_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."code_commande"("p_numero" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."code_commande"("p_numero" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."code_commande"("p_numero" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."code_livraison"("p_numero" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."code_livraison"("p_numero" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."code_livraison"("p_numero" bigint) TO "service_role";



REVOKE ALL ON FUNCTION "public"."commande_boutique_notify"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."commande_boutique_notify"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."commande_ligne_refresh"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."commande_ligne_refresh"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."commande_modifiable_boutique"("p_commande_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."commande_modifiable_boutique"("p_commande_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."commande_modifiable_boutique"("p_commande_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."commandes_exiger"("p_permission" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."commandes_exiger"("p_permission" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."commandes_exiger"("p_permission" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_events_on_client_column_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."confirm_events_on_client_column_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_events_on_client_column_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."count_clients_filtered"("p_user_id" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."count_clients_filtered"("p_user_id" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_clients_filtered"("p_user_id" "uuid", "p_start" timestamp with time zone, "p_end" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_relance_tasks_on_rdv_achat"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_relance_tasks_on_rdv_achat"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_relance_tasks_on_rdv_achat"() TO "service_role";



GRANT ALL ON FUNCTION "public"."crm_analytics_layout_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."crm_analytics_layout_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."crm_analytics_layout_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."crm_parse_brief"("p_brief" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."crm_parse_brief"("p_brief" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."crm_parse_brief"("p_brief" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."dashboard_layout_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."dashboard_layout_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."dashboard_layout_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."detach_eclatees_from_fournisseur_handpick"() TO "anon";
GRANT ALL ON FUNCTION "public"."detach_eclatees_from_fournisseur_handpick"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."detach_eclatees_from_fournisseur_handpick"() TO "service_role";



GRANT ALL ON FUNCTION "public"."emplacements_magasin_check_zone"() TO "anon";
GRANT ALL ON FUNCTION "public"."emplacements_magasin_check_zone"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."emplacements_magasin_check_zone"() TO "service_role";



GRANT ALL ON FUNCTION "public"."equipements_magasin_check_zone"() TO "anon";
GRANT ALL ON FUNCTION "public"."equipements_magasin_check_zone"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."equipements_magasin_check_zone"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."expedier_livraison"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expedier_livraison"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."expedier_livraison"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fiche_tri_label"("p_numero" bigint, "p_trieur_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fiche_tri_label"("p_numero" bigint, "p_trieur_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."fiche_tri_resume"("p_fiche_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."fiche_tri_resume"("p_fiche_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finaliser_livraison"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finaliser_livraison"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."flush_rdv_reschedule_mails"() TO "anon";
GRANT ALL ON FUNCTION "public"."flush_rdv_reschedule_mails"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."flush_rdv_reschedule_mails"() TO "service_role";



GRANT ALL ON FUNCTION "public"."function_call_go_api_on_new_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."function_call_go_api_on_new_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."function_call_go_api_on_new_event"() TO "service_role";



GRANT ALL ON TABLE "public"."app_logs_retention_audit" TO "anon";
GRANT ALL ON TABLE "public"."app_logs_retention_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."app_logs_retention_audit" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_app_logs_retention_audit"("p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_app_logs_retention_audit"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_app_logs_retention_audit"("p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_client_column_counts"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_client_column_counts"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_client_column_counts"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."Event_calendar" TO "anon";
GRANT ALL ON TABLE "public"."Event_calendar" TO "authenticated";
GRANT ALL ON TABLE "public"."Event_calendar" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_crm_event_stats"("p_range_start" timestamp with time zone, "p_range_end" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_crm_event_stats"("p_range_start" timestamp with time zone, "p_range_end" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_crm_event_stats"("p_range_start" timestamp with time zone, "p_range_end" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_permissions"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_permissions"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_permissions"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_visible_watch_configs"("p_user_id" "uuid", "p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_visible_watch_configs"("p_user_id" "uuid", "p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_visible_watch_configs"("p_user_id" "uuid", "p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_visible_watch_reports"("p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_visible_watch_reports"("p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_visible_watch_reports"("p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_visible_watch_reports"("p_user_id" "uuid", "p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_visible_watch_reports"("p_user_id" "uuid", "p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_visible_watch_reports"("p_user_id" "uuid", "p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handpick_emplacement_path"("p_emplacement_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."handpick_emplacement_path"("p_emplacement_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handpick_emplacement_path"("p_emplacement_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handpick_log_description"("entity_type" "text", "action" "text", "label" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."handpick_log_description"("entity_type" "text", "action" "text", "label" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handpick_log_description"("entity_type" "text", "action" "text", "label" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handpick_log_snapshot"("record" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."handpick_log_snapshot"("record" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."handpick_log_snapshot"("record" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_permission"("permission_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("permission_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("permission_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."jsonb_diff"("old_row" "jsonb", "new_row" "jsonb", "exclude_keys" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."jsonb_diff"("old_row" "jsonb", "new_row" "jsonb", "exclude_keys" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jsonb_diff"("old_row" "jsonb", "new_row" "jsonb", "exclude_keys" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."leads_client_crm_sync"() TO "anon";
GRANT ALL ON FUNCTION "public"."leads_client_crm_sync"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."leads_client_crm_sync"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."livraison_boutique_coherence"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."livraison_boutique_coherence"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."livraison_boutique_notify"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."livraison_boutique_notify"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."livraison_modifiable"("p_livraison_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."livraison_modifiable"("p_livraison_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."livraison_modifiable"("p_livraison_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."livraison_refresh_commande"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."livraison_refresh_commande"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_arrivage_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_arrivage_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_arrivage_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_balle_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_balle_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_balle_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_balle_emplacement_handpick"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_balle_emplacement_handpick"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_balle_emplacement_handpick"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_carton_activity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_carton_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_category_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_category_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_category_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_client_crm_changes"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_client_crm_changes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_client_crm_changes"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_commande_boutique_activity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_commande_boutique_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_delivery_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_delivery_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_delivery_activity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_fiche_tri_delete"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_fiche_tri_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_fournisseur_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_fournisseur_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_fournisseur_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_handpick_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_handpick_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_handpick_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_handpick_fournisseur_category_activity"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_handpick_fournisseur_category_activity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_handpick_fournisseur_category_activity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_livraison_boutique_activity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_livraison_boutique_activity"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_trieur_activity"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_trieur_activity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."magasin_check_etage"() TO "anon";
GRANT ALL ON FUNCTION "public"."magasin_check_etage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."magasin_check_etage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."magasins_create_rdc"() TO "anon";
GRANT ALL ON FUNCTION "public"."magasins_create_rdc"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."magasins_create_rdc"() TO "service_role";



GRANT ALL ON FUNCTION "public"."move_client_column_on_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."move_client_column_on_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."move_client_column_on_event"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalize_packing_label"("p_label" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."normalize_packing_label"("p_label" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_packing_label"("p_label" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_arrivage_invoice_reminders"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_arrivage_invoice_reminders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_arrivage_invoice_reminders"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_commandes"("p_permission" "text", "p_title" "text", "p_url" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_commandes"("p_permission" "text", "p_title" "text", "p_url" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_crm_new_lead"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_crm_new_lead"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_crm_new_lead"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_crm_rdv_reminders"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_crm_rdv_reminders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_crm_rdv_reminders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_crm_task_assigned"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_crm_task_assigned"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_crm_task_assigned"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_crm_task_reminders"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_crm_task_reminders"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_crm_task_reminders"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_cryptedmessage"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_cryptedmessage"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_cryptedmessage"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_newsletter_api_error"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_newsletter_api_error"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_newsletter_api_error"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."notify_newsletter_webhook_silence"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."notify_newsletter_webhook_silence"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."packing_label_feedback_on_status"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."packing_label_feedback_on_status"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."packing_label_feedback_record"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."packing_label_feedback_record"() TO "service_role";



GRANT ALL ON FUNCTION "public"."packing_list_ligne_set_reviewer"() TO "anon";
GRANT ALL ON FUNCTION "public"."packing_list_ligne_set_reviewer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."packing_list_ligne_set_reviewer"() TO "service_role";



GRANT ALL ON FUNCTION "public"."palette_numerotation"() TO "anon";
GRANT ALL ON FUNCTION "public"."palette_numerotation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."palette_numerotation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."pg_net_health"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pg_net_health"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."pg_net_health"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."pg_net_watchdog"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pg_net_watchdog"() TO "service_role";



GRANT ALL ON FUNCTION "public"."plan_layout_handpick_stamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."plan_layout_handpick_stamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."plan_layout_handpick_stamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."post_rdv_mail"("p_event_id" "uuid", "p_motif" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."post_rdv_mail"("p_event_id" "uuid", "p_motif" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."post_rdv_mail"("p_event_id" "uuid", "p_motif" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."project_owner_service_slug"("team_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."project_owner_service_slug"("team_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."project_owner_service_slug"("team_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."purge_old_app_logs"("p_mode" "text", "p_months" integer, "p_tables" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."purge_old_app_logs"("p_mode" "text", "p_months" integer, "p_tables" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_old_app_logs"("p_mode" "text", "p_months" integer, "p_tables" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_rdv_reschedule_mail"() TO "anon";
GRANT ALL ON FUNCTION "public"."queue_rdv_reschedule_mail"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_rdv_reschedule_mail"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."receptionner_carton"("p_carton_id" "uuid", "p_poids_recu" numeric, "p_endommage" boolean, "p_mauvaise_categorie" boolean, "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."receptionner_carton"("p_carton_id" "uuid", "p_poids_recu" numeric, "p_endommage" boolean, "p_mauvaise_categorie" boolean, "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."receptionner_carton"("p_carton_id" "uuid", "p_poids_recu" numeric, "p_endommage" boolean, "p_mauvaise_categorie" boolean, "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."refresh_commande_statut"("p_commande_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refresh_commande_statut"("p_commande_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reopen_packing_list"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reopen_packing_list"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reopen_packing_list"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."role_slug"("role_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."role_slug"("role_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."role_slug"("role_name" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_fiche_tri"("p_fiche" "jsonb", "p_balles" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_fiche_tri"("p_fiche" "jsonb", "p_balles" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_fiche_tri"("p_fiche" "jsonb", "p_balles" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_push_subscription"("p_endpoint" "text", "p_subscription" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_push_subscription"("p_endpoint" "text", "p_subscription" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_push_subscription"("p_endpoint" "text", "p_subscription" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."service_slug"("service_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."service_slug"("service_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."service_slug"("service_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_client_setter_on_confirm"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_client_setter_on_confirm"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_client_setter_on_confirm"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_confirmation_amelia"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_confirmation_amelia"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_confirmation_amelia"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_event_customer_from_closer"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_event_customer_from_closer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_event_customer_from_closer"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."snapshot_fournisseur_on_eclatement_handpick"() TO "anon";
GRANT ALL ON FUNCTION "public"."snapshot_fournisseur_on_eclatement_handpick"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."snapshot_fournisseur_on_eclatement_handpick"() TO "service_role";



GRANT ALL ON FUNCTION "public"."snapshot_produit_recherche_monthly_stats"("p_month" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."snapshot_produit_recherche_monthly_stats"("p_month" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."snapshot_produit_recherche_monthly_stats"("p_month" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."snapshot_produit_recherche_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."snapshot_produit_recherche_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."snapshot_produit_recherche_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."stamp_event_confirmation"() TO "anon";
GRANT ALL ON FUNCTION "public"."stamp_event_confirmation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."stamp_event_confirmation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_customer_to_closer"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_customer_to_closer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_customer_to_closer"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_last_login"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_last_login"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_last_login"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_relance_tasks_on_rdv_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_relance_tasks_on_rdv_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_relance_tasks_on_rdv_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trigger_crm_stats_newsletter"("p_period" "text", "p_hour" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trigger_crm_stats_newsletter"("p_period" "text", "p_hour" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."uid"() TO "anon";
GRANT ALL ON FUNCTION "public"."uid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."uid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_cryptedmessage_groups_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_cryptedmessage_groups_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_cryptedmessage_groups_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_event_calendar_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_event_calendar_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_event_calendar_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_outlook_connection_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_outlook_connection_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_outlook_connection_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_project_status_as_admin"("p_team_id" "uuid", "p_status" "public"."project_team_status") TO "anon";
GRANT ALL ON FUNCTION "public"."update_project_status_as_admin"("p_team_id" "uuid", "p_status" "public"."project_team_status") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_project_status_as_admin"("p_team_id" "uuid", "p_status" "public"."project_team_status") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_access_project"("team_id" "uuid", "target_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_access_project"("team_id" "uuid", "target_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_access_project"("team_id" "uuid", "target_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_access_task"("target_task" "uuid", "member_only" boolean, "target_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_access_task"("target_task" "uuid", "member_only" boolean, "target_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_access_task"("target_task" "uuid", "member_only" boolean, "target_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_create_projects"("target_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_create_projects"("target_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_create_projects"("target_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_manage_projects"("target_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_manage_projects"("target_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_manage_projects"("target_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_view_projects"("target_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_view_projects"("target_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_view_projects"("target_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_permission"("p_uid" "uuid", "p_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_permission"("p_uid" "uuid", "p_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_permission"("p_uid" "uuid", "p_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_project_service"("target_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_project_service"("target_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_project_service"("target_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_global_admin"("target_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_global_admin"("target_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_global_admin"("target_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_project_team_member"("target_team" "uuid", "target_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_project_team_member"("target_team" "uuid", "target_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_project_team_member"("target_team" "uuid", "target_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_service_manager"("target_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_service_manager"("target_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_service_manager"("target_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_preferences_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."user_preferences_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_preferences_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_role_and_service"("target_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_role_and_service"("target_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_role_and_service"("target_user" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_service_slug"("target_user" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_service_slug"("target_user" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_service_slug"("target_user" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."users_with_permission"("p_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."users_with_permission"("p_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_packing_list"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."validate_packing_list"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_packing_list"("p_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."watch_config_visible_to_service"("p_config_id" integer, "p_service_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."watch_config_visible_to_service"("p_config_id" integer, "p_service_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."watch_config_visible_to_service"("p_config_id" integer, "p_service_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."wiki_articles_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."wiki_articles_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."wiki_articles_set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."wiki_reorder_categories"("p_updates" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wiki_reorder_categories"("p_updates" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."wiki_reorder_categories"("p_updates" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."wiki_reorder_categories"("p_updates" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."wiki_stats_cold_articles"("p_from" timestamp with time zone, "p_to" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wiki_stats_cold_articles"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."wiki_stats_cold_articles"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."wiki_stats_cold_articles"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."wiki_stats_guard"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wiki_stats_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."wiki_stats_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."wiki_stats_guard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."wiki_stats_overview"("p_from" timestamp with time zone, "p_to" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wiki_stats_overview"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."wiki_stats_overview"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."wiki_stats_overview"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."wiki_stats_readers"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wiki_stats_readers"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."wiki_stats_readers"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."wiki_stats_readers"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."wiki_stats_retention"("p_from" timestamp with time zone, "p_to" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wiki_stats_retention"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."wiki_stats_retention"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."wiki_stats_retention"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."wiki_stats_timeseries"("p_from" timestamp with time zone, "p_to" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wiki_stats_timeseries"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."wiki_stats_timeseries"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."wiki_stats_timeseries"("p_from" timestamp with time zone, "p_to" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."wiki_stats_top_articles"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."wiki_stats_top_articles"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."wiki_stats_top_articles"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."wiki_stats_top_articles"("p_from" timestamp with time zone, "p_to" timestamp with time zone, "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."zones_handpick_check_hierarchy"() TO "anon";
GRANT ALL ON FUNCTION "public"."zones_handpick_check_hierarchy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."zones_handpick_check_hierarchy"() TO "service_role";



GRANT ALL ON FUNCTION "public"."zones_magasin_check_hierarchy"() TO "anon";
GRANT ALL ON FUNCTION "public"."zones_magasin_check_hierarchy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."zones_magasin_check_hierarchy"() TO "service_role";



GRANT ALL ON TABLE "public"."Changelog" TO "anon";
GRANT ALL ON TABLE "public"."Changelog" TO "authenticated";
GRANT ALL ON TABLE "public"."Changelog" TO "service_role";



GRANT ALL ON TABLE "public"."Client_activite" TO "anon";
GRANT ALL ON TABLE "public"."Client_activite" TO "authenticated";
GRANT ALL ON TABLE "public"."Client_activite" TO "service_role";



GRANT ALL ON TABLE "public"."Devis" TO "anon";
GRANT ALL ON TABLE "public"."Devis" TO "authenticated";
GRANT ALL ON TABLE "public"."Devis" TO "service_role";



GRANT ALL ON TABLE "public"."Event_calendar_Comm" TO "anon";
GRANT ALL ON TABLE "public"."Event_calendar_Comm" TO "authenticated";
GRANT ALL ON TABLE "public"."Event_calendar_Comm" TO "service_role";



GRANT ALL ON TABLE "public"."Fournisseur_crm" TO "anon";
GRANT ALL ON TABLE "public"."Fournisseur_crm" TO "authenticated";
GRANT ALL ON TABLE "public"."Fournisseur_crm" TO "service_role";



GRANT ALL ON TABLE "public"."Kanban_comm" TO "anon";
GRANT ALL ON TABLE "public"."Kanban_comm" TO "authenticated";
GRANT ALL ON TABLE "public"."Kanban_comm" TO "service_role";



GRANT ALL ON SEQUENCE "public"."Kanban_comm_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."Kanban_comm_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."Kanban_comm_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."Maintenance" TO "anon";
GRANT ALL ON TABLE "public"."Maintenance" TO "authenticated";
GRANT ALL ON TABLE "public"."Maintenance" TO "service_role";



GRANT ALL ON TABLE "public"."News" TO "anon";
GRANT ALL ON TABLE "public"."News" TO "authenticated";
GRANT ALL ON TABLE "public"."News" TO "service_role";



GRANT ALL ON TABLE "public"."Tache_crm" TO "anon";
GRANT ALL ON TABLE "public"."Tache_crm" TO "authenticated";
GRANT ALL ON TABLE "public"."Tache_crm" TO "service_role";



GRANT ALL ON TABLE "public"."Type_product_CRM" TO "anon";
GRANT ALL ON TABLE "public"."Type_product_CRM" TO "authenticated";
GRANT ALL ON TABLE "public"."Type_product_CRM" TO "service_role";



GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."activity_log_handpick" TO "anon";
GRANT ALL ON TABLE "public"."activity_log_handpick" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log_handpick" TO "service_role";



GRANT ALL ON TABLE "public"."ai_watch_reports" TO "anon";
GRANT ALL ON TABLE "public"."ai_watch_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_watch_reports" TO "service_role";



GRANT ALL ON TABLE "public"."amelia_availability_closures" TO "anon";
GRANT ALL ON TABLE "public"."amelia_availability_closures" TO "authenticated";
GRANT ALL ON TABLE "public"."amelia_availability_closures" TO "service_role";



GRANT ALL ON TABLE "public"."amelia_availability_days_off" TO "anon";
GRANT ALL ON TABLE "public"."amelia_availability_days_off" TO "authenticated";
GRANT ALL ON TABLE "public"."amelia_availability_days_off" TO "service_role";



GRANT ALL ON TABLE "public"."amelia_availability_special" TO "anon";
GRANT ALL ON TABLE "public"."amelia_availability_special" TO "authenticated";
GRANT ALL ON TABLE "public"."amelia_availability_special" TO "service_role";



GRANT ALL ON TABLE "public"."amelia_availability_weekly" TO "anon";
GRANT ALL ON TABLE "public"."amelia_availability_weekly" TO "authenticated";
GRANT ALL ON TABLE "public"."amelia_availability_weekly" TO "service_role";



GRANT ALL ON TABLE "public"."amelia_company_closures" TO "anon";
GRANT ALL ON TABLE "public"."amelia_company_closures" TO "authenticated";
GRANT ALL ON TABLE "public"."amelia_company_closures" TO "service_role";



GRANT ALL ON TABLE "public"."amelia_company_days_off" TO "anon";
GRANT ALL ON TABLE "public"."amelia_company_days_off" TO "authenticated";
GRANT ALL ON TABLE "public"."amelia_company_days_off" TO "service_role";



GRANT ALL ON TABLE "public"."amelia_company_special" TO "anon";
GRANT ALL ON TABLE "public"."amelia_company_special" TO "authenticated";
GRANT ALL ON TABLE "public"."amelia_company_special" TO "service_role";



GRANT ALL ON TABLE "public"."amelia_company_weekly" TO "anon";
GRANT ALL ON TABLE "public"."amelia_company_weekly" TO "authenticated";
GRANT ALL ON TABLE "public"."amelia_company_weekly" TO "service_role";



GRANT ALL ON TABLE "public"."amelia_provider_mapping" TO "anon";
GRANT ALL ON TABLE "public"."amelia_provider_mapping" TO "authenticated";
GRANT ALL ON TABLE "public"."amelia_provider_mapping" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_export_collaborators" TO "anon";
GRANT ALL ON TABLE "public"."analytics_export_collaborators" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_export_collaborators" TO "service_role";



GRANT ALL ON TABLE "public"."analyze_content_generation" TO "anon";
GRANT ALL ON TABLE "public"."analyze_content_generation" TO "authenticated";
GRANT ALL ON TABLE "public"."analyze_content_generation" TO "service_role";



GRANT ALL ON TABLE "public"."annonce" TO "anon";
GRANT ALL ON TABLE "public"."annonce" TO "authenticated";
GRANT ALL ON TABLE "public"."annonce" TO "service_role";



GRANT ALL ON TABLE "public"."app_logs" TO "anon";
GRANT ALL ON TABLE "public"."app_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."app_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."app_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."app_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."app_logs_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."app_logs_retention_audit_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."app_logs_retention_audit_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."app_logs_retention_audit_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."app_logs_retention_config" TO "anon";
GRANT ALL ON TABLE "public"."app_logs_retention_config" TO "authenticated";
GRANT ALL ON TABLE "public"."app_logs_retention_config" TO "service_role";



GRANT ALL ON TABLE "public"."app_maintenance" TO "anon";
GRANT ALL ON TABLE "public"."app_maintenance" TO "authenticated";
GRANT ALL ON TABLE "public"."app_maintenance" TO "service_role";



GRANT ALL ON TABLE "public"."apple_calendar_connections" TO "anon";
GRANT ALL ON TABLE "public"."apple_calendar_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."apple_calendar_connections" TO "service_role";



GRANT ALL ON TABLE "public"."arrivage_manuel" TO "anon";
GRANT ALL ON TABLE "public"."arrivage_manuel" TO "authenticated";
GRANT ALL ON TABLE "public"."arrivage_manuel" TO "service_role";



GRANT ALL ON TABLE "public"."arrivage_state" TO "anon";
GRANT ALL ON TABLE "public"."arrivage_state" TO "authenticated";
GRANT ALL ON TABLE "public"."arrivage_state" TO "service_role";



GRANT ALL ON TABLE "public"."arrivage_subscribers" TO "anon";
GRANT ALL ON TABLE "public"."arrivage_subscribers" TO "authenticated";
GRANT ALL ON TABLE "public"."arrivage_subscribers" TO "service_role";



GRANT ALL ON TABLE "public"."arrivees_departs" TO "anon";
GRANT ALL ON TABLE "public"."arrivees_departs" TO "authenticated";
GRANT ALL ON TABLE "public"."arrivees_departs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."arrivees_departs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."arrivees_departs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."arrivees_departs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."balles" TO "anon";
GRANT ALL ON TABLE "public"."balles" TO "authenticated";
GRANT ALL ON TABLE "public"."balles" TO "service_role";



GRANT ALL ON TABLE "public"."balles_emplacements_handpick" TO "anon";
GRANT ALL ON TABLE "public"."balles_emplacements_handpick" TO "authenticated";
GRANT ALL ON TABLE "public"."balles_emplacements_handpick" TO "service_role";



GRANT ALL ON TABLE "public"."balles_gestion" TO "anon";
GRANT ALL ON TABLE "public"."balles_gestion" TO "authenticated";
GRANT ALL ON TABLE "public"."balles_gestion" TO "service_role";



GRANT ALL ON TABLE "public"."balles_handpick" TO "anon";
GRANT ALL ON TABLE "public"."balles_handpick" TO "authenticated";
GRANT ALL ON TABLE "public"."balles_handpick" TO "service_role";



GRANT ALL ON TABLE "public"."bibliotheque_brief" TO "anon";
GRANT ALL ON TABLE "public"."bibliotheque_brief" TO "authenticated";
GRANT ALL ON TABLE "public"."bibliotheque_brief" TO "service_role";



GRANT ALL ON TABLE "public"."bibliotheque_format_reponses" TO "anon";
GRANT ALL ON TABLE "public"."bibliotheque_format_reponses" TO "authenticated";
GRANT ALL ON TABLE "public"."bibliotheque_format_reponses" TO "service_role";



GRANT ALL ON TABLE "public"."bibliotheque_questions_reponses" TO "anon";
GRANT ALL ON TABLE "public"."bibliotheque_questions_reponses" TO "authenticated";
GRANT ALL ON TABLE "public"."bibliotheque_questions_reponses" TO "service_role";



GRANT ALL ON TABLE "public"."bibliotheque_thematiques" TO "anon";
GRANT ALL ON TABLE "public"."bibliotheque_thematiques" TO "authenticated";
GRANT ALL ON TABLE "public"."bibliotheque_thematiques" TO "service_role";



GRANT ALL ON TABLE "public"."boutiques" TO "anon";
GRANT ALL ON TABLE "public"."boutiques" TO "authenticated";
GRANT ALL ON TABLE "public"."boutiques" TO "service_role";



GRANT ALL ON TABLE "public"."brief.crm" TO "anon";
GRANT ALL ON TABLE "public"."brief.crm" TO "authenticated";
GRANT ALL ON TABLE "public"."brief.crm" TO "service_role";



GRANT ALL ON SEQUENCE "public"."brief.crm_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."brief.crm_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."brief.crm_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."brief_cat" TO "anon";
GRANT ALL ON TABLE "public"."brief_cat" TO "authenticated";
GRANT ALL ON TABLE "public"."brief_cat" TO "service_role";



GRANT ALL ON SEQUENCE "public"."brief_cat_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."brief_cat_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."brief_cat_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_sync_logs" TO "anon";
GRANT ALL ON TABLE "public"."calendar_sync_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_sync_logs" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_sync_mappings" TO "anon";
GRANT ALL ON TABLE "public"."calendar_sync_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_sync_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."cartons" TO "anon";
GRANT ALL ON TABLE "public"."cartons" TO "authenticated";
GRANT ALL ON TABLE "public"."cartons" TO "service_role";



GRANT ALL ON TABLE "public"."categories_gestion" TO "anon";
GRANT ALL ON TABLE "public"."categories_gestion" TO "authenticated";
GRANT ALL ON TABLE "public"."categories_gestion" TO "service_role";



GRANT ALL ON TABLE "public"."categories_handpick" TO "anon";
GRANT ALL ON TABLE "public"."categories_handpick" TO "authenticated";
GRANT ALL ON TABLE "public"."categories_handpick" TO "service_role";



GRANT ALL ON TABLE "public"."category_price_history" TO "anon";
GRANT ALL ON TABLE "public"."category_price_history" TO "authenticated";
GRANT ALL ON TABLE "public"."category_price_history" TO "service_role";



GRANT ALL ON TABLE "public"."changelog_categories" TO "anon";
GRANT ALL ON TABLE "public"."changelog_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."changelog_categories" TO "service_role";



GRANT ALL ON TABLE "public"."changelog_items" TO "anon";
GRANT ALL ON TABLE "public"."changelog_items" TO "authenticated";
GRANT ALL ON TABLE "public"."changelog_items" TO "service_role";



GRANT ALL ON TABLE "public"."changelog_versions" TO "anon";
GRANT ALL ON TABLE "public"."changelog_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."changelog_versions" TO "service_role";



GRANT ALL ON TABLE "public"."client_amelia_submissions" TO "anon";
GRANT ALL ON TABLE "public"."client_amelia_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."client_amelia_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."client_crm" TO "anon";
GRANT ALL ON TABLE "public"."client_crm" TO "authenticated";
GRANT ALL ON TABLE "public"."client_crm" TO "service_role";



GRANT ALL ON TABLE "public"."client_newsletter_sends" TO "anon";
GRANT ALL ON TABLE "public"."client_newsletter_sends" TO "authenticated";
GRANT ALL ON TABLE "public"."client_newsletter_sends" TO "service_role";



GRANT ALL ON TABLE "public"."commande_lignes" TO "anon";
GRANT ALL ON TABLE "public"."commande_lignes" TO "authenticated";
GRANT ALL ON TABLE "public"."commande_lignes" TO "service_role";



GRANT ALL ON TABLE "public"."commandes_boutique" TO "anon";
GRANT ALL ON TABLE "public"."commandes_boutique" TO "authenticated";
GRANT ALL ON TABLE "public"."commandes_boutique" TO "service_role";



GRANT ALL ON SEQUENCE "public"."commandes_boutique_numero_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."commandes_boutique_numero_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."commandes_boutique_numero_seq" TO "service_role";



GRANT ALL ON TABLE "public"."content_generation" TO "anon";
GRANT ALL ON TABLE "public"."content_generation" TO "authenticated";
GRANT ALL ON TABLE "public"."content_generation" TO "service_role";



GRANT ALL ON TABLE "public"."created_chat" TO "anon";
GRANT ALL ON TABLE "public"."created_chat" TO "authenticated";
GRANT ALL ON TABLE "public"."created_chat" TO "service_role";



GRANT ALL ON TABLE "public"."crm_produit_recherche_monthly_stats" TO "anon";
GRANT ALL ON TABLE "public"."crm_produit_recherche_monthly_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_produit_recherche_monthly_stats" TO "service_role";



GRANT ALL ON SEQUENCE "public"."crm_produit_recherche_monthly_stats_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."crm_produit_recherche_monthly_stats_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."crm_produit_recherche_monthly_stats_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."crm_produit_recherche_stats" TO "anon";
GRANT ALL ON TABLE "public"."crm_produit_recherche_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_produit_recherche_stats" TO "service_role";



GRANT ALL ON SEQUENCE "public"."crm_produit_recherche_stats_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."crm_produit_recherche_stats_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."crm_produit_recherche_stats_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cryptedmessage" TO "anon";
GRANT ALL ON TABLE "public"."cryptedmessage" TO "authenticated";
GRANT ALL ON TABLE "public"."cryptedmessage" TO "service_role";



GRANT ALL ON TABLE "public"."cryptedmessage_autopassphrase" TO "anon";
GRANT ALL ON TABLE "public"."cryptedmessage_autopassphrase" TO "authenticated";
GRANT ALL ON TABLE "public"."cryptedmessage_autopassphrase" TO "service_role";



GRANT ALL ON TABLE "public"."cryptedmessage_group_members" TO "anon";
GRANT ALL ON TABLE "public"."cryptedmessage_group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."cryptedmessage_group_members" TO "service_role";



GRANT ALL ON TABLE "public"."cryptedmessage_groups" TO "anon";
GRANT ALL ON TABLE "public"."cryptedmessage_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."cryptedmessage_groups" TO "service_role";



GRANT ALL ON SEQUENCE "public"."cryptedmessage_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."cryptedmessage_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."cryptedmessage_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cryptedmessage_keybundles" TO "anon";
GRANT ALL ON TABLE "public"."cryptedmessage_keybundles" TO "authenticated";
GRANT ALL ON TABLE "public"."cryptedmessage_keybundles" TO "service_role";



GRANT ALL ON TABLE "public"."cryptedmessage_shared_exportkeys" TO "anon";
GRANT ALL ON TABLE "public"."cryptedmessage_shared_exportkeys" TO "authenticated";
GRANT ALL ON TABLE "public"."cryptedmessage_shared_exportkeys" TO "service_role";



GRANT ALL ON TABLE "public"."cryptedmessage_userkeys" TO "anon";
GRANT ALL ON TABLE "public"."cryptedmessage_userkeys" TO "authenticated";
GRANT ALL ON TABLE "public"."cryptedmessage_userkeys" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_layout_templates" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_layout_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_layout_templates" TO "service_role";



GRANT ALL ON TABLE "public"."deliveries_gestion" TO "anon";
GRANT ALL ON TABLE "public"."deliveries_gestion" TO "authenticated";
GRANT ALL ON TABLE "public"."deliveries_gestion" TO "service_role";



GRANT ALL ON TABLE "public"."description_corrections" TO "anon";
GRANT ALL ON TABLE "public"."description_corrections" TO "authenticated";
GRANT ALL ON TABLE "public"."description_corrections" TO "service_role";



GRANT ALL ON SEQUENCE "public"."description_corrections_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."description_corrections_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."description_corrections_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."direct_conversations" TO "anon";
GRANT ALL ON TABLE "public"."direct_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."direct_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."emplacements_handpick" TO "anon";
GRANT ALL ON TABLE "public"."emplacements_handpick" TO "authenticated";
GRANT ALL ON TABLE "public"."emplacements_handpick" TO "service_role";



GRANT ALL ON TABLE "public"."emplacements_magasin" TO "anon";
GRANT ALL ON TABLE "public"."emplacements_magasin" TO "authenticated";
GRANT ALL ON TABLE "public"."emplacements_magasin" TO "service_role";



GRANT ALL ON TABLE "public"."equipements_magasin" TO "anon";
GRANT ALL ON TABLE "public"."equipements_magasin" TO "authenticated";
GRANT ALL ON TABLE "public"."equipements_magasin" TO "service_role";



GRANT ALL ON TABLE "public"."etages_magasin" TO "anon";
GRANT ALL ON TABLE "public"."etages_magasin" TO "authenticated";
GRANT ALL ON TABLE "public"."etages_magasin" TO "service_role";



GRANT ALL ON TABLE "public"."factures" TO "anon";
GRANT ALL ON TABLE "public"."factures" TO "authenticated";
GRANT ALL ON TABLE "public"."factures" TO "service_role";



GRANT ALL ON SEQUENCE "public"."factures_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."factures_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."factures_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."fiches_tri" TO "anon";
GRANT ALL ON TABLE "public"."fiches_tri" TO "authenticated";
GRANT ALL ON TABLE "public"."fiches_tri" TO "service_role";



GRANT ALL ON TABLE "public"."fiches_tri_balles" TO "anon";
GRANT ALL ON TABLE "public"."fiches_tri_balles" TO "authenticated";
GRANT ALL ON TABLE "public"."fiches_tri_balles" TO "service_role";



GRANT ALL ON SEQUENCE "public"."fiches_tri_numero_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."fiches_tri_numero_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."fiches_tri_numero_seq" TO "service_role";



GRANT ALL ON TABLE "public"."fiches_tri_repartition" TO "anon";
GRANT ALL ON TABLE "public"."fiches_tri_repartition" TO "authenticated";
GRANT ALL ON TABLE "public"."fiches_tri_repartition" TO "service_role";



GRANT ALL ON TABLE "public"."flux_handpick" TO "anon";
GRANT ALL ON TABLE "public"."flux_handpick" TO "authenticated";
GRANT ALL ON TABLE "public"."flux_handpick" TO "service_role";



GRANT ALL ON TABLE "public"."fournisseur" TO "anon";
GRANT ALL ON TABLE "public"."fournisseur" TO "authenticated";
GRANT ALL ON TABLE "public"."fournisseur" TO "service_role";



GRANT ALL ON TABLE "public"."fournisseur_gestion" TO "anon";
GRANT ALL ON TABLE "public"."fournisseur_gestion" TO "authenticated";
GRANT ALL ON TABLE "public"."fournisseur_gestion" TO "service_role";



GRANT ALL ON TABLE "public"."fournisseurs_categories_handpick" TO "anon";
GRANT ALL ON TABLE "public"."fournisseurs_categories_handpick" TO "authenticated";
GRANT ALL ON TABLE "public"."fournisseurs_categories_handpick" TO "service_role";



GRANT ALL ON TABLE "public"."fournisseurs_handpick" TO "anon";
GRANT ALL ON TABLE "public"."fournisseurs_handpick" TO "authenticated";
GRANT ALL ON TABLE "public"."fournisseurs_handpick" TO "service_role";



GRANT ALL ON TABLE "public"."gallery_permissions" TO "anon";
GRANT ALL ON TABLE "public"."gallery_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."gallery_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."gallery_pictures" TO "anon";
GRANT ALL ON TABLE "public"."gallery_pictures" TO "authenticated";
GRANT ALL ON TABLE "public"."gallery_pictures" TO "service_role";



GRANT ALL ON TABLE "public"."gestion_arrivage_packing" TO "anon";
GRANT ALL ON TABLE "public"."gestion_arrivage_packing" TO "authenticated";
GRANT ALL ON TABLE "public"."gestion_arrivage_packing" TO "service_role";



GRANT ALL ON TABLE "public"."gestion_arrivage_row" TO "anon";
GRANT ALL ON TABLE "public"."gestion_arrivage_row" TO "authenticated";
GRANT ALL ON TABLE "public"."gestion_arrivage_row" TO "service_role";



GRANT ALL ON TABLE "public"."group_read_receipts" TO "anon";
GRANT ALL ON TABLE "public"."group_read_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."group_read_receipts" TO "service_role";



GRANT ALL ON TABLE "public"."groupe_participant" TO "anon";
GRANT ALL ON TABLE "public"."groupe_participant" TO "authenticated";
GRANT ALL ON TABLE "public"."groupe_participant" TO "service_role";



GRANT ALL ON SEQUENCE "public"."groupe_participant_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."groupe_participant_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."groupe_participant_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."groups" TO "anon";
GRANT ALL ON TABLE "public"."groups" TO "authenticated";
GRANT ALL ON TABLE "public"."groups" TO "service_role";



GRANT ALL ON TABLE "public"."items" TO "anon";
GRANT ALL ON TABLE "public"."items" TO "authenticated";
GRANT ALL ON TABLE "public"."items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."journal_entry" TO "anon";
GRANT ALL ON TABLE "public"."journal_entry" TO "authenticated";
GRANT ALL ON TABLE "public"."journal_entry" TO "service_role";



GRANT ALL ON TABLE "public"."kpis" TO "anon";
GRANT ALL ON TABLE "public"."kpis" TO "authenticated";
GRANT ALL ON TABLE "public"."kpis" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON SEQUENCE "public"."leads_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."leads_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."leads_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."livraisons_boutique" TO "anon";
GRANT ALL ON TABLE "public"."livraisons_boutique" TO "authenticated";
GRANT ALL ON TABLE "public"."livraisons_boutique" TO "service_role";



GRANT ALL ON SEQUENCE "public"."livraisons_boutique_numero_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."livraisons_boutique_numero_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."livraisons_boutique_numero_seq" TO "service_role";



GRANT ALL ON TABLE "public"."logs_crm" TO "anon";
GRANT ALL ON TABLE "public"."logs_crm" TO "authenticated";
GRANT ALL ON TABLE "public"."logs_crm" TO "service_role";



GRANT ALL ON SEQUENCE "public"."logs_crm_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."logs_crm_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."logs_crm_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."magasins" TO "anon";
GRANT ALL ON TABLE "public"."magasins" TO "authenticated";
GRANT ALL ON TABLE "public"."magasins" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."messaging_favorites" TO "anon";
GRANT ALL ON TABLE "public"."messaging_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."messaging_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."mouvements_handpick" TO "anon";
GRANT ALL ON TABLE "public"."mouvements_handpick" TO "authenticated";
GRANT ALL ON TABLE "public"."mouvements_handpick" TO "service_role";



GRANT ALL ON TABLE "public"."murs_magasin" TO "anon";
GRANT ALL ON TABLE "public"."murs_magasin" TO "authenticated";
GRANT ALL ON TABLE "public"."murs_magasin" TO "service_role";



GRANT ALL ON TABLE "public"."new_ticket" TO "anon";
GRANT ALL ON TABLE "public"."new_ticket" TO "authenticated";
GRANT ALL ON TABLE "public"."new_ticket" TO "service_role";



GRANT ALL ON SEQUENCE "public"."new_ticket_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."new_ticket_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."new_ticket_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_api_logs" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_api_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_api_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."newsletter_api_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."newsletter_api_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."newsletter_api_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_invitation_codes" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_invitation_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_invitation_codes" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_send_events" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_send_events" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_send_events" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_send_runs" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_send_runs" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_send_runs" TO "service_role";



GRANT ALL ON TABLE "public"."newsletter_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."newsletter_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."newsletter_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."notification" TO "anon";
GRANT ALL ON TABLE "public"."notification" TO "authenticated";
GRANT ALL ON TABLE "public"."notification" TO "service_role";



GRANT ALL ON TABLE "public"."outlook_connections" TO "anon";
GRANT ALL ON TABLE "public"."outlook_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."outlook_connections" TO "service_role";



GRANT ALL ON TABLE "public"."outlook_webhook_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."outlook_webhook_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."outlook_webhook_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."packages" TO "anon";
GRANT ALL ON TABLE "public"."packages" TO "authenticated";
GRANT ALL ON TABLE "public"."packages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."packages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."packages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."packages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."packing_label_category" TO "anon";
GRANT ALL ON TABLE "public"."packing_label_category" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_label_category" TO "service_role";



GRANT ALL ON TABLE "public"."packing_label_feedback" TO "anon";
GRANT ALL ON TABLE "public"."packing_label_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_label_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."packing_list" TO "anon";
GRANT ALL ON TABLE "public"."packing_list" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_list" TO "service_role";



GRANT ALL ON TABLE "public"."packing_list_ligne" TO "anon";
GRANT ALL ON TABLE "public"."packing_list_ligne" TO "authenticated";
GRANT ALL ON TABLE "public"."packing_list_ligne" TO "service_role";



GRANT ALL ON TABLE "public"."pake_credentials" TO "anon";
GRANT ALL ON TABLE "public"."pake_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."pake_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."pake_server_params" TO "anon";
GRANT ALL ON TABLE "public"."pake_server_params" TO "authenticated";
GRANT ALL ON TABLE "public"."pake_server_params" TO "service_role";



GRANT ALL ON SEQUENCE "public"."pake_server_params_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."pake_server_params_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."pake_server_params_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."palettes" TO "anon";
GRANT ALL ON TABLE "public"."palettes" TO "authenticated";
GRANT ALL ON TABLE "public"."palettes" TO "service_role";



GRANT ALL ON TABLE "public"."permissions" TO "anon";
GRANT ALL ON TABLE "public"."permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."permissions" TO "service_role";



GRANT ALL ON TABLE "public"."pg_net_watchdog_state" TO "anon";
GRANT ALL ON TABLE "public"."pg_net_watchdog_state" TO "authenticated";
GRANT ALL ON TABLE "public"."pg_net_watchdog_state" TO "service_role";



GRANT ALL ON TABLE "public"."ping_pong_players" TO "anon";
GRANT ALL ON TABLE "public"."ping_pong_players" TO "authenticated";
GRANT ALL ON TABLE "public"."ping_pong_players" TO "service_role";



GRANT ALL ON TABLE "public"."plan_layout_handpick" TO "anon";
GRANT ALL ON TABLE "public"."plan_layout_handpick" TO "authenticated";
GRANT ALL ON TABLE "public"."plan_layout_handpick" TO "service_role";



GRANT ALL ON TABLE "public"."product" TO "anon";
GRANT ALL ON TABLE "public"."product" TO "authenticated";
GRANT ALL ON TABLE "public"."product" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."product_image" TO "anon";
GRANT ALL ON TABLE "public"."product_image" TO "authenticated";
GRANT ALL ON TABLE "public"."product_image" TO "service_role";



GRANT ALL ON SEQUENCE "public"."product_image_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."product_image_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."product_image_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."project_sprints" TO "anon";
GRANT ALL ON TABLE "public"."project_sprints" TO "authenticated";
GRANT ALL ON TABLE "public"."project_sprints" TO "service_role";



GRANT ALL ON TABLE "public"."project_task_attachments" TO "anon";
GRANT ALL ON TABLE "public"."project_task_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."project_task_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."project_tasks" TO "anon";
GRANT ALL ON TABLE "public"."project_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."project_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."project_team_members" TO "anon";
GRANT ALL ON TABLE "public"."project_team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."project_team_members" TO "service_role";



GRANT ALL ON TABLE "public"."project_teams" TO "anon";
GRANT ALL ON TABLE "public"."project_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."project_teams" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."rdv_reschedule_mail_queue" TO "service_role";



GRANT ALL ON TABLE "public"."results" TO "anon";
GRANT ALL ON TABLE "public"."results" TO "authenticated";
GRANT ALL ON TABLE "public"."results" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."roles_permissions" TO "anon";
GRANT ALL ON TABLE "public"."roles_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."roles_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."services_permissions" TO "anon";
GRANT ALL ON TABLE "public"."services_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."services_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."sorting_reports" TO "anon";
GRANT ALL ON TABLE "public"."sorting_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."sorting_reports" TO "service_role";



GRANT ALL ON TABLE "public"."sync_history" TO "anon";
GRANT ALL ON TABLE "public"."sync_history" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_history" TO "service_role";



GRANT ALL ON TABLE "public"."tableau_devis" TO "anon";
GRANT ALL ON TABLE "public"."tableau_devis" TO "authenticated";
GRANT ALL ON TABLE "public"."tableau_devis" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_chat_table" TO "anon";
GRANT ALL ON TABLE "public"."ticket_chat_table" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_chat_table" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_message" TO "anon";
GRANT ALL ON TABLE "public"."ticket_message" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_message" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_table" TO "anon";
GRANT ALL ON TABLE "public"."ticket_table" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_table" TO "service_role";



GRANT ALL ON TABLE "public"."tickets" TO "anon";
GRANT ALL ON TABLE "public"."tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets" TO "service_role";



GRANT ALL ON TABLE "public"."tournament_participants" TO "anon";
GRANT ALL ON TABLE "public"."tournament_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."tournament_participants" TO "service_role";



GRANT ALL ON TABLE "public"."tournaments" TO "anon";
GRANT ALL ON TABLE "public"."tournaments" TO "authenticated";
GRANT ALL ON TABLE "public"."tournaments" TO "service_role";



GRANT ALL ON TABLE "public"."tri_sorties" TO "anon";
GRANT ALL ON TABLE "public"."tri_sorties" TO "authenticated";
GRANT ALL ON TABLE "public"."tri_sorties" TO "service_role";



GRANT ALL ON TABLE "public"."trieurs" TO "anon";
GRANT ALL ON TABLE "public"."trieurs" TO "authenticated";
GRANT ALL ON TABLE "public"."trieurs" TO "service_role";



GRANT ALL ON TABLE "public"."user_calendar_connections" TO "anon";
GRANT ALL ON TABLE "public"."user_calendar_connections" TO "authenticated";
GRANT ALL ON TABLE "public"."user_calendar_connections" TO "service_role";



GRANT ALL ON TABLE "public"."user_crm_analytics_layout" TO "anon";
GRANT ALL ON TABLE "public"."user_crm_analytics_layout" TO "authenticated";
GRANT ALL ON TABLE "public"."user_crm_analytics_layout" TO "service_role";



GRANT ALL ON TABLE "public"."user_dashboard_layout" TO "anon";
GRANT ALL ON TABLE "public"."user_dashboard_layout" TO "authenticated";
GRANT ALL ON TABLE "public"."user_dashboard_layout" TO "service_role";



GRANT ALL ON TABLE "public"."user_keys" TO "anon";
GRANT ALL ON TABLE "public"."user_keys" TO "authenticated";
GRANT ALL ON TABLE "public"."user_keys" TO "service_role";



GRANT ALL ON TABLE "public"."user_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."users_permissions" TO "anon";
GRANT ALL ON TABLE "public"."users_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."users_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."v_arrivages" TO "anon";
GRANT ALL ON TABLE "public"."v_arrivages" TO "authenticated";
GRANT ALL ON TABLE "public"."v_arrivages" TO "service_role";



GRANT ALL ON TABLE "public"."v_cartons" TO "anon";
GRANT ALL ON TABLE "public"."v_cartons" TO "authenticated";
GRANT ALL ON TABLE "public"."v_cartons" TO "service_role";



GRANT ALL ON TABLE "public"."v_commande_avancement" TO "anon";
GRANT ALL ON TABLE "public"."v_commande_avancement" TO "authenticated";
GRANT ALL ON TABLE "public"."v_commande_avancement" TO "service_role";



GRANT ALL ON TABLE "public"."v_commandes_boutique" TO "anon";
GRANT ALL ON TABLE "public"."v_commandes_boutique" TO "authenticated";
GRANT ALL ON TABLE "public"."v_commandes_boutique" TO "service_role";



GRANT ALL ON TABLE "public"."v_fiches_tri_balles" TO "anon";
GRANT ALL ON TABLE "public"."v_fiches_tri_balles" TO "authenticated";
GRANT ALL ON TABLE "public"."v_fiches_tri_balles" TO "service_role";



GRANT ALL ON TABLE "public"."v_fiches_tri" TO "anon";
GRANT ALL ON TABLE "public"."v_fiches_tri" TO "authenticated";
GRANT ALL ON TABLE "public"."v_fiches_tri" TO "service_role";



GRANT ALL ON TABLE "public"."v_livraisons_boutique" TO "anon";
GRANT ALL ON TABLE "public"."v_livraisons_boutique" TO "authenticated";
GRANT ALL ON TABLE "public"."v_livraisons_boutique" TO "service_role";



GRANT ALL ON TABLE "public"."v_packing_list_summary" TO "anon";
GRANT ALL ON TABLE "public"."v_packing_list_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."v_packing_list_summary" TO "service_role";



GRANT ALL ON TABLE "public"."v_users_mfa_status" TO "anon";
GRANT ALL ON TABLE "public"."v_users_mfa_status" TO "authenticated";
GRANT ALL ON TABLE "public"."v_users_mfa_status" TO "service_role";



GRANT ALL ON TABLE "public"."watch_config" TO "anon";
GRANT ALL ON TABLE "public"."watch_config" TO "authenticated";
GRANT ALL ON TABLE "public"."watch_config" TO "service_role";



GRANT ALL ON SEQUENCE "public"."watch_config_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."watch_config_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."watch_config_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."wiki_article_views" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."wiki_article_views" TO "authenticated";
GRANT ALL ON TABLE "public"."wiki_article_views" TO "service_role";



GRANT UPDATE("dwell_ms") ON TABLE "public"."wiki_article_views" TO "authenticated";



GRANT UPDATE("completed") ON TABLE "public"."wiki_article_views" TO "authenticated";



GRANT ALL ON TABLE "public"."wiki_articles" TO "anon";
GRANT ALL ON TABLE "public"."wiki_articles" TO "authenticated";
GRANT ALL ON TABLE "public"."wiki_articles" TO "service_role";



GRANT ALL ON TABLE "public"."wiki_article_views_measured" TO "service_role";



GRANT ALL ON TABLE "public"."wiki_categories" TO "anon";
GRANT ALL ON TABLE "public"."wiki_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."wiki_categories" TO "service_role";



GRANT ALL ON TABLE "public"."zones_handpick" TO "anon";
GRANT ALL ON TABLE "public"."zones_handpick" TO "authenticated";
GRANT ALL ON TABLE "public"."zones_handpick" TO "service_role";



GRANT ALL ON TABLE "public"."zones_magasin" TO "anon";
GRANT ALL ON TABLE "public"."zones_magasin" TO "authenticated";
GRANT ALL ON TABLE "public"."zones_magasin" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








SET search_path = public, extensions;

-- ---------------------------------------------------------------------
-- Triggers sur auth.users
-- ---------------------------------------------------------------------
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE TRIGGER on_auth_user_signin AFTER UPDATE OF last_sign_in_at ON auth.users FOR EACH ROW WHEN ((new.last_sign_in_at IS DISTINCT FROM old.last_sign_in_at)) EXECUTE FUNCTION public.sync_last_login();

-- ---------------------------------------------------------------------
-- Storage : buckets + policies
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('message-attachments', 'message-attachments', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('cryptedmessage', 'cryptedmessage', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('project-task-attachments', 'project-task-attachments', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('wiki', 'wiki', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('annonces', 'annonces', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('ticket-attachments', 'ticket-attachments', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('bibliotheque', 'bibliotheque', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('magasin-plans', 'magasin-plans', false) on conflict (id) do nothing;
create policy "Anyone can view annonce media" on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'annonces'::text));
create policy "Anyone can view bibliotheque media" on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'bibliotheque'::text));
create policy "Anyone can view message attachments" on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'message-attachments'::text));
create policy "Anyone can view wiki images" on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'wiki'::text));
create policy "Authenticated users can delete bibliotheque media" on storage.objects as PERMISSIVE for DELETE to authenticated using ((bucket_id = 'bibliotheque'::text));
create policy "Authenticated users can update bibliotheque media" on storage.objects as PERMISSIVE for UPDATE to authenticated using ((bucket_id = 'bibliotheque'::text));
create policy "Authenticated users can upload bibliotheque media" on storage.objects as PERMISSIVE for INSERT to authenticated with check ((bucket_id = 'bibliotheque'::text));
create policy "Task viewers can read task attachments" on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'project-task-attachments'::text) AND (EXISTS ( SELECT 1
   FROM project_tasks t
  WHERE (((t.id)::text = (storage.foldername(objects.name))[1]) AND user_can_access_task(t.id))))));
create policy "Team members can delete task attachments" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'project-task-attachments'::text) AND (EXISTS ( SELECT 1
   FROM project_tasks t
  WHERE (((t.id)::text = (storage.foldername(objects.name))[1]) AND user_can_access_task(t.id, true))))));
create policy "Team members can upload task attachments" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'project-task-attachments'::text) AND (EXISTS ( SELECT 1
   FROM project_tasks t
  WHERE (((t.id)::text = (storage.foldername(objects.name))[1]) AND user_can_access_task(t.id, true))))));
create policy "Users can delete their message attachments" on storage.objects as PERMISSIVE for DELETE to public using (((bucket_id = 'message-attachments'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
create policy "Users can delete their ticket attachments" on storage.objects as PERMISSIVE for DELETE to public using (((bucket_id = 'ticket-attachments'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
create policy "Users can upload message attachments" on storage.objects as PERMISSIVE for INSERT to public with check (((bucket_id = 'message-attachments'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
create policy "Users can upload their ticket attachments" on storage.objects as PERMISSIVE for INSERT to public with check (((bucket_id = 'ticket-attachments'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])));
create policy "Users can view ticket attachments they have access to" on storage.objects as PERMISSIVE for SELECT to public using (((bucket_id = 'ticket-attachments'::text) AND (((auth.uid())::text = (storage.foldername(name))[1]) OR (EXISTS ( SELECT 1
   FROM tickets
  WHERE (((tickets.id)::text = (storage.foldername(objects.name))[2]) AND ((tickets.user_id = auth.uid()) OR (tickets.assigned_to = auth.uid()))))))));
create policy "annonce.manage can delete annonce media" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'annonces'::text) AND ( SELECT has_permission('manager.annonce'::text) AS has_permission)));
create policy "annonce.manage can update annonce media" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'annonces'::text) AND ( SELECT has_permission('manager.annonce'::text) AS has_permission)));
create policy "annonce.manage can upload annonce media" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'annonces'::text) AND ( SELECT has_permission('manager.annonce'::text) AS has_permission)));
create policy "bibliotheque.manage can delete bibliotheque media" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'bibliotheque'::text) AND user_has_permission(auth.uid(), 'bibliotheque.manage'::text)));
create policy "bibliotheque.manage can update bibliotheque media" on storage.objects as PERMISSIVE for UPDATE to authenticated using (((bucket_id = 'bibliotheque'::text) AND user_has_permission(auth.uid(), 'bibliotheque.manage'::text)));
create policy "bibliotheque.manage can upload bibliotheque media" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'bibliotheque'::text) AND user_has_permission(auth.uid(), 'bibliotheque.manage'::text)));
create policy "cryptedmessage deletes" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'cryptedmessage'::text) AND cm_can_access_chat_folder((storage.foldername(name))[1]) AND ((owner IS NULL) OR (owner = auth.uid()))));
create policy "cryptedmessage downloads" on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'cryptedmessage'::text) AND cm_can_access_chat_folder((storage.foldername(name))[1])));
create policy "cryptedmessage uploads" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'cryptedmessage'::text) AND cm_can_access_chat_folder((storage.foldername(name))[1])));
create policy magasin_plans_delete on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'magasin-plans'::text) AND ( SELECT has_permission('magasin.update'::text) AS has_permission) AND ( SELECT auth_session_is_aal2() AS auth_session_is_aal2)));
create policy magasin_plans_insert on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'magasin-plans'::text) AND ( SELECT has_permission('magasin.update'::text) AS has_permission) AND ( SELECT auth_session_is_aal2() AS auth_session_is_aal2)));
create policy magasin_plans_select on storage.objects as PERMISSIVE for SELECT to authenticated using (((bucket_id = 'magasin-plans'::text) AND ( SELECT has_permission('magasin.view'::text) AS has_permission) AND ( SELECT auth_session_is_aal2() AS auth_session_is_aal2)));
create policy "wiki.manage can delete wiki images" on storage.objects as PERMISSIVE for DELETE to public using (((bucket_id = 'wiki'::text) AND user_has_permission(auth.uid(), 'wiki.manage'::text)));
create policy "wiki.manage can update wiki images" on storage.objects as PERMISSIVE for UPDATE to public using (((bucket_id = 'wiki'::text) AND user_has_permission(auth.uid(), 'wiki.manage'::text)));
create policy "wiki.manage can upload wiki images" on storage.objects as PERMISSIVE for INSERT to public with check (((bucket_id = 'wiki'::text) AND user_has_permission(auth.uid(), 'wiki.manage'::text)));

-- ---------------------------------------------------------------------
-- Données de référence (rôles, services, permissions, référentiels)
-- ---------------------------------------------------------------------
SET session_replication_role = replica;

INSERT INTO "public"."roles" ("id", "nom", "permissions", "created_at", "updated_at") VALUES
	('ae166448-4adf-4d2d-9fae-dfa27ceb1a87', 'SuperAdmin', '{"users": true, "content": true, "tickets": true, "messages": true, "projects": true, "security": true, "settings": true, "dashboard": true, "ping_pong": true, "roles_services": true}', '2026-10-23 09:42:24.634335+00', '2026-10-23 09:42:24.703345+00'),
	('d7a6bfba-c4b9-49f8-aad8-f43259badff5', 'Admin', '{"users": true, "content": true, "tickets": true, "messages": true, "projects": true, "security": true, "settings": true, "dashboard": true, "ping_pong": true, "roles_services": true}', '2026-10-23 09:42:24.634335+00', '2026-10-23 09:42:24.703345+00'),
	('5ba31e60-1698-45ff-9c0a-081e67f8a06e', 'Market', '{"content": true, "tickets": true, "messages": true, "projects": false, "settings": true, "dashboard": true, "ping_pong": true}', '2026-10-23 09:42:24.634335+00', '2026-10-23 09:42:24.703345+00'),
	('f505caae-8975-4670-88bb-416214a1ad3a', 'Compta', '{"tickets": true, "messages": true, "projects": false, "settings": true, "dashboard": true, "ping_pong": true}', '2026-10-23 09:42:24.634335+00', '2026-10-23 09:42:24.703345+00'),
	('df2c0401-0f79-4d0e-a9ae-8d0fb33ba690', 'Employé', '{"tickets": true, "messages": true, "projects": false, "settings": true, "dashboard": true, "ping_pong": true}', '2026-10-23 09:42:24.634335+00', '2026-10-23 09:42:24.703345+00');

INSERT INTO "public"."services" ("id", "nom", "permissions", "created_at", "updated_at") VALUES
	('2d0ca4e3-01b7-4749-b2a7-485e0e2b94a4', 'Direction', '{"users": true, "content": true, "tickets": true, "messages": true, "projects": false, "security": true, "settings": true, "dashboard": true, "ping_pong": true, "roles_services": true}', '2026-10-23 09:42:24.634335+00', '2026-10-23 09:42:24.868739+00'),
	('79fa6638-3744-47cf-b3d5-3548e0657a7e', 'Marketing', '{"content": true, "tickets": true, "messages": true, "projects": false, "settings": true, "dashboard": true, "ping_pong": true}', '2026-10-23 09:42:24.634335+00', '2026-10-23 09:42:24.868739+00'),
	('e3d4feba-a2e5-4c46-9920-286454464134', 'Comptabilité', '{"tickets": true, "messages": true, "projects": false, "settings": true, "dashboard": true, "ping_pong": true}', '2026-10-23 09:42:24.634335+00', '2026-10-23 09:42:24.868739+00'),
	('8ebe5d21-6934-4788-bfe8-c76a2d6fd84e', 'RH', '{"users": true, "tickets": true, "messages": true, "projects": false, "settings": true, "dashboard": true, "ping_pong": true}', '2026-10-23 09:42:24.634335+00', '2026-10-23 09:42:24.868739+00'),
	('b5f1309a-1dda-4e38-b425-eba554692afc', 'IT', '{"users": true, "tickets": true, "messages": true, "projects": true, "security": true, "settings": true, "dashboard": true, "ping_pong": true}', '2026-10-23 09:42:24.634335+00', '2026-10-23 09:42:24.868739+00');

INSERT INTO "public"."app_logs_retention_config" ("table_name", "date_column", "retention_months", "enabled", "extra_filter") VALUES
	('app_logs', 'created_at', 12, true, NULL),
	('logs_crm', 'change_at', 12, true, NULL),
	('ticket_table', 'created_at', 12, true, 'category = ''bug'''),
	('newsletter_api_logs', 'ts', 3, true, NULL),
	('newsletter_send_runs', 'started_at', 12, true, NULL),
	('wiki_article_views', 'viewed_at', 6, true, NULL);

INSERT INTO "public"."zones_handpick" ("id", "parent_id", "kind", "code", "label", "pos_x", "pos_y", "width", "height", "rotation", "color", "sort_order", "is_active", "created_at", "updated_at", "created_by") VALUES
	('2d8577d6-7f1c-46be-a228-de3f1d647d51', NULL, 'zone', 'A', 'Annexe', NULL, NULL, NULL, NULL, NULL, NULL, 1, false, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('fb5a24dc-92cd-41e4-9c63-215b111d5bda', NULL, 'zone', 'B', 'Bags', NULL, NULL, NULL, NULL, NULL, NULL, 0, false, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('c788644e-6cf9-4322-8f37-c8a54bf4abd6', NULL, 'zone', 'D', 'Display', NULL, NULL, NULL, NULL, NULL, NULL, 2, false, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('774a2e5e-b669-425d-9926-9ca86406221c', 'fb5a24dc-92cd-41e4-9c63-215b111d5bda', 'allee', 'R1', 'Rangée du haut', NULL, NULL, NULL, NULL, NULL, NULL, 1, false, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('92a3d2cf-980a-4b4a-9496-4d8a2d6643ce', '774a2e5e-b669-425d-9926-9ca86406221c', 'etagere', 'E1', 'Étagère 1', NULL, NULL, NULL, NULL, NULL, NULL, 1, false, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.65063+00', NULL),
	('583265ff-41aa-4c2e-9584-cd26508eac30', '774a2e5e-b669-425d-9926-9ca86406221c', 'etagere', 'E2', 'Étagère 2', NULL, NULL, NULL, NULL, NULL, NULL, 2, false, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.65063+00', NULL),
	('491e6f78-62af-429c-9613-4c9d86e94f52', '774a2e5e-b669-425d-9926-9ca86406221c', 'etagere', 'E3', 'Étagère 3', NULL, NULL, NULL, NULL, NULL, NULL, 3, false, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.65063+00', NULL),
	('9361ca58-0677-4269-bc83-60e0f64e9028', '774a2e5e-b669-425d-9926-9ca86406221c', 'etagere', 'E4', 'Étagère 4', NULL, NULL, NULL, NULL, NULL, NULL, 4, false, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.65063+00', NULL),
	('6a36d0ce-1b59-46c4-b005-76e5372bb2f1', '774a2e5e-b669-425d-9926-9ca86406221c', 'etagere', 'E5', 'Étagère 5', NULL, NULL, NULL, NULL, NULL, NULL, 5, false, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.65063+00', NULL),
	('e3f31104-06a6-4f7f-af7e-53db54b70d06', '931b9358-7789-4265-a64f-1848c9206bed', 'etagere', 'E1', 'Travée 1', NULL, NULL, NULL, NULL, NULL, NULL, 1, false, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('edb1e9d7-df1b-4ccd-b70f-914d334462b7', '931b9358-7789-4265-a64f-1848c9206bed', 'etagere', 'E2', 'Travée 2', NULL, NULL, NULL, NULL, NULL, NULL, 2, false, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('8baee339-e685-4f57-9c37-a099c167eb2c', '931b9358-7789-4265-a64f-1848c9206bed', 'etagere', 'E3', 'Travée 3', NULL, NULL, NULL, NULL, NULL, NULL, 3, false, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('c5678d96-e525-4be3-ad3b-21eb6e78e43f', '931b9358-7789-4265-a64f-1848c9206bed', 'etagere', 'E4', 'Travée 4', NULL, NULL, NULL, NULL, NULL, NULL, 4, false, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('139bcf38-ea71-4556-aff6-d7f1d84a7c93', '931b9358-7789-4265-a64f-1848c9206bed', 'etagere', 'E5', 'Travée 5', NULL, NULL, NULL, NULL, NULL, NULL, 5, false, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('d79f0c3a-8c0b-438d-b75e-c579a5c5ba62', '6dbcf60a-415d-47a6-a966-bdf3c000d9b7', 'etagere', 'E1', 'Travée 1', NULL, NULL, NULL, NULL, NULL, NULL, 1, false, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('61e3546e-55ab-41b4-9c49-69271e203d3f', '6dbcf60a-415d-47a6-a966-bdf3c000d9b7', 'etagere', 'E2', 'Travée 2', NULL, NULL, NULL, NULL, NULL, NULL, 2, false, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('91a3cbcd-8ed2-4bb8-8cc4-7faf036ec2f6', '6dbcf60a-415d-47a6-a966-bdf3c000d9b7', 'etagere', 'E3', 'Travée 3', NULL, NULL, NULL, NULL, NULL, NULL, 3, false, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('a8fe5182-d4ad-449b-9705-4175269a5147', '6dbcf60a-415d-47a6-a966-bdf3c000d9b7', 'etagere', 'E4', 'Travée 4', NULL, NULL, NULL, NULL, NULL, NULL, 4, false, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('272bae53-c578-4090-8c41-dd94b5fb4ab7', '6dbcf60a-415d-47a6-a966-bdf3c000d9b7', 'etagere', 'E5', 'Travée 5', NULL, NULL, NULL, NULL, NULL, NULL, 5, false, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('be1582e8-9072-47e1-a077-58e641fc8efa', '4db6ed69-f6a6-4f71-a647-0cab2bbbf39b', 'etagere', 'E1', 'Travée 1', NULL, NULL, NULL, NULL, NULL, NULL, 1, false, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('732f2e72-2977-4e0f-8434-b157e58dc2b3', '4db6ed69-f6a6-4f71-a647-0cab2bbbf39b', 'etagere', 'E2', 'Travée 2', NULL, NULL, NULL, NULL, NULL, NULL, 2, false, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('b31bea4b-9e82-422a-a8a5-974f4aa76fa1', '4db6ed69-f6a6-4f71-a647-0cab2bbbf39b', 'etagere', 'E3', 'Travée 3', NULL, NULL, NULL, NULL, NULL, NULL, 3, false, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('8c2bca50-81b8-49c8-b1fa-ea6868d37449', '4db6ed69-f6a6-4f71-a647-0cab2bbbf39b', 'etagere', 'E4', 'Travée 4', NULL, NULL, NULL, NULL, NULL, NULL, 4, false, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('6b958159-4f14-44db-9190-875f6d6c6448', '4db6ed69-f6a6-4f71-a647-0cab2bbbf39b', 'etagere', 'E5', 'Travée 5', NULL, NULL, NULL, NULL, NULL, NULL, 5, false, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('4db6ed69-f6a6-4f71-a647-0cab2bbbf39b', 'fb5a24dc-92cd-41e4-9c63-215b111d5bda', 'allee', 'R5', 'Rack vertical', NULL, NULL, NULL, NULL, NULL, NULL, 5, false, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.735862+00', NULL),
	('6dbcf60a-415d-47a6-a966-bdf3c000d9b7', 'fb5a24dc-92cd-41e4-9c63-215b111d5bda', 'allee', 'R4', 'Rangée du bas', NULL, NULL, NULL, NULL, NULL, NULL, 4, false, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.735862+00', NULL),
	('931b9358-7789-4265-a64f-1848c9206bed', 'fb5a24dc-92cd-41e4-9c63-215b111d5bda', 'allee', 'R2', 'Rack double — face haute', NULL, NULL, NULL, NULL, NULL, NULL, 2, false, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.735862+00', NULL),
	('c1d96c94-9d2f-4ee2-aa08-366ad1ff5e96', 'fb5a24dc-92cd-41e4-9c63-215b111d5bda', 'allee', 'R3', 'Rack double — face basse', NULL, NULL, NULL, NULL, NULL, NULL, 3, false, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('718254c3-b7ba-473b-9e92-7407ad52d502', 'c1d96c94-9d2f-4ee2-aa08-366ad1ff5e96', 'etagere', 'E1', 'Travée 1', NULL, NULL, NULL, NULL, NULL, NULL, 1, false, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('d6bdfe0a-bd8a-46e4-8f2d-2e4b635e7320', 'c1d96c94-9d2f-4ee2-aa08-366ad1ff5e96', 'etagere', 'E2', 'Travée 2', NULL, NULL, NULL, NULL, NULL, NULL, 2, false, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('443c1696-be7c-4bda-9804-358bce75de87', 'c1d96c94-9d2f-4ee2-aa08-366ad1ff5e96', 'etagere', 'E3', 'Travée 3', NULL, NULL, NULL, NULL, NULL, NULL, 3, false, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('5813482d-3086-4082-a652-8b00e4726359', 'c1d96c94-9d2f-4ee2-aa08-366ad1ff5e96', 'etagere', 'E4', 'Travée 4', NULL, NULL, NULL, NULL, NULL, NULL, 4, false, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('693f4bed-7f5a-49b3-9b3f-2bd49a6b4131', 'c1d96c94-9d2f-4ee2-aa08-366ad1ff5e96', 'etagere', 'E5', 'Travée 5', NULL, NULL, NULL, NULL, NULL, NULL, 5, false, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('a28711ad-b1b7-49d9-b995-4dab400a44dd', 'fb5a24dc-92cd-41e4-9c63-215b111d5bda', 'etagere', 'E1', 'Étagère 1', NULL, NULL, NULL, NULL, NULL, NULL, 1, false, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('4bac155b-7cef-4d25-a624-40bb8d356f5f', 'fb5a24dc-92cd-41e4-9c63-215b111d5bda', 'etagere', 'E2', 'Étagère 2', NULL, NULL, NULL, NULL, NULL, NULL, 2, false, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('4e327494-14de-49c5-93dd-a0a6cb310066', 'fb5a24dc-92cd-41e4-9c63-215b111d5bda', 'etagere', 'E3', 'Étagère 3', NULL, NULL, NULL, NULL, NULL, NULL, 3, false, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('302d6579-d47a-4ac1-aca5-c357727f561d', 'fb5a24dc-92cd-41e4-9c63-215b111d5bda', 'etagere', 'E4', 'Étagère 4', NULL, NULL, NULL, NULL, NULL, NULL, 4, false, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('c71c4a7c-6533-473f-8ce1-1a017077c211', 'fb5a24dc-92cd-41e4-9c63-215b111d5bda', 'etagere', 'E5', 'Étagère 5', NULL, NULL, NULL, NULL, NULL, NULL, 5, false, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL);

INSERT INTO "public"."emplacements_handpick" ("id", "zone_id", "code", "label", "pos_x", "pos_y", "width", "height", "capacity", "is_active", "notes", "created_at", "updated_at", "created_by") VALUES
	('aecb00bd-c38f-4a20-a798-f329f31d4fec', '2d8577d6-7f1c-46be-a228-de3f1d647d51', 'SOL', 'Au sol', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('22a6a913-7928-4559-810b-a1609810537f', '92a3d2cf-980a-4b4a-9496-4d8a2d6643ce', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('51e2e462-b53b-423a-a365-76bc03445b67', '92a3d2cf-980a-4b4a-9496-4d8a2d6643ce', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('37b35ca5-abf7-4b23-b7c2-b246d96dc41f', '92a3d2cf-980a-4b4a-9496-4d8a2d6643ce', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('58493ee9-1c68-4ac1-9ec7-ea8151787b23', '583265ff-41aa-4c2e-9584-cd26508eac30', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('28695433-b069-414d-9e6a-387d15dd5581', '583265ff-41aa-4c2e-9584-cd26508eac30', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('d3899f08-9d30-4349-b2dc-9d528509c0a9', '583265ff-41aa-4c2e-9584-cd26508eac30', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('f5c14837-ffa7-4dc5-839c-9a118ff686ac', '491e6f78-62af-429c-9613-4c9d86e94f52', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('17ca2658-666e-4340-8489-81407e0a3997', '491e6f78-62af-429c-9613-4c9d86e94f52', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('65b8e924-aa7a-4f7d-b7ef-438035542d9a', '491e6f78-62af-429c-9613-4c9d86e94f52', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('8a67ebf5-af85-4663-a340-01e099f905e1', '9361ca58-0677-4269-bc83-60e0f64e9028', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('b1fb3f16-c51c-4126-bf44-c03fa4defef0', '9361ca58-0677-4269-bc83-60e0f64e9028', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('6115d448-4275-4eba-8a10-998a058aa132', '9361ca58-0677-4269-bc83-60e0f64e9028', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('5d56fafc-2f27-4523-8162-f033af2b33c3', '6a36d0ce-1b59-46c4-b005-76e5372bb2f1', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('1156c8ab-41e9-41b9-b2d7-97c4ad2e9c96', '6a36d0ce-1b59-46c4-b005-76e5372bb2f1', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('4b5fc5ab-2f78-4c49-8373-4054b8229c81', '6a36d0ce-1b59-46c4-b005-76e5372bb2f1', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('040d16f9-584d-4859-81a6-bd7446d7a63a', 'c788644e-6cf9-4322-8f37-c8a54bf4abd6', 'SOL', 'Au sol', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.605066+00', '2026-10-23 09:42:47.605066+00', NULL),
	('5dcbe164-a416-48ba-9610-72aaa46e9f93', 'e3f31104-06a6-4f7f-af7e-53db54b70d06', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('72ca566d-28bf-4ff7-bed2-e6b9ea227888', 'e3f31104-06a6-4f7f-af7e-53db54b70d06', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('155e5773-dac7-40b2-b359-6610b2f2b4f7', 'e3f31104-06a6-4f7f-af7e-53db54b70d06', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('a3c3e3ae-b6d7-4092-85bb-c5965287dbcd', 'edb1e9d7-df1b-4ccd-b70f-914d334462b7', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('e9039a83-2623-402c-9e6d-11b76e85c213', 'edb1e9d7-df1b-4ccd-b70f-914d334462b7', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('ea521aba-1779-4b98-acc4-05e45938dd9b', 'edb1e9d7-df1b-4ccd-b70f-914d334462b7', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('56e8cd64-68b1-48e4-824a-4ba51715c777', '8baee339-e685-4f57-9c37-a099c167eb2c', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('038807f1-ea49-4368-b869-16fa8e41d232', '8baee339-e685-4f57-9c37-a099c167eb2c', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('b2fa2439-1b7a-4cbe-abe7-f6c035c907df', '8baee339-e685-4f57-9c37-a099c167eb2c', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('0d40b72c-208a-4642-a499-3ce85c22ca89', 'c5678d96-e525-4be3-ad3b-21eb6e78e43f', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('531f5235-cf24-4fe9-b5ba-54b851302bd5', 'c5678d96-e525-4be3-ad3b-21eb6e78e43f', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('247865ee-8a84-4e64-aa91-ad23e8b631a2', 'c5678d96-e525-4be3-ad3b-21eb6e78e43f', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('1c677ff7-8993-4e8d-933c-16d26caff4f7', '139bcf38-ea71-4556-aff6-d7f1d84a7c93', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('32098a3d-8c5d-4b32-b795-93ec7fbc4310', '139bcf38-ea71-4556-aff6-d7f1d84a7c93', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('f8c9df64-d610-4d4c-a524-139eb3ad8813', '139bcf38-ea71-4556-aff6-d7f1d84a7c93', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('d34fe363-9c58-4399-b411-0d13f3f0c16e', 'd79f0c3a-8c0b-438d-b75e-c579a5c5ba62', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('ba02e826-b0b2-48fc-902e-62afbc865b75', 'd79f0c3a-8c0b-438d-b75e-c579a5c5ba62', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('52923984-d7e2-4628-9ab5-97f6b1415436', 'd79f0c3a-8c0b-438d-b75e-c579a5c5ba62', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('9f0b2bc8-c8bd-4c71-80ba-7a5993071cfe', '61e3546e-55ab-41b4-9c49-69271e203d3f', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('90bfbfae-c188-48f4-87d8-ef0afa44fcd6', '61e3546e-55ab-41b4-9c49-69271e203d3f', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('e7df2af1-505c-4bc8-ae80-dc28a35d6cd4', '61e3546e-55ab-41b4-9c49-69271e203d3f', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('092fcea8-8df6-4aa5-a0ff-d618f486abd7', '91a3cbcd-8ed2-4bb8-8cc4-7faf036ec2f6', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('4c20ca18-714f-48dc-ac7a-4de98193e90d', '91a3cbcd-8ed2-4bb8-8cc4-7faf036ec2f6', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('67f88362-2b20-48c1-9d73-50dda118a27e', '91a3cbcd-8ed2-4bb8-8cc4-7faf036ec2f6', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('ed10d7e1-7574-4a9e-99cc-19b2f90d8893', 'a8fe5182-d4ad-449b-9705-4175269a5147', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('87c1ae44-9d37-4667-9e05-fe0605db0c23', 'a8fe5182-d4ad-449b-9705-4175269a5147', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('dee82de2-d989-46db-83e9-b1998affffc2', 'a8fe5182-d4ad-449b-9705-4175269a5147', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('390f5e03-bf55-47a8-ac5b-508d321ef83c', '272bae53-c578-4090-8c41-dd94b5fb4ab7', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('f720becb-fac7-4a45-a685-a4ae073be411', '272bae53-c578-4090-8c41-dd94b5fb4ab7', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('7cb67e1c-6d01-42c8-985a-4a07bd479e96', '272bae53-c578-4090-8c41-dd94b5fb4ab7', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.65063+00', '2026-10-23 09:42:47.65063+00', NULL),
	('31633c56-5d72-4906-a10a-20d181441236', 'be1582e8-9072-47e1-a077-58e641fc8efa', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('b69036b9-a113-4f1d-a91b-3ca197f36c2e', 'be1582e8-9072-47e1-a077-58e641fc8efa', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('d8e17aa1-68dd-4bc5-9022-e270a6e8222f', 'be1582e8-9072-47e1-a077-58e641fc8efa', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('71688cb0-99ee-4ae9-9ace-abb89ff0f6c9', '732f2e72-2977-4e0f-8434-b157e58dc2b3', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('a40010d3-8745-484d-aee1-e0abfcb829d2', '732f2e72-2977-4e0f-8434-b157e58dc2b3', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('755c5da4-9514-4188-b8a5-e0d765f297b9', '732f2e72-2977-4e0f-8434-b157e58dc2b3', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('156e4c59-cbff-4aff-9b95-17014d95f8d7', 'b31bea4b-9e82-422a-a8a5-974f4aa76fa1', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('abd223dd-fdc4-41a8-8fbe-f1a04a949f6e', 'b31bea4b-9e82-422a-a8a5-974f4aa76fa1', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('20cc9be2-f30e-4a51-ba45-dc45c9bb9a9f', 'b31bea4b-9e82-422a-a8a5-974f4aa76fa1', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('2199422b-0431-47a1-8c89-3999f03979ab', '8c2bca50-81b8-49c8-b1fa-ea6868d37449', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('c685050a-bb44-4962-8322-003f0eb7dfa2', '8c2bca50-81b8-49c8-b1fa-ea6868d37449', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('d0e9789c-2c64-494f-ae6b-be1af7d42f53', '8c2bca50-81b8-49c8-b1fa-ea6868d37449', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('2d1fbe45-cb39-41fb-bd03-6e7d7d848e42', '6b958159-4f14-44db-9190-875f6d6c6448', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('6af76d79-77af-44dc-97bd-e4c3fd724b15', '6b958159-4f14-44db-9190-875f6d6c6448', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('951d3bb5-836e-4f6f-89dd-f3473f84fcbd', '6b958159-4f14-44db-9190-875f6d6c6448', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.694199+00', '2026-10-23 09:42:47.694199+00', NULL),
	('d461933f-b9fd-4d78-8c78-bfbbd91c70b2', '718254c3-b7ba-473b-9e92-7407ad52d502', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('4bb6d13a-e8ef-4d5f-8769-8706a0df7ffc', '718254c3-b7ba-473b-9e92-7407ad52d502', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('997d00e5-2efb-40b9-be06-909409ee7095', '718254c3-b7ba-473b-9e92-7407ad52d502', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('c26d7a21-4900-4cb4-9745-4c89f8fff127', 'd6bdfe0a-bd8a-46e4-8f2d-2e4b635e7320', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('ebfea65c-f53d-472b-b55d-b811077569c0', 'd6bdfe0a-bd8a-46e4-8f2d-2e4b635e7320', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('929b448d-379f-4e29-baf9-6131cd5424b2', 'd6bdfe0a-bd8a-46e4-8f2d-2e4b635e7320', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('01ce7a78-8a82-4ed8-a904-bf5964ee211f', '443c1696-be7c-4bda-9804-358bce75de87', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('b9f0489c-3617-498b-b246-f7c104d60eac', '443c1696-be7c-4bda-9804-358bce75de87', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('ee6e7d7e-7c28-45cf-8a9b-22e95bac2a86', '443c1696-be7c-4bda-9804-358bce75de87', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('2a52078d-7938-4872-955a-ffbc1469d9cc', '5813482d-3086-4082-a652-8b00e4726359', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('b50b1878-dc68-4409-a610-e85b897492b6', '5813482d-3086-4082-a652-8b00e4726359', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('495420be-f549-405e-8949-72a1db03a05d', '5813482d-3086-4082-a652-8b00e4726359', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('18ddbdd1-369b-4ec6-bd2b-3276a76d4075', '693f4bed-7f5a-49b3-9b3f-2bd49a6b4131', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('6616e84b-3f21-49ab-9122-f1bc8ab035ae', '693f4bed-7f5a-49b3-9b3f-2bd49a6b4131', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('ded7627c-86d9-434b-9827-bff88dfafc64', '693f4bed-7f5a-49b3-9b3f-2bd49a6b4131', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:42:47.735862+00', '2026-10-23 09:42:47.735862+00', NULL),
	('723c2828-8bb0-4b4d-9677-28392694ced5', 'a28711ad-b1b7-49d9-b995-4dab400a44dd', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('a2c3c212-d1b8-4262-8757-a348b40a81fc', 'a28711ad-b1b7-49d9-b995-4dab400a44dd', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('cb56eb6b-41f1-40c1-a193-ccb1497e9cb6', 'a28711ad-b1b7-49d9-b995-4dab400a44dd', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('ee9b6bb1-ebd0-4502-ba0d-1225b11f3bb7', '4bac155b-7cef-4d25-a624-40bb8d356f5f', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('e3d6d2c4-0702-40fa-8506-945511e95add', '4bac155b-7cef-4d25-a624-40bb8d356f5f', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('aec5e96d-fca5-4574-941f-4410fdd5a4e3', '4bac155b-7cef-4d25-a624-40bb8d356f5f', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('7e0b8bf9-3abc-4ffe-b18a-097df5cdeef4', '4e327494-14de-49c5-93dd-a0a6cb310066', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('39c7867e-5a8e-4be2-9663-a0f238456978', '4e327494-14de-49c5-93dd-a0a6cb310066', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('86a3d940-804f-492d-98e5-83c12d7a45d8', '4e327494-14de-49c5-93dd-a0a6cb310066', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('be93be62-80cb-4e70-bd8d-7daf2557fd20', '302d6579-d47a-4ac1-aca5-c357727f561d', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('68389e82-94a6-4049-8486-3ad660dcb899', '302d6579-d47a-4ac1-aca5-c357727f561d', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('8dd153f7-408d-4b78-83fb-14eb638c7544', '302d6579-d47a-4ac1-aca5-c357727f561d', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('12fa16df-4757-4567-8630-8f171d0c859e', 'c71c4a7c-6533-473f-8ce1-1a017077c211', 'H0', 'Hauteur 0', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('1b00d333-e095-475c-a237-73ac9316e06e', 'c71c4a7c-6533-473f-8ce1-1a017077c211', 'H1', 'Hauteur 1', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL),
	('4fbd81fc-63b4-44bc-9cd8-4cebbdacfe86', 'c71c4a7c-6533-473f-8ce1-1a017077c211', 'H2', 'Hauteur 2', NULL, NULL, NULL, NULL, NULL, false, NULL, '2026-10-23 09:43:03.534413+00', '2026-10-23 09:43:03.534413+00', NULL);

INSERT INTO "public"."bibliotheque_brief" ("id", "brief", "brief_en", "updated_at", "chiffres", "chiffres_en") VALUES
	(1, '', '', '2026-10-23 09:42:27.564495+00', '', '');

INSERT INTO "public"."brief_cat" ("id", "type", "categorie", "available") VALUES
	(1, 'Vinted', 'plateformes', NULL),
	(2, 'Ebay', 'plateformes', NULL),
	(3, 'Vestiaire Collective', 'plateformes', NULL),
	(4, 'Whatnote', 'plateformes', NULL),
	(5, 'Site personnel', 'plateformes', NULL),
	(6, 'Depop', 'plateformes', NULL),
	(7, 'Tik-Tok Live', 'plateformes', NULL),
	(8, 'Instagram', 'provenances', NULL),
	(9, 'Tik-Tok', 'provenances', NULL),
	(10, 'Site', 'provenances', NULL),
	(11, 'Recommandation', 'provenances', NULL),
	(12, 'Appel', 'provenances', NULL),
	(13, 'IA', 'provenances', NULL),
	(14, 'Campagne', 'localisations', NULL),
	(15, 'Ville moyenne', 'localisations', NULL),
	(16, 'Grande ville', 'localisations', NULL),
	(17, 'Zone industrielle', 'localisations', NULL),
	(18, 'Centre commercial', 'localisations', NULL),
	(19, 'Sweat', 'produits', NULL),
	(20, 'Polaire', 'produits', NULL),
	(21, 'T-shirt', 'produits', NULL),
	(22, 'Polo', 'produits', NULL),
	(23, 'Chemise', 'produits', NULL),
	(24, 'Manteau', 'produits', NULL),
	(25, 'Jeans', 'produits', NULL),
	(26, 'Vestes', 'produits', NULL),
	(27, 'Sport', 'produits', NULL),
	(28, 'Y2K', 'produits', NULL),
	(29, 'Workwear', 'produits', NULL),
	(30, 'Accessoires', 'produits', NULL),
	(31, 'Robes', 'produits', NULL),
	(32, 'Jupes', 'produits', NULL),
	(33, 'Chemisiers', 'produits', NULL),
	(34, 'Shorts', 'produits', NULL),
	(35, 'Maillots US', 'produits', NULL),
	(36, 'Maillots classiques', 'produits', NULL),
	(37, 'Cargo', 'produits', NULL),
	(38, 'Enfant', 'produits', NULL),
	(39, 'Chaussures', 'produits', NULL),
	(40, 'Bleu de travail', 'produits', NULL),
	(41, 'Ralph Lauren', 'marques', NULL),
	(42, 'Tommy Hilfiger', 'marques', NULL),
	(43, 'Levi''s', 'marques', NULL),
	(44, 'Nike', 'marques', NULL),
	(45, 'Adidas', 'marques', NULL),
	(46, 'The North Face', 'marques', NULL),
	(47, 'Champion', 'marques', NULL),
	(48, 'Carhartt', 'marques', NULL),
	(49, 'Dickies', 'marques', NULL),
	(50, 'Patagonia', 'marques', NULL),
	(51, 'Schott', 'marques', NULL),
	(52, 'NBA', 'marques', NULL),
	(53, 'MLB', 'marques', NULL),
	(54, 'NFL', 'marques', NULL),
	(55, 'NHL', 'marques', NULL),
	(56, 'Lacoste', 'marques', NULL),
	(57, 'Barbour', 'marques', NULL),
	(58, 'Burberry', 'marques', NULL),
	(59, 'Harley Davidson', 'marques', NULL),
	(60, 'Avirex', 'marques', NULL),
	(61, 'Starter', 'marques', NULL),
	(62, 'Logo seven', 'marques', NULL),
	(63, 'Sportswear', 'styles', NULL),
	(64, 'Workwear', 'styles', NULL),
	(65, 'Modern', 'styles', NULL),
	(66, 'Big Logo', 'styles', NULL),
	(67, 'Grunge', 'styles', NULL),
	(68, 'Vintage 80s / 90s', 'styles', NULL),
	(69, 'Minimal / Modern', 'styles', NULL),
	(70, 'Denim', 'styles', NULL),
	(71, 'Y2K', 'styles', NULL),
	(72, 'Imprimer', 'styles', NULL),
	(73, 'Velours', 'styles', NULL),
	(74, 'Cuir', 'styles', NULL),
	(75, 'Plain', 'styles', NULL),
	(76, 'Military', 'styles', NULL),
	(77, 'Coton', 'matieres', NULL),
	(78, 'Laine', 'matieres', NULL),
	(79, 'Soie', 'matieres', NULL),
	(80, 'Lin', 'matieres', NULL),
	(81, 'Mohair', 'matieres', NULL),
	(82, 'Tech', 'matieres', NULL),
	(83, 'Cachemire', 'matieres', NULL),
	(84, 'Jeans', 'matieres', NULL),
	(85, 'Cuir', 'matieres', NULL),
	(86, 'Nylon', 'matieres', NULL),
	(89, '3k - 5k', 'budgets', NULL),
	(90, '+5k', 'budgets', NULL),
	(91, 'Immediat', 'horizons', NULL),
	(92, '1 mois', 'horizons', NULL),
	(93, '3 mois', 'horizons', NULL),
	(94, '6 mois', 'horizons', NULL),
	(95, 'Nouveau', 'experiences', NULL),
	(96, '0 - 1 ans', 'experiences', NULL),
	(97, '1 - 3 ans', 'experiences', NULL),
	(98, '+ 3 ans', 'experiences', NULL),
	(87, '800 - 1.5k', 'budgets', NULL),
	(88, '1.5k - 3k', 'budgets', NULL);

INSERT INTO "public"."crm_produit_recherche_stats" ("id", "snapshot_month", "total_entries", "created_at") VALUES
	(1, '2026-10-01', 0, '2026-10-23 09:43:01.471381+00');

INSERT INTO "public"."tri_sorties" ("id", "code", "libelle", "ordre", "actif", "created_at") VALUES
	('5f4e49fd-711a-4098-9c7f-89347635af1a', 'MAG', 'Magasin', 1, true, '2026-10-23 09:42:48.199485+00'),
	('5e5edf80-04b8-4e5c-a989-b05832a81c12', 'KS', 'Kilo shop', 2, true, '2026-10-23 09:42:48.199485+00'),
	('2cc1b56f-41bb-40dc-8e9e-72d6abea4f04', 'SO3', 'SO3', 3, true, '2026-10-23 09:42:48.199485+00'),
	('35cf0b75-41bc-4df9-9673-9b8379d08af6', 'EXPORT', 'Export', 4, true, '2026-10-23 09:42:48.199485+00');

INSERT INTO "public"."kpis" ("id", "name", "value", "previous_value", "change_percentage", "period", "category", "created_at") VALUES
	('ffcba6c1-23c3-4c0f-9a16-33801213b7c8', 'Utilisateurs actifs', 1247, 1180, 5.68, 'Mensuel', 'Engagement', '2026-10-23 09:42:24.021299+00'),
	('4bad8b0f-fb62-49a7-892a-8f7aa5ae84bc', 'Revenus', 45600, 42300, 7.80, 'Mensuel', 'Financier', '2026-10-23 09:42:24.021299+00'),
	('54797f98-5549-414e-8808-b8d62791fbcf', 'Conversions', 89, 76, 17.11, 'Hebdomadaire', 'Marketing', '2026-10-23 09:42:24.021299+00'),
	('f05f8c46-90a6-49df-91c6-be1222aadc0f', 'Satisfaction client', 4.2, 3.9, 7.69, 'Mensuel', 'Qualité', '2026-10-23 09:42:24.021299+00');

INSERT INTO "public"."permissions" ("id", "code", "label", "category", "created_at") VALUES
	('245c4614-6bc9-4a61-b07b-3ce125cb4a10', 'availability.manage', 'Gérer les disponibilités des commerciaux', 'crm', '2026-10-23 09:42:34.680769+00'),
	('c7573716-5359-4ab4-96dc-abe9dc2db7dd', 'communication.view', 'Accéder à la page Communication', 'communication', '2026-10-23 09:42:35.012461+00'),
	('f588c809-5a3c-4b99-a442-2df4b92f17b6', 'bibliotheque.view', 'Accéder à la page Bibliothèque', 'bibliotheque', '2026-10-23 09:42:35.042355+00'),
	('93fe005e-3279-4c8b-b63d-1f064f370b93', 'stock.arrivage.newsletter.send', 'Envoyer/renvoyer la newsletter arrivages', 'stock', '2026-10-23 09:42:35.34392+00'),
	('2d003902-0df0-4908-b272-5249b2ba0169', 'crm.tournee', 'Accéder à La Tournée (gamification setters)', 'crm', '2026-10-23 09:42:35.525833+00'),
	('19ebdbab-02f1-48c2-b444-e77815f13aaa', 'manager.gen_types', 'Générer les types TypeScript depuis le schéma', 'manager', '2026-10-23 09:42:36.275076+00'),
	('1705e596-ffe8-42d8-a853-3280e8df8536', 'stock_handpick.inventaire.update', 'Modifier une balle handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('01e87c0b-46dd-4bec-984b-e50ceb883ac5', 'stock_handpick.flux.create', 'Enregistrer un mouvement handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('b2a2fb76-26b5-4c45-9ab8-724d23faba38', 'stock_handpick.plan.update', 'Modifier une zone / un emplacement handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('d5731488-5989-4a74-a5be-f4c569eee74c', 'stock_handpick.history.view', 'Voir l''historique du stock handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('9ee2a7c4-47eb-4515-a499-e27d582466e9', 'stock_handpick.inventaire.view', 'Voir l''inventaire handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('7b9690c9-fa30-404f-bdf7-b70ae30a993d', 'stock_handpick.dashboard.view', 'Voir le dashboard du stock handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('e45de5f9-004b-4859-8752-2f1c653adfc1', 'stock_handpick.plan.create', 'Créer une zone / un emplacement handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('8e21fb2d-4cf4-42dd-a37e-32562cc69d6b', 'stock_handpick.inventaire.create', 'Créer une balle handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('f011041f-8893-4c5c-8d89-6c08e5bb12f4', 'stock_handpick.plan.delete', 'Supprimer une zone / un emplacement handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('719e0e73-9f14-416c-8dfe-4c9d37691b28', 'stock_handpick.flux.delete', 'Supprimer un mouvement handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('101dd580-7de0-4971-b305-d639dc32e865', 'stock_handpick.plan.view', 'Voir le plan de l''entrepôt handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('03e14984-607b-4570-b717-2de74cf2e1e3', 'stock_handpick.settings.view', 'Voir les paramètres du stock handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('702dab40-c9db-4237-a532-edd9ddcb9aee', 'stock_handpick.settings.update', 'Modifier un fournisseur / une catégorie handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('13e012e8-4f87-4572-81cb-c620ef950d0d', 'stock_handpick.settings.create', 'Créer un fournisseur / une catégorie handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('81471bbc-bc4d-4e57-9803-bd179842640b', 'stock_handpick.view', 'Accéder au stock handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('92b7c31b-9831-4319-a832-adfcbe032fe4', 'stock_handpick.flux.update', 'Modifier un mouvement handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('c85ed7d9-151f-4d96-b7af-a8e4187402cb', 'stock_handpick.flux.view', 'Voir les flux du stock handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('b07927da-3d30-4aa6-a3fc-8b24d0125455', 'stock_handpick.settings.delete', 'Supprimer un fournisseur / une catégorie handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('1a4b705f-2912-4119-a93d-1e68b97a6e76', 'stock_handpick.inventaire.delete', 'Supprimer une balle handpick', 'stock_handpick', '2026-10-23 09:42:37.046858+00'),
	('115ab776-d18a-4335-8129-965324bc44ea', 'stock.packing.admin', 'Superviser le classement des packing lists', 'stock', '2026-10-23 09:42:37.884595+00'),
	('328b2d86-3057-483a-999f-219808e4238e', 'crm.clients.export', 'Exporter toute la base clients (Excel)', 'crm', '2026-10-23 09:42:39.029944+00'),
	('d67133da-98b6-4ea3-a6e7-5cf12b2dadc2', 'wiki.view', 'Consulter le wiki', 'wiki', '2026-10-23 09:42:45.415538+00'),
	('83388f25-56bc-4192-afb3-df8ab66c4c07', 'wiki.manage', 'Gérer le wiki', 'wiki', '2026-10-23 09:42:45.415538+00'),
	('f963caf6-4fb6-43a7-8e7c-94d455142f15', 'bibliotheque.manage', 'Gérer la Bibliothèque (créer/modifier/supprimer)', 'bibliotheque', '2026-10-23 09:42:45.644651+00'),
	('fe5a379e-c048-4998-b716-b1c37874bc5c', 'crm.brief_options.manage', 'Gérer les listes du brief CRM (plateformes, styles...)', 'crm', '2026-10-23 09:42:45.784774+00'),
	('ca51291a-0f97-4d69-9c95-09de9c648ecd', 'stock.settings.view', 'Voir les paramètres du stock', 'stock', '2026-10-23 09:42:45.944007+00'),
	('6f069863-29e0-44e0-9977-a0501761d620', 'stock.settings.delete', 'Supprimer une catégorie / un fournisseur', 'stock', '2026-10-23 09:42:45.944007+00'),
	('08db1967-6106-42a5-8bbf-c493034d724a', 'stock.history.view', 'Voir l''historique du stock', 'stock', '2026-10-23 09:42:45.944007+00'),
	('a418784c-54c5-4bf2-9ae1-0f57a8d2b724', 'stock.settings.create', 'Créer une catégorie / un fournisseur', 'stock', '2026-10-23 09:42:45.944007+00'),
	('46d91020-a8d7-441a-a1bd-453c880e32de', 'stock.settings.update', 'Modifier une catégorie / un fournisseur', 'stock', '2026-10-23 09:42:45.944007+00'),
	('f7565252-2ee7-4caa-b4b5-855218d09c88', 'maintenance.bypass', 'Accéder à l''application pendant une maintenance', 'manager', '2026-10-23 09:42:45.987559+00'),
	('04b207a3-f50b-4fa4-85b6-092e4ebf2aa0', 'dashboard.templates.manage', 'Gérer les dispositions de dashboard par rôle', 'dashboard', '2026-10-23 09:42:45.987559+00'),
	('ea3cf61b-6eb9-4174-b0a5-1a0e2d1b840b', 'changelogs.delete', 'Supprimer une version de changelog', 'manager', '2026-10-23 09:42:46.246633+00'),
	('b10a8bb6-c426-49bc-b784-a0abfc8926fb', 'changelogs.create', 'Créer une version de changelog', 'manager', '2026-10-23 09:42:46.246633+00'),
	('68859eab-108b-4280-83be-e07969940d31', 'changelogs.edit', 'Modifier une version de changelog', 'manager', '2026-10-23 09:42:46.246633+00'),
	('d81e8dbc-c988-4318-b9f1-419e26d9b381', 'stock.packing.update', 'Vérifier et valider une packing list', 'stock', '2026-10-23 09:42:47.189726+00'),
	('a77d73d2-6ea3-4613-abc4-5d762c6aa478', 'stock.packing.delete', 'Supprimer une packing list', 'stock', '2026-10-23 09:42:47.189726+00'),
	('f3bee40e-cd18-4b51-b96f-1e731dc157a1', 'stock.packing.create', 'Importer une packing list', 'stock', '2026-10-23 09:42:47.189726+00'),
	('54844a4d-7bc6-4d6e-b14b-ee51c9b9eb2f', 'stock.packing.view', 'Voir les packing lists des arrivages', 'stock', '2026-10-23 09:42:47.189726+00'),
	('27826040-8bcb-47c0-b749-810f7ddedb0a', 'stock.tri.delete', 'Supprimer une fiche de tri / un trieur', 'stock', '2026-10-23 09:42:48.199485+00'),
	('3ef639b9-ec76-4bab-b78a-5f54cfe285a9', 'stock.tri.update', 'Modifier une fiche de tri / un trieur', 'stock', '2026-10-23 09:42:48.199485+00'),
	('4914feff-71ad-4d53-a60e-e61e659dc415', 'stock.tri.create', 'Saisir une fiche de tri / ajouter un trieur', 'stock', '2026-10-23 09:42:48.199485+00'),
	('27917283-d846-491c-ab98-130060535539', 'stock.tri.view', 'Voir la salle de tri', 'stock', '2026-10-23 09:42:48.199485+00'),
	('e84a3f21-8143-420b-894a-9caab71e9d2e', 'stock.commandes.view', 'Voir la salle de commande', 'stock', '2026-10-23 09:42:48.276521+00'),
	('b4cea113-798a-473a-8bb2-9da77cca4df7', 'stock.commandes.boutique', 'Passer les commandes d''une boutique et réceptionner ses cartons', 'stock', '2026-10-23 09:42:48.276521+00'),
	('55e43b5c-4a88-4ee3-a9de-a59b3959880d', 'stock.commandes.manage', 'Préparer et expédier les commandes boutiques, gérer les boutiques', 'stock', '2026-10-23 09:42:48.276521+00'),
	('d265a4c5-7b51-4d88-af0a-18e39eb61cb0', 'magasin.update', 'Modifier un magasin, son plan ou ses emplacements', 'magasin', '2026-10-23 09:42:48.429265+00'),
	('90617631-51ee-49ea-abf3-de184b540451', 'magasin.delete', 'Supprimer un magasin, une zone ou un emplacement', 'magasin', '2026-10-23 09:42:48.429265+00'),
	('33d74d87-6104-4ef3-a83d-2ac19eeae05e', 'magasin.create', 'Créer un magasin, une zone ou un emplacement', 'magasin', '2026-10-23 09:42:48.429265+00'),
	('36ee55b3-5c46-48e8-90e1-af7c25e3c9e4', 'magasin.view', 'Voir les magasins et leurs plans', 'magasin', '2026-10-23 09:42:48.429265+00'),
	('4ae7a394-1f33-4589-bd4a-2bf72f567664', 'newsletter_clients.send', 'Envoyer la newsletter clients', 'crm', '2026-10-23 09:42:49.035975+00'),
	('1cea4fe3-7f9e-4c7d-82b7-c6e2528576e1', 'stock.arrivage.view', 'Voir le tableau des arrivages', 'stock', '2026-10-23 09:42:50.248449+00'),
	('02781781-9d8b-4d12-b16b-d135f25667c4', 'stock.arrivage.delete', 'Supprimer un arrivage', 'stock', '2026-10-23 09:42:50.248449+00'),
	('c298a8ac-dd9e-46a7-b2fa-da2659357045', 'stock.arrivage.create', 'Créer un arrivage', 'stock', '2026-10-23 09:42:50.248449+00'),
	('a2944320-931a-411a-b66d-6303aab3f7b6', 'stock.arrivage.update', 'Modifier un arrivage', 'stock', '2026-10-23 09:42:50.248449+00'),
	('b5e89be5-8b54-4a25-ad5f-2e747d204919', 'crm.monopoly', 'Accéder à La Tournée (gamification setters)', 'crm', '2026-10-23 09:42:59.097606+00');

INSERT INTO "public"."roles_permissions" ("role_id", "permission_id") VALUES
	('d7a6bfba-c4b9-49f8-aad8-f43259badff5', '245c4614-6bc9-4a61-b07b-3ce125cb4a10'),
	('ae166448-4adf-4d2d-9fae-dfa27ceb1a87', '245c4614-6bc9-4a61-b07b-3ce125cb4a10');

SET session_replication_role = origin;
