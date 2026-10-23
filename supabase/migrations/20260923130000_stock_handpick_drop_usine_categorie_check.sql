-- ============================================================
-- Stock handpick — usine et catégorie deviennent indépendantes
-- ============================================================
-- Les usines (fournisseurs_handpick) ne déclarent plus de « catégories
-- proposées » ni de localisation dans l'app : toute catégorie active peut
-- être choisie pour une balle, quelle que soit son usine.
--
-- Le trigger balles_handpick_check_fournisseur_category refusait toute paire
-- absente de fournisseurs_categories_handpick. Sans liaisons saisies, il
-- bloquerait chaque nouvelle balle : on le retire.
--
-- Rien n'est supprimé côté données : fournisseurs_categories_handpick et
-- fournisseurs_handpick.siege_localisation restent en base, inutilisées.
--
-- Idempotent : ré-exécutable sans effet de bord.
-- ============================================================

DROP TRIGGER IF EXISTS balles_handpick_check_fournisseur_category ON public.balles_handpick;
DROP FUNCTION IF EXISTS public.balles_handpick_check_fournisseur_category();
