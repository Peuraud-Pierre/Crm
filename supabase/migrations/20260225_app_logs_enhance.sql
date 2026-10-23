-- Amélioration de la table app_logs pour la console d'erreurs SuperAdmin
-- Ajout colonnes : url, stack, session_id, browser, user_email

ALTER TABLE public.app_logs
    ADD COLUMN IF NOT EXISTS url TEXT,
    ADD COLUMN IF NOT EXISTS stack TEXT,
    ADD COLUMN IF NOT EXISTS session_id TEXT,
    ADD COLUMN IF NOT EXISTS browser TEXT,
    ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Index pour accélérer les requêtes de la console (filtre par level + date)
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON public.app_logs (level);
CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON public.app_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_user_id ON public.app_logs (user_id);

-- RLS : seuls les Super Admin peuvent lire tous les logs
-- Les utilisateurs normaux peuvent insérer leurs propres logs
DO $$
BEGIN
    -- Politique d'écriture (tout utilisateur authentifié peut insérer ses propres logs)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'app_logs' AND policyname = 'Users can insert own logs'
    ) THEN
        CREATE POLICY "Users can insert own logs"
            ON public.app_logs FOR INSERT
            TO authenticated
            WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Politique de lecture (Super Admin uniquement)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'app_logs' AND policyname = 'Super Admin can read all logs'
    ) THEN
        CREATE POLICY "Super Admin can read all logs"
            ON public.app_logs FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'Super Admin'
                )
            );
    END IF;

    -- Politique de suppression (Super Admin uniquement)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'app_logs' AND policyname = 'Super Admin can delete logs'
    ) THEN
        CREATE POLICY "Super Admin can delete logs"
            ON public.app_logs FOR DELETE
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.role = 'Super Admin'
                )
            );
    END IF;
END $$;

-- Activer RLS si pas encore fait
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;
