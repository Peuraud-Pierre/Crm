-- ============================================================
-- Bibliothèque de réponses — tables de données
--
-- Crée trois tables pour stocker le contenu bilingue (FR/EN) :
--   • bibliotheque_thematiques  — catégories de Q&R avec brief
--   • bibliotheque_questions_reponses          — paires question/réponse
--   • bibliotheque_format_reponses — versions formatées par canal (Email, DM, WhatsApp)
--
-- RLS activé. Les politiques actuelles accordent l'accès à tous les
-- utilisateurs authentifiés. À affiner selon le modèle de rôles
-- de l'application (roles_permissions / services_permissions).
-- ============================================================

BEGIN;

-- ── Fonction updated_at (idempotente) ──────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── bibliotheque_thematiques ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bibliotheque_thematiques (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    label      TEXT        NOT NULL,
    label_en   TEXT        NOT NULL DEFAULT '',
    brief      TEXT        NOT NULL DEFAULT '',
    brief_en   TEXT        NOT NULL DEFAULT '',
    position   SMALLINT    NOT NULL DEFAULT 0,
    created_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bibliotheque_thematiques_position_idx
    ON bibliotheque_thematiques (position ASC, created_at ASC);

DROP TRIGGER IF EXISTS set_bibliotheque_thematiques_updated_at
    ON bibliotheque_thematiques;
CREATE TRIGGER set_bibliotheque_thematiques_updated_at
    BEFORE UPDATE ON bibliotheque_thematiques
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── bibliotheque_questions_reponses ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS bibliotheque_questions_reponses (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    thematique_id UUID        NOT NULL REFERENCES bibliotheque_thematiques(id) ON DELETE CASCADE,
    question      TEXT        NOT NULL,
    question_en   TEXT        NOT NULL DEFAULT '',
    reponse       TEXT        NOT NULL,
    reponse_en    TEXT        NOT NULL DEFAULT '',
    position      SMALLINT    NOT NULL DEFAULT 0,
    created_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bibliotheque_questions_reponses_thematique_id_idx
    ON bibliotheque_questions_reponses (thematique_id, position ASC);

DROP TRIGGER IF EXISTS set_bibliotheque_questions_reponses_updated_at
    ON bibliotheque_questions_reponses;
CREATE TRIGGER set_bibliotheque_questions_reponses_updated_at
    BEFORE UPDATE ON bibliotheque_questions_reponses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── bibliotheque_format_reponses ───────────────────────────────────────────
-- Une seule ligne par Q&R (UNIQUE quest_rep_id). On utilise UPSERT côté application.

CREATE TABLE IF NOT EXISTS bibliotheque_format_reponses (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    quest_rep_id   UUID        NOT NULL REFERENCES bibliotheque_questions_reponses(id) ON DELETE CASCADE,
    email          TEXT        NOT NULL DEFAULT '',
    instagram      TEXT        NOT NULL DEFAULT '',
    whatsapp       TEXT        NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bibliotheque_format_reponses_quest_rep_id_key UNIQUE (quest_rep_id)
);

DROP TRIGGER IF EXISTS set_bibliotheque_format_reponses_updated_at
    ON bibliotheque_format_reponses;
CREATE TRIGGER set_bibliotheque_format_reponses_updated_at
    BEFORE UPDATE ON bibliotheque_format_reponses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE bibliotheque_thematiques             ENABLE ROW LEVEL SECURITY;
ALTER TABLE bibliotheque_questions_reponses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bibliotheque_format_reponses         ENABLE ROW LEVEL SECURITY;

-- Thématiques : accès total aux utilisateurs authentifiés
CREATE POLICY "Authenticated users — thematiques"
    ON bibliotheque_thematiques FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Q&R : accès total aux utilisateurs authentifiés
CREATE POLICY "Authenticated users — qas"
    ON bibliotheque_questions_reponses FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Formats : accès total aux utilisateurs authentifiés
CREATE POLICY "Authenticated users — format reponses"
    ON bibliotheque_format_reponses FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

COMMIT;
