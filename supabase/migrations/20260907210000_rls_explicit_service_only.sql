-- Verrouillage explicite des tables réservées au service.
--
-- Signalé par le linter Supabase (`rls_enabled_no_policy`) sur dix tables :
-- RLS activée, aucune policy. C'est l'inverse d'une faille — sans policy,
-- PostgreSQL refuse tout accès aux rôles soumis à la RLS. Ces tables ne sont
-- atteintes que par `service_role` et par des fonctions `security definer`,
-- qui ne sont ni l'un ni l'autre concernés. Vérifié : aucune n'est référencée
-- par le code de `src/`.
--
-- Rien ne change donc fonctionnellement. Ce que cette migration apporte est
-- documentaire, et ce n'est pas rien dans une base où l'on vient de découvrir
-- des policies posées au dashboard et jamais versionnées : « RLS activée sans
-- policy » est ambigu — on ne distingue pas le verrouillage délibéré de
-- l'oubli d'écrire les règles. Une policy `using (false)` nommée lève
-- l'ambiguïté, apparaît dans `pg_policies`, et ferme l'avertissement.
--
-- Si l'une de ces tables doit un jour être lue par l'application, c'est cette
-- policy qu'il faudra remplacer — et son nom dira qu'on savait ce qu'on
-- faisait en la fermant.

do $$
declare
    r     record;
    v_n   int := 0;
begin
    for r in
        select unnest(array[
            'News',
            'amelia_company_closures',
            'amelia_company_days_off',
            'amelia_company_special',
            'amelia_company_weekly',
            'app_logs_retention_config',
            'gallery_permissions',
            'pg_net_watchdog_state',
            'product_image',
            'rdv_reschedule_mail_queue'
        ]) as tablename
    loop
        -- Table absente d'un environnement (préprod partielle) : on passe.
        if to_regclass(format('public.%I', r.tablename)) is null then
            continue;
        end if;

        execute format(
            'drop policy if exists %I on public.%I',
            r.tablename || '_service_only', r.tablename
        );
        execute format(
            'create policy %I on public.%I as restrictive for all to public using (false) with check (false)',
            r.tablename || '_service_only', r.tablename
        );

        v_n := v_n + 1;
    end loop;

    raise notice 'Tables verrouillees explicitement : %', v_n;
end
$$;
