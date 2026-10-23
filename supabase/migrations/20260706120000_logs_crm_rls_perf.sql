-- Perf RLS : logs_crm — supprime le statement timeout 57014 (HTTP 500) sur
-- le panneau ErrorConsole / CRM Logs.
--
-- Diagnostic : la requête `SELECT * FROM logs_crm ORDER BY change_at DESC
-- LIMIT 200` tourne en ~170ms SANS RLS (SQL Editor / service_role) mais
-- timeoutait à 8s via l'API (rôle authenticated, RLS active). Le planner
-- choisit un Seq Scan (~127k lignes) et la policy SELECT évaluait
-- `has_permission('crm.view')` + `has_permission('log.view')` PAR LIGNE
-- (~254k appels, chacun faisant un lookup de permissions) → explosion.
--
-- Correctif : envelopper les appels dans (SELECT ...) pour qu'ils soient
-- évalués UNE seule fois (InitPlan), au lieu d'une fois par ligne. Ces
-- fonctions ne dépendent que de l'utilisateur courant (auth.uid()), pas de
-- la ligne scannée : résultat identique, coût O(1) au lieu de O(n). C'est le
-- même pattern que les policies de `profiles` (déjà en (SELECT uid())).

ALTER POLICY "Select" ON public.logs_crm
    USING (
        (SELECT has_permission('crm.view'))
        OR (SELECT has_permission('log.view'))
    );

-- Même optimisation sur les policies d'écriture (cohérence + tout futur
-- UPDATE/INSERT de masse profite de l'évaluation unique).
ALTER POLICY "Update" ON public.logs_crm
    USING (
        (SELECT has_permission('crm.view'))
        OR (SELECT has_permission('log.view'))
    )
    WITH CHECK (
        (SELECT has_permission('crm.view'))
        OR (SELECT has_permission('log.view'))
    );

ALTER POLICY "INSERT" ON public.logs_crm
    WITH CHECK (
        (SELECT has_permission('crm.view'))
        OR (SELECT has_permission('log.view'))
    );
