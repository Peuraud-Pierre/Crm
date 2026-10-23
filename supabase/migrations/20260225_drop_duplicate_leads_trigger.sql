-- ============================================================
-- Suppression du trigger create_client_from_lead (doublon)
-- leads_client_crm_sync couvre le même besoin avec en plus :
-- - déduplication par email (UPDATE si client existant)
-- - historique horodaté dans le champ message
-- - COALESCE sur les champs nullable
-- ============================================================

DROP TRIGGER IF EXISTS trg_create_client_from_lead ON public.leads;
DROP FUNCTION IF EXISTS public.create_client_from_lead();
