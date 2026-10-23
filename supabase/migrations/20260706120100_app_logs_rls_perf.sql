-- Perf RLS : app_logs — même correctif que logs_crm (voir migration
-- 20260706120000_logs_crm_rls_perf.sql).
--
-- Les policies app_logs_select / app_logs_delete évaluaient
-- `has_permission('manager.console')` PAR LIGNE. Combiné au Seq Scan de la
-- table (fort volume) et, côté lecture, à l'ancien count:"exact" du hook
-- useAppLogs, cela provoquait un statement timeout 57014 → HTTP 500.
--
-- Correctif : envelopper dans (SELECT ...) pour une évaluation unique
-- (InitPlan) au lieu d'une fois par ligne. has_permission ne dépend que de
-- l'utilisateur courant, pas de la ligne : résultat identique, coût O(1).

ALTER POLICY app_logs_select ON public.app_logs
    USING ( (SELECT has_permission('manager.console')) );

ALTER POLICY app_logs_delete ON public.app_logs
    USING ( (SELECT has_permission('manager.console')) );

-- Cohérence : même enveloppage pour uid() dans le check d'insert (bénéfice
-- réel si un insert multi-lignes survient un jour ; neutre sur un insert unitaire).
ALTER POLICY app_logs_insert_own ON public.app_logs
    WITH CHECK ( (SELECT uid()) = user_id );
