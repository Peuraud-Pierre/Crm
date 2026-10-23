-- Newsletter subscriptions
-- Each user subscribes once; visible_columns controls which arrivage columns appear in their email.

CREATE TABLE newsletter_subscriptions (
    user_id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email           TEXT        NOT NULL,
    full_name       TEXT,
    visible_columns JSONB       NOT NULL DEFAULT '["container_no","fournisseur_name","status","transport_mode","departure_date","port_arrival_date","prev_dechargement_at","total_weight_kg","total_qty","invoice_date"]',
    active          BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

-- Each user can manage only their own subscription
CREATE POLICY "user_owns_own_subscription"
    ON newsletter_subscriptions
    FOR ALL
    USING (auth.uid() = user_id);

-- Admin / users with users.view can read all subscriptions (for the Go service admin endpoint)
CREATE POLICY "admin_can_read_all_subscriptions"
    ON newsletter_subscriptions
    FOR SELECT
    USING (has_permission('users.view'));

-- service_role bypasses RLS for the Go service (direct pgx connection, no JWT context)
CREATE POLICY "service_role_subscriptions"
    ON newsletter_subscriptions FOR ALL TO service_role
    USING (true) WITH CHECK (true);
