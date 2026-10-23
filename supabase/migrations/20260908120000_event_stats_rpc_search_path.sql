-- Cadrage du `search_path` de `public.get_crm_event_stats`.
--
-- `20260604000000_event_stats_rpc.sql` n'avait jamais été appliqué en
-- production : constaté le 08/09/2026 à partir des logs de `/analytics/crm`
-- (« Could not find the function public.get_crm_event_stats(...) in the schema
-- cache », 15 occurrences en 24 h), puis confirmé par `pg_proc` — aucune ligne.
-- Chaque visite retombait donc sur le select direct de secours
-- (`fetchEventStatsFallback`, src/features/crm/services/statsService.ts), soumis
-- à la RLS et plafonné à 10 000 lignes, là où le RPC est `security definer` :
-- les compteurs affichés étaient sous-évalués sans que rien ne le signale.
--
-- La fonction a été créée à la main le 08/09/2026, avec le `search_path` figé
-- que `20260907180000_functions_fixed_search_path.sql` venait d'appliquer aux
-- soixante autres. Cette migration remet le dépôt en accord avec la base : sans
-- elle, un rejeu à blanc reconstruirait une fonction `security definer` au
-- `search_path` ouvert — exactement ce que le lot du 07/09 a fermé.
--
-- `alter` et non `create or replace` : la définition du corps reste à sa place,
-- dans la migration d'origine. Sur une base déjà à jour, l'ordre est sans effet.

alter function public.get_crm_event_stats(timestamptz, timestamptz)
    set search_path = public, extensions, auth, pg_temp;
