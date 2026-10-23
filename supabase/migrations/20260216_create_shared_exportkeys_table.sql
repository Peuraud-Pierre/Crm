-- Table pour stocker les exportKeys PAKE chiffrées
-- Permet le multi-device avec le même PIN
CREATE TABLE IF NOT EXISTS cryptedmessage_shared_exportkeys (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    encrypted_export_key JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les recherches par user_id
CREATE INDEX IF NOT EXISTS idx_shared_exportkeys_user_id
ON cryptedmessage_shared_exportkeys(user_id);

-- RLS: Chaque utilisateur peut seulement accéder à sa propre exportKey
ALTER TABLE cryptedmessage_shared_exportkeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own shared exportkey"
ON cryptedmessage_shared_exportkeys
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shared exportkey"
ON cryptedmessage_shared_exportkeys
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shared exportkey"
ON cryptedmessage_shared_exportkeys
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shared exportkey"
ON cryptedmessage_shared_exportkeys
FOR DELETE
USING (auth.uid() = user_id);
