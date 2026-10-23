CREATE TABLE newsletter_invitation_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT NOT NULL UNIQUE,
    label       TEXT,
    created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    used_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE newsletter_invitation_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "newsletter_admin_all_codes"
    ON newsletter_invitation_codes FOR ALL
    USING (has_permission('stock.arrivage.newsletter.admin'));

-- service_role bypasses RLS for the Go service (direct pgx connection, no JWT context)
CREATE POLICY "service_role_invitation_codes"
    ON newsletter_invitation_codes FOR ALL TO service_role
    USING (true) WITH CHECK (true);
