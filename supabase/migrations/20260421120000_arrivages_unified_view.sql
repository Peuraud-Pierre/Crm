-- ============================================================
-- Option A — Unification arrivages via vue
--
-- `factures` et `arrivees_departs` sont alimentées par arrivage-api
-- (parsing de deux Excel distincts). Les deux décrivent le même
-- container → on les joint via container_no ↔ conteneur_no.
--
-- Une table `arrivage_state` stocke l'état opérationnel saisi dans
-- l'app (statut, notes, dates de réception, lien livraison) — ces
-- données ne viennent d'aucun Excel.
--
-- La vue `v_arrivages` expose une ligne par container, consommée
-- par le front comme si c'était une vraie table.
-- ============================================================

-- ─── État opérationnel (saisi dans l'app) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.arrivage_state (
    container_no    TEXT PRIMARY KEY,
    status          TEXT NOT NULL DEFAULT 'planifié'
                      CHECK (status IN ('planifié','en_transit','déchargé','reçu','annulé')),
    fournisseur_id  UUID,
    docked_at       TIMESTAMPTZ,
    received_date   TIMESTAMPTZ,
    notes           TEXT,
    livraison_id    UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arrivage_state_status
    ON public.arrivage_state(status);
CREATE INDEX IF NOT EXISTS idx_arrivage_state_fournisseur
    ON public.arrivage_state(fournisseur_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_arrivage_state_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_arrivage_state_updated_at ON public.arrivage_state;
CREATE TRIGGER trg_arrivage_state_updated_at
    BEFORE UPDATE ON public.arrivage_state
    FOR EACH ROW
    EXECUTE FUNCTION public.set_arrivage_state_updated_at();

-- ─── Vue unifiée ────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_arrivages AS
SELECT
    COALESCE(f.container_no, ad.conteneur_no) AS container_no,

    -- IDs source (utiles pour join sur items, edition, debug)
    f.id  AS facture_id,
    ad.id AS arrivee_depart_id,

    -- Commercial (factures)
    f.invoice_no,
    f.date                  AS invoice_date,
    f.invoice_total,
    f.shipping_charges,
    f.total_invoice_value,
    f.total_invoice_usd,
    f.convert_rate_thb_usd,
    f.location,

    -- Transport (arrivees_departs)
    ad.pays                   AS origin_country,
    ad.provenance             AS origin_location,
    ad.mode                   AS transport_mode,
    ad.date_depart            AS departure_date,
    ad.date_arrivee_le_havre  AS port_arrival_date,
    ad.prev_dechargement_jour,
    ad.prev_dechargement_date,
    ad.prev_dechargement_heure,
    ad.poids                  AS total_weight_kg,
    ad.quantite               AS total_qty,

    -- État opérationnel (arrivage_state, avec fallback)
    COALESCE(s.status, 'planifié') AS status,
    s.fournisseur_id,
    s.docked_at,
    s.received_date,
    s.notes,
    s.livraison_id,

    -- Timestamps
    COALESCE(f.created_at, ad.created_at, s.created_at) AS created_at,
    GREATEST(
        COALESCE(f.created_at, 'epoch'::timestamptz),
        COALESCE(ad.updated_at, 'epoch'::timestamptz),
        COALESCE(s.updated_at, 'epoch'::timestamptz)
    ) AS updated_at
FROM public.factures f
FULL OUTER JOIN public.arrivees_departs ad
    ON f.container_no = ad.conteneur_no
LEFT JOIN public.arrivage_state s
    ON s.container_no = COALESCE(f.container_no, ad.conteneur_no);

COMMENT ON VIEW public.v_arrivages IS
    'Vue unifiée des arrivages : jointure factures + arrivees_departs + arrivage_state sur container_no.';

-- ─── RLS (à ajuster selon vos policies globales) ────────────────────────
-- On active RLS sur arrivage_state, policy permissive par défaut à adapter.
ALTER TABLE public.arrivage_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arrivage_state_select" ON public.arrivage_state;
CREATE POLICY "arrivage_state_select"
    ON public.arrivage_state FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "arrivage_state_write" ON public.arrivage_state;
CREATE POLICY "arrivage_state_write"
    ON public.arrivage_state FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
