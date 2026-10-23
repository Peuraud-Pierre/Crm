-- ============================================================
-- Table arrivage_manuel — saisie manuelle des arrivages
-- (FlowLimited / conduite du changement)
--
-- Table autonome, découplée de l'architecture 3-tables
-- (factures / arrivees_departs / arrivage_state).
-- Regroupe dans un seul enregistrement toutes les informations
-- d'un arrivage saisi manuellement (sans import Excel).
-- ============================================================

CREATE TABLE public.arrivage_manuel (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    container_no            TEXT NOT NULL,
    conteneur_no_raw        TEXT,
    fournisseur_id          UUID,
    status                  TEXT NOT NULL DEFAULT 'planifié'
                              CHECK (status IN ('planifié','en_transit','déchargé','reçu','annulé')),
    transport_mode          TEXT,
    departure_date          DATE,
    port_arrival_date       DATE,
    total_weight_kg         NUMERIC(12,2),
    total_qty               INTEGER,
    prev_dechargement_date  DATE,
    prev_dechargement_heure TEXT,
    prev_dechargement_jour  TEXT,
    docked_at               DATE,
    received_date           DATE,
    notes                   TEXT,
    invoice_no              TEXT,
    invoice_date            DATE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at (réutilise la fonction si elle existe déjà)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS arrivage_manuel_updated_at ON public.arrivage_manuel;
CREATE TRIGGER arrivage_manuel_updated_at
    BEFORE UPDATE ON public.arrivage_manuel
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Même politique que arrivage_state : permission stock.view + session AAL2.

ALTER TABLE public.arrivage_manuel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arrivage_manuel_select" ON public.arrivage_manuel
    FOR SELECT
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

CREATE POLICY "arrivage_manuel_insert" ON public.arrivage_manuel
    FOR INSERT
    WITH CHECK (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

CREATE POLICY "arrivage_manuel_update" ON public.arrivage_manuel
    FOR UPDATE
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    )
    WITH CHECK (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );

CREATE POLICY "arrivage_manuel_delete" ON public.arrivage_manuel
    FOR DELETE
    USING (
        has_permission('stock.view'::text)
        AND (SELECT auth_session_is_aal2() AS auth_session_is_aal2)
    );
