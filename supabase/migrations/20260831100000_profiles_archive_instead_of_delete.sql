-- ============================================================
-- Archivage des profils au lieu de suppression
--
-- 49 tables référencent profiles(user_id) — Client_activite.owner,
-- Devis.by, Tache_crm.owner, etc. Un DELETE sur profiles échouait donc
-- sur la première FK rencontrée, et un ON DELETE SET NULL table par
-- table aurait effacé la trace de l'auteur (les jointures
-- `owner:profiles!owner(full_name)` n'auraient plus rien à afficher).
--
-- On garde la ligne profiles comme stub historique : le compte auth est
-- bien détruit côté backend Go (plus aucune connexion possible), seul le
-- profil survit pour que les journaux d'activité restent lisibles.
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS archived_at timestamptz;

COMMENT ON COLUMN public.profiles.archived_at IS
    'Non NULL = utilisateur supprimé (compte auth détruit). Le profil est '
    'conservé pour la traçabilité ; les listes applicatives filtrent sur IS NULL.';

-- Les listes d'utilisateurs filtrent toutes sur archived_at IS NULL.
CREATE INDEX IF NOT EXISTS profiles_archived_at_idx
    ON public.profiles (archived_at)
    WHERE archived_at IS NULL;

-- ─── Découplage de auth.users ────────────────────────────────────────────────
-- Le stub archivé garde son user_id (c'est la clé de jointure des 49 FK), mais
-- le compte auth correspondant est bien détruit par le backend Go. La FK
-- profiles.user_id → auth.users(id) faisait donc échouer la suppression du
-- compte côté GoTrue (500 « Database error deleting user »).
--
-- ON DELETE SET NULL est impossible : user_id est NOT NULL et sert de cible aux
-- 49 FK métier. On retire la contrainte — l'intégrité du lien reste garantie à
-- la création par UpsertProfile (admin_repository.go), seul chemin d'écriture.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
