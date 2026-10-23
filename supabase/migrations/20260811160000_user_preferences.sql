-- ============================================================
-- Préférences utilisateur — public.user_preferences
--
-- Une ligne par utilisateur (PK = user_id), créée à la volée par
-- l'application au premier enregistrement (upsert). L'absence de ligne
-- est un état valide : le front retombe alors sur les valeurs par
-- défaut, identiques aux DEFAULT déclarés ici.
--
-- Colonnes :
--   - theme          : 'light' | 'dark' | 'system' — remplace la
--                      persistance localStorage ("darkMode") pour que le
--                      thème suive l'utilisateur d'un appareil à l'autre.
--   - push_enabled   : consentement applicatif aux notifications push.
--                      Distinct de la permission navigateur (qui reste la
--                      décision finale) et de la présence d'une ligne dans
--                      public.push_subscriptions (qui est par appareil).
--   - notify_*       : types de notifications in-app souhaités. Les trois
--                      valeurs couvrent public.notification.type
--                      ('ticket' | 'message' | 'system').
--
-- Sécurité (RLS) : strictement personnel — auth.uid() = user_id pour les
-- quatre opérations. Aucune permission applicative n'entre en jeu : un
-- utilisateur ne lit et n'écrit que ses propres préférences.
--
-- Idempotent : CREATE TABLE IF NOT EXISTS / DROP POLICY IF EXISTS.
-- ============================================================

-- ------------------------------------------------------------
-- Table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id        uuid PRIMARY KEY
                       REFERENCES auth.users (id) ON DELETE CASCADE,
    theme          text NOT NULL DEFAULT 'system'
                       CHECK (theme IN ('light', 'dark', 'system')),
    push_enabled   boolean NOT NULL DEFAULT true,
    notify_ticket  boolean NOT NULL DEFAULT true,
    notify_message boolean NOT NULL DEFAULT true,
    notify_system  boolean NOT NULL DEFAULT true,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- updated_at auto sur UPDATE
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_preferences_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_preferences_set_updated_at ON public.user_preferences;
CREATE TRIGGER user_preferences_set_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW EXECUTE FUNCTION public.user_preferences_set_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can delete their own preferences" ON public.user_preferences;

CREATE POLICY "Users can view their own preferences"
    ON public.user_preferences FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
    ON public.user_preferences FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
    ON public.user_preferences FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences"
    ON public.user_preferences FOR DELETE
    USING (auth.uid() = user_id);
