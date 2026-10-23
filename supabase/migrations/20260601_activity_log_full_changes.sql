-- ============================================================
-- activity_log : changes systématiques sur toutes les entités
--
-- Ajoute un helper jsonb_diff pour capturer automatiquement
-- tous les champs modifiés (diff générique avant/après).
-- Met à jour les 5 triggers pour peupler changes sur :
--   INSERT → snapshot des champs descriptifs
--   UPDATE → diff automatique de tous les champs modifiés
--   DELETE → snapshot des champs descriptifs
-- ============================================================


-- ─── Helper : diff JSONB générique ───────────────────────────────────────────
-- Retourne un objet {champ: {before, after}} pour les champs qui ont changé.
-- Les clés système (id, created_at, updated_at) sont exclues par défaut.

CREATE OR REPLACE FUNCTION public.jsonb_diff(
    old_row      JSONB,
    new_row      JSONB,
    exclude_keys TEXT[] DEFAULT ARRAY['id','created_at','updated_at']
)
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
    SELECT COALESCE(
        (SELECT jsonb_object_agg(k, jsonb_build_object('before', old_row->k, 'after', new_row->k))
         FROM   jsonb_object_keys(old_row - exclude_keys) AS k
         WHERE  old_row->k IS DISTINCT FROM new_row->k),
        '{}'::JSONB
    )
$$;


-- ─── Trigger : balles_gestion ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_balle_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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

DROP TRIGGER IF EXISTS balle_activity_trigger ON public.balles_gestion;
CREATE TRIGGER balle_activity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.balles_gestion
    FOR EACH ROW EXECUTE FUNCTION public.log_balle_activity();


-- ─── Trigger : deliveries_gestion ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_delivery_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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

DROP TRIGGER IF EXISTS delivery_activity_trigger ON public.deliveries_gestion;
CREATE TRIGGER delivery_activity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.deliveries_gestion
    FOR EACH ROW EXECUTE FUNCTION public.log_delivery_activity();


-- ─── Trigger : categories_gestion ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_category_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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

DROP TRIGGER IF EXISTS category_activity_trigger ON public.categories_gestion;
CREATE TRIGGER category_activity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.categories_gestion
    FOR EACH ROW EXECUTE FUNCTION public.log_category_activity();


-- ─── Trigger : fournisseur_gestion ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_fournisseur_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
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

DROP TRIGGER IF EXISTS fournisseur_activity_trigger ON public.fournisseur_gestion;
CREATE TRIGGER fournisseur_activity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.fournisseur_gestion
    FOR EACH ROW EXECUTE FUNCTION public.log_fournisseur_activity();


-- ─── Trigger : arrivage_manuel ───────────────────────────────────────────────
-- Remplace le trigger existant :
--   INSERT → snapshot des champs descriptifs (inchangé)
--   UPDATE → diff automatique complet (remplace la liste hardcodée)
--   DELETE → snapshot (nouveau)

CREATE OR REPLACE FUNCTION public.log_arrivage_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_service_id UUID;
    v_label      TEXT;
    v_desc       TEXT;
    v_action     TEXT;
BEGIN
    SELECT service_id INTO v_service_id
    FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

    IF TG_OP = 'INSERT' THEN
        v_label  := NEW.container_no;
        v_desc   := 'Arrivage créé : ' || NEW.container_no;
        v_action := 'create';

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
        VALUES (v_service_id, 'system', v_desc, '/stock');
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS arrivage_activity_trigger ON public.arrivage_manuel;
CREATE TRIGGER arrivage_activity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.arrivage_manuel
    FOR EACH ROW EXECUTE FUNCTION public.log_arrivage_activity();
