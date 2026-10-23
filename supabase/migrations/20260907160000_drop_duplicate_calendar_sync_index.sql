-- Suppression d'un index en double sur `public.calendar_sync_mappings`.
--
-- Signalé par le linter Supabase (`duplicate_index`) : deux index strictement
-- identiques coexistaient sur la colonne `nokk_project_event_id` —
-- `idx_calendar_sync_mappings_nokk_project_event` et
-- `..._nokk_project_event_id`. Aucun des deux n'était versionné (créés via le
-- dashboard). Le doublon coûte à chaque écriture et double l'espace occupé,
-- sans jamais servir à une lecture de plus.
--
-- Le nom le moins précis est supprimé, celui qui nomme la colonne est conservé.

drop index if exists public.idx_calendar_sync_mappings_nokk_project_event;
