-- Fix RLS app_logs : Super Admin peut lire TOUS les logs
-- Le problème : la policy précédente vérifie profiles.role mais
-- auth.uid() dans une policy RLS SELECT ne peut pas faire de sous-requête
-- sur la même session avec RLS activé sur profiles → résultat vide

-- Supprimer les policies existantes pour repartir proprement
DROP POLICY IF EXISTS "Super Admin can read all logs" ON public.app_logs;
DROP POLICY IF EXISTS "Super Admin can delete logs" ON public.app_logs;
DROP POLICY IF EXISTS "Users can insert own logs" ON public.app_logs;

-- Réactiver RLS
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;

-- INSERT : tout utilisateur authentifié peut insérer ses propres logs
CREATE POLICY "app_logs_insert_own"
    ON public.app_logs FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- SELECT : l'utilisateur voit ses propres logs OU s'il est Super Admin
CREATE POLICY "app_logs_select"
    ON public.app_logs FOR SELECT
    TO authenticated
    USING (
        auth.uid() = user_id
        OR
        (
            SELECT role FROM public.profiles
            WHERE id = auth.uid()
            LIMIT 1
        ) = 'Super Admin'
    );

-- DELETE : Super Admin uniquement
CREATE POLICY "app_logs_delete"
    ON public.app_logs FOR DELETE
    TO authenticated
    USING (
        (
            SELECT role FROM public.profiles
            WHERE id = auth.uid()
            LIMIT 1
        ) = 'Super Admin'
    );
