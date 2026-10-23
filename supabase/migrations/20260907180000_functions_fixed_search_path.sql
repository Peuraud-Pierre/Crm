-- Cadrage du `search_path` des fonctions de `public`.
--
-- Signalé par le linter Supabase (`function_search_path_mutable`) sur une
-- soixantaine de fonctions. Sans `search_path` figé, une fonction résout ses
-- noms non qualifiés selon le search_path de l'APPELANT : un rôle capable de
-- créer un objet dans un schéma placé en tête (à commencer par `pg_temp`,
-- consulté en premier lorsqu'il n'est pas mentionné explicitement) peut faire
-- exécuter sa propre table ou sa propre fonction à la place de celle attendue.
--
-- La conséquence est sérieuse pour les fonctions `security definer` — elles
-- s'exécutent avec les droits de leur propriétaire — et le dépôt en compte
-- plusieurs sur des chemins sensibles (`cmg_is_member`, `has_permission`,
-- `user_is_global_admin`, `check_is_service_admin`...). Le cadrage est appliqué
-- à toutes, definer comme invoker : le coût est nul et la distinction serait
-- une source d'oubli au prochain ajout.
--
-- `pg_temp` est placé en DERNIER, ce qui est tout l'intérêt de la manœuvre.
--
-- Deux exclusions :
--   * les fonctions appartenant à une extension (`pg_depend.deptype = 'e'`,
--     dont `index_advisor*`) — elles sont la propriété de l'extension, les
--     modifier serait défait à la prochaine mise à jour ;
--   * les procédures (`prokind <> 'f'`), qui relèvent d'`alter procedure`.
--
-- Le `search_path` retenu inclut `auth` : plusieurs fonctions appellent
-- `uid()` sans qualifier le schéma, et le retirer les casserait.
--
-- Migration idempotente : le `where` ignore les fonctions déjà cadrées.

do $$
declare
    r     record;
    v_n   int := 0;
begin
    for r in
        select p.oid::regprocedure as signature
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.prokind = 'f'
          and not exists (
              select 1
              from unnest(coalesce(p.proconfig, '{}'::text[])) as cfg
              where cfg like 'search\_path=%'
          )
          and not exists (
              select 1 from pg_depend d
              where d.objid = p.oid and d.deptype = 'e'
          )
        order by 1
    loop
        execute format(
            'alter function %s set search_path = public, extensions, auth, pg_temp',
            r.signature
        );
        v_n := v_n + 1;
    end loop;

    raise notice 'Fonctions cadrees : %', v_n;
end
$$;
