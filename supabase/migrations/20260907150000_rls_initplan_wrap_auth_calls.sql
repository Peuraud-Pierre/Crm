-- Enveloppement des appels `auth.*()` dans les policies RLS du schéma public.
--
-- Signalé par le Performance Advisor Supabase (`auth_rls_initplan`) sur 55
-- policies réparties sur une vingtaine de tables : un appel `auth.uid()` nu
-- dans une policy est réévalué **une fois par ligne** examinée, alors que
-- `(select auth.uid())` est reconnu par le planner comme un InitPlan, évalué
-- une seule fois par requête.
--
-- L'écart n'est mesurable que sur les tables volumineuses — `client_crm`
-- (~4 300 lignes) et `changelog_items` (~1 000) ; le reste est corrigé pour
-- fermer l'avertissement, pas pour un gain réel.
--
-- Réécriture programmatique plutôt que 55 blocs `drop`/`create` recopiés :
-- la définition de chaque policy est relue depuis `pg_policies` et rejouée à
-- l'identique, seul l'appel `auth.*()` étant enveloppé. Aucune règle d'accès
-- n'est modifiée. Le `where` ne retient que les policies ayant au moins un
-- appel NON déjà enveloppé, donc la migration est idempotente : une seconde
-- exécution ne trouve plus rien.
--
-- `current_setting(...)` est volontairement laissé de côté : ses arguments
-- varient, une réécriture par expression régulière y serait fragile.
--
-- Le drop et le create sont dans la même transaction : un échec de recréation
-- annule tout, aucune table ne peut se retrouver sans sa policy.

set local search_path = public, extensions, auth;

do $$
declare
    r            record;
    v_using      text;
    v_check      text;
    v_avant      int;
    v_apres      int;
    v_reecrites  int := 0;
    -- un appel `auth.uid()` (le préfixe de schéma peut manquer selon le
    -- search_path au moment du déparsage) ...
    c_appel      constant text := '\m(auth\.)?(uid|jwt|role|email)\(\)';
    -- ... et le même appel déjà enveloppé dans un sous-select.
    c_enveloppe  constant text := '\(\s*select\s+(auth\.)?(uid|jwt|role|email)\(\)';
begin
    select count(*) into v_avant from pg_policies where schemaname = 'public';

    for r in
        select schemaname, tablename, policyname, permissive, cmd, roles, qual, with_check
        from pg_policies
        where schemaname = 'public'
          and regexp_count(coalesce(qual, '') || ' ' || coalesce(with_check, ''), c_appel, 1, 'i')
            > regexp_count(coalesce(qual, '') || ' ' || coalesce(with_check, ''), c_enveloppe, 1, 'i')
        order by tablename, policyname
    loop
        v_using := regexp_replace(r.qual,       c_appel, '(select auth.\2())', 'g');
        v_check := regexp_replace(r.with_check, c_appel, '(select auth.\2())', 'g');

        execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);

        execute format(
            'create policy %I on %I.%I as %s for %s to %s%s%s',
            r.policyname, r.schemaname, r.tablename,
            r.permissive,
            r.cmd,
            array_to_string(r.roles, ', '),
            coalesce(' using (' || v_using || ')', ''),
            coalesce(' with check (' || v_check || ')', '')
        );

        v_reecrites := v_reecrites + 1;
    end loop;

    -- Garde-fou : une policy perdue en route est une table ouverte ou fermée
    -- par accident. On échoue plutôt que de laisser passer.
    select count(*) into v_apres from pg_policies where schemaname = 'public';
    if v_apres <> v_avant then
        raise exception 'Perte de policies : % avant, % apres', v_avant, v_apres;
    end if;

    raise notice 'Policies reecrites : % (total inchange : %)', v_reecrites, v_apres;
end
$$;
