-- Suppression des index jamais utilisés qui coûtent réellement.
--
-- Signalé par le linter Supabase (`unused_index`) sur une centaine d'index.
-- L'avertissement n'est exploitable que si les compteurs sont fiables :
-- `pg_stat_database.stats_reset` est `null` sur cette base, donc `idx_scan = 0`
-- porte sur toute la vie du cluster et non sur une fenêtre récente.
--
-- Seuls les six index de plus de 100 kB sont repris ici. Un index inutilisé
-- de 16 kB ne coûte rien de mesurable ; le supprimer, c'est du mouvement pour
-- satisfaire un linter. À l'inverse, les deux index de `client_crm` pèsent
-- 8,3 Mo à eux seuls sur la table la plus écrite de la base, et sont payés à
-- chaque insertion et mise à jour sans avoir jamais servi une seule lecture.
--
-- Volontairement écartés :
--   * les index de `messages` et `groupe_participant` — ancienne messagerie à
--     déchiffrement serveur, à supprimer avec ses tables (cf.
--     20260907140000_drop_decrypted_messages_view.sql), pas séparément ;
--   * les 28 `unindexed_foreign_keys` du même rapport : le linter réclame des
--     index d'un côté pendant qu'il en signale cent d'inutilisés de l'autre.
--     Une FK ne mérite un index que si l'on filtre dessus ou si la table
--     parente subit des suppressions fréquentes — ce n'est le cas d'aucune
--     des tables concernées, toutes sous le millier de lignes.
--
-- Réversible : chaque index se recrée par une commande. Les deux index de
-- `calendar_sync_mappings` sont les seuls à surveiller — si la synchronisation
-- Apple monte en charge, l'index par identifiant Apple pourrait redevenir
-- pertinent (1 857 mappings aujourd'hui, aucun parcours d'index enregistré).

drop index if exists public.idx_client_crm_closers_updated;
drop index if exists public.idx_client_crm_customer_updated;
drop index if exists public.idx_app_logs_level;
drop index if exists public.idx_calendar_sync_mappings_apple;
drop index if exists public.idx_calendar_sync_mappings_local_modified;
drop index if exists public.idx_leads_email;
