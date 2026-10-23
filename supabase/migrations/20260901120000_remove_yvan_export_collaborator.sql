-- ============================================================
-- Retire Commercial A de la config d'export des statistiques CRM
-- (analytics_export_collaborators, voir 20260623000000_analytics_export_collaborators.sql).
--
-- ExportStatsButton n'affiche plus que les collaborateurs configurés dans
-- cette table ; supprimer la ligne suffit à retirer sa colonne de l'export.
-- ============================================================

DELETE FROM public.analytics_export_collaborators
WHERE user_id = 'f2166860-c501-4c35-926c-fc8fb097eff5'; -- Commercial A
