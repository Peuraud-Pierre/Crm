-- Synchronise public.profiles.last_login avec auth.users.last_sign_in_at.
--
-- Contexte : la colonne profiles.last_login n'était écrite qu'à l'INSERT (seed)
-- et par aucun mécanisme à la connexion → l'UI admin affichait toujours
-- « Jamais connecté ». Supabase met pourtant déjà à jour
-- auth.users.last_sign_in_at à chaque connexion : on recopie cette valeur
-- (source de vérité) dans profiles via un trigger, comme handle_new_user le fait
-- déjà pour la création de compte.

-- Fonction de synchronisation. SECURITY DEFINER : le trigger s'exécute avec les
-- droits du propriétaire (pas de dépendance aux policies RLS de l'utilisateur).
CREATE OR REPLACE FUNCTION public.sync_last_login()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET last_login = NEW.last_sign_in_at
   WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$;

-- Se déclenche uniquement quand last_sign_in_at change, c.-à-d. à chaque
-- connexion effective — pas sur les autres updates d'auth.users.
DROP TRIGGER IF EXISTS on_auth_user_signin ON auth.users;
CREATE TRIGGER on_auth_user_signin
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at)
  EXECUTE FUNCTION public.sync_last_login();

-- Backfill : renseigne immédiatement les connexions déjà enregistrées par
-- Supabase, pour que les utilisateurs existants n'apparaissent pas à tort
-- comme « Jamais connecté ».
UPDATE public.profiles p
   SET last_login = u.last_sign_in_at
  FROM auth.users u
 WHERE u.id = p.user_id
   AND u.last_sign_in_at IS NOT NULL;
