-- Migration: Outlook Calendar Synchronization
-- Date: 2026-02-04
-- Description: Crée les tables nécessaires pour la synchronisation des calendriers Outlook

-- 1. Table des connexions OAuth utilisateur
CREATE TABLE IF NOT EXISTS outlook_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    email VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, email)
);

-- 2. Table de mapping des événements (bidirectionnel)
CREATE TABLE IF NOT EXISTS calendar_sync_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nokk_project_event_id UUID NOT NULL REFERENCES "Event_calendar"(id) ON DELETE CASCADE,
    outlook_event_id VARCHAR(255) NOT NULL,
    outlook_change_key VARCHAR(255),
    connection_id UUID NOT NULL REFERENCES outlook_connections(id) ON DELETE CASCADE,
    last_synced_at TIMESTAMPTZ,
    nokk_project_updated_at TIMESTAMPTZ,
    outlook_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(nokk_project_event_id, connection_id),
    UNIQUE(outlook_event_id, connection_id)
);

-- 3. Table des logs de synchronisation
CREATE TABLE IF NOT EXISTS calendar_sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES outlook_connections(id) ON DELETE CASCADE,
    sync_type VARCHAR(50),
    status VARCHAR(50),
    events_synced INTEGER DEFAULT 0,
    conflicts_resolved INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table des subscriptions webhooks Microsoft
CREATE TABLE IF NOT EXISTS outlook_webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES outlook_connections(id) ON DELETE CASCADE,
    subscription_id VARCHAR(255) NOT NULL,
    resource VARCHAR(500),
    expires_at TIMESTAMPTZ NOT NULL,
    notification_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(connection_id, subscription_id)
);

-- Création des index pour performance
CREATE INDEX IF NOT EXISTS idx_outlook_connections_user_id ON outlook_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_outlook_connections_active ON outlook_connections(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_calendar_sync_mappings_pa ON calendar_sync_mappings(nokk_project_event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_mappings_outlook ON calendar_sync_mappings(outlook_event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_sync_logs_connection ON calendar_sync_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_outlook_webhook_subs_connection ON outlook_webhook_subscriptions(connection_id);

-- Activation de Row Level Security (RLS)
ALTER TABLE outlook_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlook_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour outlook_connections
CREATE POLICY "Users can view own connections" ON outlook_connections
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connections" ON outlook_connections
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections" ON outlook_connections
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections" ON outlook_connections
    FOR DELETE USING (auth.uid() = user_id);

-- Politiques RLS pour calendar_sync_mappings
CREATE POLICY "Users access own mappings" ON calendar_sync_mappings
    FOR ALL USING (
        connection_id IN (
            SELECT id FROM outlook_connections WHERE user_id = auth.uid()
        )
    );

-- Politiques RLS pour calendar_sync_logs
CREATE POLICY "Users view own logs" ON calendar_sync_logs
    FOR SELECT USING (
        connection_id IN (
            SELECT id FROM outlook_connections WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service can insert logs" ON calendar_sync_logs
    FOR INSERT WITH CHECK (true);

-- Politiques RLS pour outlook_webhook_subscriptions
CREATE POLICY "Users access own subscriptions" ON outlook_webhook_subscriptions
    FOR ALL USING (
        connection_id IN (
            SELECT id FROM outlook_connections WHERE user_id = auth.uid()
        )
    );

-- Fonction trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_outlook_connection_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour outlook_connections
CREATE TRIGGER trigger_outlook_connections_updated_at
    BEFORE UPDATE ON outlook_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_outlook_connection_updated_at();

-- Commentaires sur les tables
COMMENT ON TABLE outlook_connections IS 'Stocke les connexions OAuth des utilisateurs avec Microsoft Outlook';
COMMENT ON TABLE calendar_sync_mappings IS 'Mapping bidirectionnel entre événements Nokk_project et Outlook';
COMMENT ON TABLE calendar_sync_logs IS 'Logs de synchronisation pour débogage et monitoring';
COMMENT ON TABLE outlook_webhook_subscriptions IS 'Subscriptions aux webhooks Microsoft Graph pour sync temps réel';
