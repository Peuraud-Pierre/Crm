-- Doublons signalés par l'advisor Supabase (Duplicate Index) après
-- 20261019120000_event_calendar_range_idx.sql.
--
-- Les index idx_event_calendar_* existaient déjà en base mais n'étaient
-- déclarés dans aucune migration (créés hors dépôt), d'où le doublon. On garde
-- les event_calendar_*_idx, versionnés, et on retire les anciens, identiques.

DROP INDEX IF EXISTS public.idx_event_calendar_debut;
DROP INDEX IF EXISTS public.idx_event_calendar_customer_debut;
DROP INDEX IF EXISTS public.idx_event_calendar_id_client;
