-- ============================================================
-- Bibliothèque — Brief global unique
--
-- Supprime les colonnes brief/brief_en de bibliotheque_thematiques
-- et crée une table dédiée bibliotheque_brief à ligne unique.
--
-- Idempotent (IF EXISTS / ON CONFLICT DO NOTHING).
-- ============================================================

BEGIN;

-- ── 1. Supprimer brief et brief_en des thématiques ────────────────────────────

ALTER TABLE bibliotheque_thematiques DROP COLUMN IF EXISTS brief;
ALTER TABLE bibliotheque_thematiques DROP COLUMN IF EXISTS brief_en;

-- ── 2. Créer la table du brief global ─────────────────────────────────────────
-- CHECK (id = 1) garantit qu'une seule ligne peut exister physiquement.

CREATE TABLE IF NOT EXISTS bibliotheque_brief (
    id         SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    brief      TEXT        NOT NULL DEFAULT '',
    brief_en   TEXT        NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Insérer la ligne par défaut ────────────────────────────────────────────

INSERT INTO bibliotheque_brief (id, brief, brief_en)
VALUES (1, '', '')
ON CONFLICT (id) DO NOTHING;

-- ── 4. Trigger updated_at ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_bibliotheque_brief_updated_at ON bibliotheque_brief;
CREATE TRIGGER set_bibliotheque_brief_updated_at
    BEFORE UPDATE ON bibliotheque_brief
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 5. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE bibliotheque_brief ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users — brief"
    ON bibliotheque_brief FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ── 6. Grants ────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON bibliotheque_brief TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON bibliotheque_brief TO anon;

COMMIT;
