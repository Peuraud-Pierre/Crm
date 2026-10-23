-- ============================================================
-- Bibliothèque de réponses — restriction de bibliotheque.manage au service Tech
--
-- Audit (2026-07-20) : bibliotheque.manage était accordée à TOUS les services
-- (Tech, Pickers, Commercial, Compta, Informatique, Marketing, Direction,
-- Salle de Tri, RH, Retail, Accueil) via services_permissions — hérité de la
-- migration 20260715130000, qui avait délibérément copié le périmètre (large)
-- de bibliotheque.view en attendant une restriction ultérieure via l'admin
-- des rôles. roles_permissions et users_permissions ne portent aucun octroi
-- pour ce code (vérifié en base avant cette migration).
--
-- Décision : seul le service 'Tech' peut créer/modifier/supprimer le contenu
-- de la Bibliothèque (thématiques, questions/réponses, formats de réponse,
-- médias du bucket Storage 'bibliotheque'). SELECT reste inchangé (ouvert à
-- tout authentifié, gaté par bibliotheque.view).
--
-- Aucune policy RLS à modifier : elles appellent déjà
-- public.user_has_permission(auth.uid(), 'bibliotheque.manage'), qui lit
-- roles_permissions / services_permissions / users_permissions. Cette
-- migration ne touche que les données d'octroi (services_permissions).
--
-- Idempotent : ré-exécutable sans effet une fois le nettoyage fait.
-- ============================================================

BEGIN;

DELETE FROM public.services_permissions sp
USING public.permissions p, public.services s
WHERE sp.permission_id = p.id
  AND sp.service_id = s.id
  AND p.code = 'bibliotheque.manage'
  AND s.nom <> 'Tech';

COMMIT;
