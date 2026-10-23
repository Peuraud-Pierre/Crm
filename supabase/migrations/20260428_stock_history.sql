-- ============================================================
-- Historique du stock : activity_log + category_price_history
--
-- activity_log     → journal générique de toutes les mutations
--                    (balle, livraison, catégorie, fournisseur)
-- category_price_history → suivi des changements de prix unitaire
--                          par catégorie (pour le graphique d'évolution)
--
-- Les insertions sont faites via des triggers AFTER sur chaque table
-- métier. auth.uid() est résolu dans le contexte de la session
-- PostgreSQL ouverte par le client Supabase (authentifié).
-- ============================================================


-- ─── Tables ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.activity_log (
    id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at   TIMESTAMPTZ DEFAULT now() NOT NULL,
    user_id      UUID,
    entity_type  TEXT        NOT NULL,   -- 'balle' | 'delivery' | 'category' | 'fournisseur'
    entity_id    TEXT,
    entity_label TEXT,                   -- BIN, DIN, nom...
    action       TEXT        NOT NULL,   -- 'create' | 'update' | 'delete'
    description  TEXT,
    changes      JSONB
);

CREATE TABLE IF NOT EXISTS public.category_price_history (
    id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
    category_id   UUID        REFERENCES public.categories_gestion(id) ON DELETE CASCADE,
    category_name TEXT,
    user_id       UUID,
    old_price     NUMERIC,
    new_price     NUMERIC     NOT NULL
);


-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.activity_log          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_price_history ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs authentifiés peuvent tout lire
CREATE POLICY "auth_read_activity_log"
    ON public.activity_log FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "auth_insert_activity_log"
    ON public.activity_log FOR INSERT
    TO authenticated WITH CHECK (true);

CREATE POLICY "auth_read_price_history"
    ON public.category_price_history FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "auth_insert_price_history"
    ON public.category_price_history FOR INSERT
    TO authenticated WITH CHECK (true);


-- ─── Trigger : balles_gestion ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_balle_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description)
        VALUES (auth.uid(), 'balle', NEW.id::TEXT, NEW.bin, 'create',
                'Balle créée : ' || NEW.bin);

    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description, changes)
        VALUES (auth.uid(), 'balle', NEW.id::TEXT, NEW.bin, 'update',
                'Balle mise à jour : ' || NEW.bin,
                jsonb_build_object(
                    'status',   jsonb_build_object('before', OLD.status,   'after', NEW.status),
                    'location', jsonb_build_object('before', OLD.location, 'after', NEW.location),
                    'packing',  jsonb_build_object('before', OLD.packing,  'after', NEW.packing)
                ));

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description)
        VALUES (auth.uid(), 'balle', OLD.id::TEXT, OLD.bin, 'delete',
                'Balle supprimée : ' || OLD.bin);
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
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description)
        VALUES (auth.uid(), 'delivery', NEW.id::TEXT, NEW.din, 'create',
                'Livraison créée : ' || NEW.din);

    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description)
        VALUES (auth.uid(), 'delivery', NEW.id::TEXT, NEW.din, 'update',
                'Livraison mise à jour : ' || NEW.din);

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description)
        VALUES (auth.uid(), 'delivery', OLD.id::TEXT, OLD.din, 'delete',
                'Livraison supprimée : ' || OLD.din);
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
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description)
        VALUES (auth.uid(), 'category', NEW.id::TEXT, NEW.name, 'create',
                'Catégorie créée : ' || NEW.name);

    ELSIF TG_OP = 'UPDATE' THEN
        -- Log price change separately for the chart
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
                jsonb_build_object(
                    'unit_price', jsonb_build_object('before', OLD.unit_price, 'after', NEW.unit_price)
                ));

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description)
        VALUES (auth.uid(), 'category', OLD.id::TEXT, OLD.name, 'delete',
                'Catégorie supprimée : ' || OLD.name);
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
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description)
        VALUES (auth.uid(), 'fournisseur', NEW.id::TEXT, NEW.name, 'create',
                'Fournisseur créé : ' || NEW.name);

    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description)
        VALUES (auth.uid(), 'fournisseur', NEW.id::TEXT, NEW.name, 'update',
                'Fournisseur mis à jour : ' || NEW.name);

    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.activity_log(user_id, entity_type, entity_id, entity_label, action, description)
        VALUES (auth.uid(), 'fournisseur', OLD.id::TEXT, OLD.name, 'delete',
                'Fournisseur supprimé : ' || OLD.name);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS fournisseur_activity_trigger ON public.fournisseur_gestion;
CREATE TRIGGER fournisseur_activity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.fournisseur_gestion
    FOR EACH ROW EXECUTE FUNCTION public.log_fournisseur_activity();


-- ─── Realtime ─────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.category_price_history;
