-- ============================================================
-- Arrivage activity : historique + notifications temps-réel
--
-- Ajoute un trigger AFTER INSERT/UPDATE/DELETE sur arrivage_manuel
-- qui :
--   1. Insère dans activity_log  (onglet History du stock)
--   2. Insère dans notification  (cloche temps-réel)
--      → user_id = service_id de l'acteur pour cibler tous les
--        membres du service via le canal realtime service-level
-- ============================================================


-- ─── Trigger function ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_arrivage_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_service_id UUID;
    v_label      TEXT;
    v_desc       TEXT;
    v_action     TEXT;
BEGIN
    -- Résout le service de l'utilisateur connecté (peut être NULL si non authentifié)
    SELECT service_id INTO v_service_id
    FROM public.profiles
    WHERE user_id = auth.uid()
    LIMIT 1;

    -- ── INSERT ──────────────────────────────────────────────────────────────
    IF TG_OP = 'INSERT' THEN
        v_label  := NEW.container_no;
        v_desc   := 'Arrivage créé : ' || NEW.container_no;
        v_action := 'create';

        INSERT INTO public.activity_log(
            user_id, entity_type, entity_id, entity_label,
            action, description, changes
        ) VALUES (
            auth.uid(), 'arrivage', NEW.id::TEXT, v_label,
            v_action, v_desc,
            jsonb_build_object(
                'status',         NEW.status,
                'transport_mode', NEW.transport_mode,
                'fournisseur_id', NEW.fournisseur_id
            )
        );

    -- ── UPDATE ──────────────────────────────────────────────────────────────
    ELSIF TG_OP = 'UPDATE' THEN
        v_label  := NEW.container_no;
        v_action := 'update';
        v_desc   := CASE
            WHEN OLD.status IS DISTINCT FROM NEW.status
            THEN 'Statut modifié : ' || NEW.container_no
                 || ' (' || COALESCE(OLD.status, '?') || ' → ' || NEW.status || ')'
            ELSE 'Arrivage mis à jour : ' || NEW.container_no
        END;

        INSERT INTO public.activity_log(
            user_id, entity_type, entity_id, entity_label,
            action, description, changes
        ) VALUES (
            auth.uid(), 'arrivage', NEW.id::TEXT, v_label,
            v_action, v_desc,
            jsonb_build_object(
                'status',                jsonb_build_object('before', OLD.status,                'after', NEW.status),
                'transport_mode',        jsonb_build_object('before', OLD.transport_mode,        'after', NEW.transport_mode),
                'prev_dechargement_at',  jsonb_build_object('before', OLD.prev_dechargement_at,  'after', NEW.prev_dechargement_at),
                'docked_at',             jsonb_build_object('before', OLD.docked_at,             'after', NEW.docked_at),
                'received_date',         jsonb_build_object('before', OLD.received_date,         'after', NEW.received_date),
                'total_weight_kg',       jsonb_build_object('before', OLD.total_weight_kg,       'after', NEW.total_weight_kg),
                'total_qty',             jsonb_build_object('before', OLD.total_qty,             'after', NEW.total_qty)
            )
        );

    -- ── DELETE ──────────────────────────────────────────────────────────────
    ELSIF TG_OP = 'DELETE' THEN
        v_label  := OLD.container_no;
        v_action := 'delete';
        v_desc   := 'Arrivage supprimé : ' || OLD.container_no;

        INSERT INTO public.activity_log(
            user_id, entity_type, entity_id, entity_label,
            action, description
        ) VALUES (
            auth.uid(), 'arrivage', OLD.id::TEXT, v_label,
            v_action, v_desc
        );
    END IF;

    -- ── Notification service-level ───────────────────────────────────────────
    -- Un seul enregistrement par action avec user_id = service_id de l'acteur.
    -- Tous les membres du service reçoivent la notification via le canal realtime
    -- `notifications-service-<service_id>` (voir useNotifications.tsx).
    IF v_service_id IS NOT NULL THEN
        INSERT INTO public.notification(user_id, type, title, url)
        VALUES (v_service_id, 'system', v_desc, '/stock');
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;


-- ─── Trigger ─────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS arrivage_activity_trigger ON public.arrivage_manuel;
CREATE TRIGGER arrivage_activity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.arrivage_manuel
    FOR EACH ROW EXECUTE FUNCTION public.log_arrivage_activity();
