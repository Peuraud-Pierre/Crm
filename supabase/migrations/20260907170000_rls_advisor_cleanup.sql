-- Solde des avertissements du Performance Advisor Supabase sur la RLS.
--
-- Trois motifs, aucun changement de règle d'accès :
--
-- 1. `multiple_permissive_policies` — plusieurs policies permissives couvrent
--    le même couple (rôle, action). Postgres les évalue TOUTES et combine en
--    `OR` ; les réunir en une seule policy par action donne donc exactement
--    le même résultat, pour un seul passage.
--
-- 2. Policies déclarées sans clause `to`, donc rattachées à `public` —
--    c'est-à-dire à tous les rôles, `anon` compris. Aucune n'était
--    exploitable (leurs prédicats reposent sur `auth.uid()`, NULL pour un
--    visiteur, ou sur `has_permission()`, faux), mais le cadrage explicite
--    sur `authenticated` supprime la moitié des avertissements — un même
--    chevauchement était compté une fois par rôle (`anon`, `authenticator`,
--    `dashboard_user`...).
--
-- 3. `auth_rls_initplan` sur `client_crm.crm_client_delete` : faux positif,
--    son `current_setting` était déjà enveloppé dans un `(select coalesce(…))`.
--    L'appel `has_permission('crm.view')`, lui, était bien réévalué à chaque
--    ligne — sur ~4 300 lignes c'est le seul gain réel de cette migration, et
--    le linter ne le signalait pas.
--
-- Vérifié avant écriture : aucun flux anonyme sur `newsletter_subscriptions`
-- (les trois services qui la lisent sont dans `crm`, `arrivage-admin` et
-- `profile`, tous derrière authentification).

-- ============================================================
-- client_crm — enveloppement des appels réévalués par ligne
-- ============================================================

drop policy if exists "crm_client_delete" on public.client_crm;

create policy "crm_client_delete"
on public.client_crm
for delete
to authenticated
using (
    (select has_permission('crm.view'))
    and coalesce(
        ((select current_setting('request.jwt.claims', true))::jsonb ->> 'aal') = 'aal2',
        false
    )
);

-- ============================================================
-- cryptedmessage_groups — fusion du SELECT, cadrage sur authenticated
-- ============================================================
-- Créateur et membre étaient deux policies SELECT distinctes. Un créateur
-- est membre de son groupe dans les faits, mais la branche `created_by`
-- couvre l'instant entre la création du groupe et l'insertion du premier
-- membre — elle est conservée dans la disjonction.

drop policy if exists "group_creator_can_select_own_groups" on public.cryptedmessage_groups;
drop policy if exists "group_members_can_select_groups"     on public.cryptedmessage_groups;
drop policy if exists "authenticated_can_create_groups"     on public.cryptedmessage_groups;
drop policy if exists "group_admin_can_update_group"        on public.cryptedmessage_groups;
drop policy if exists "group_admin_can_delete_group"        on public.cryptedmessage_groups;

create policy "cryptedmessage_groups_select"
on public.cryptedmessage_groups
for select
to authenticated
using (
    (select auth.uid()) = created_by
    or cmg_is_member(id, (select auth.uid()))
);

create policy "cryptedmessage_groups_insert"
on public.cryptedmessage_groups
for insert
to authenticated
with check ((select auth.uid()) = created_by);

create policy "cryptedmessage_groups_update"
on public.cryptedmessage_groups
for update
to authenticated
using ((select auth.uid()) = created_by);

create policy "cryptedmessage_groups_delete"
on public.cryptedmessage_groups
for delete
to authenticated
using ((select auth.uid()) = created_by);

-- ============================================================
-- newsletter_subscriptions — fusion du FOR ALL et des policies admin
-- ============================================================
-- `user_owns_own_subscription` (for all) chevauchait la lecture admin et la
-- policy d'écriture nommée `update`. Répartition à l'identique :
--   * lecture et mise à jour : le propriétaire OU l'admin newsletter ;
--   * création et suppression : le propriétaire seul — l'admin n'en avait
--     déjà pas le droit, la policy `update` ne couvrant que l'UPDATE.
-- `service_role_subscriptions` est laissée telle quelle : rôle distinct,
-- donc aucun chevauchement.

drop policy if exists "user_owns_own_subscription"                on public.newsletter_subscriptions;
drop policy if exists "arrivage_admin_can_read_all_subscriptions" on public.newsletter_subscriptions;
drop policy if exists "update"                                    on public.newsletter_subscriptions;

create policy "newsletter_subscriptions_select"
on public.newsletter_subscriptions
for select
to authenticated
using (
    (select auth.uid()) = user_id
    or (select has_permission('stock.arrivage.newsletter.admin'))
);

create policy "newsletter_subscriptions_insert"
on public.newsletter_subscriptions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "newsletter_subscriptions_update"
on public.newsletter_subscriptions
for update
to authenticated
using (
    (select auth.uid()) = user_id
    or (select has_permission('stock.arrivage.newsletter.admin'))
)
with check (
    (select auth.uid()) = user_id
    or (select has_permission('stock.arrivage.newsletter.admin'))
);

create policy "newsletter_subscriptions_delete"
on public.newsletter_subscriptions
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ============================================================
-- roles_permissions — le FOR ALL admin ne couvre plus la lecture
-- ============================================================
-- La lecture est déjà ouverte à tout compte authentifié (`true`) : la
-- branche SELECT du `for all` admin n'ajoutait rien et ne faisait que
-- doubler l'évaluation.

drop policy if exists "roles_permissions_admin_write" on public.roles_permissions;

create policy "roles_permissions_admin_insert"
on public.roles_permissions
for insert
to authenticated
with check ((select user_is_global_admin()));

create policy "roles_permissions_admin_update"
on public.roles_permissions
for update
to authenticated
using ((select user_is_global_admin()))
with check ((select user_is_global_admin()));

create policy "roles_permissions_admin_delete"
on public.roles_permissions
for delete
to authenticated
using ((select user_is_global_admin()));

-- ============================================================
-- services_permissions — fusion admin global / admin de service
-- ============================================================
-- Le `for all` de l'admin global chevauchait les quatre policies par action.
-- Chaque action reprend la disjonction des deux prédicats d'origine.
-- `check_is_service_admin(service_id)` dépend de la ligne : il ne peut pas
-- être enveloppé dans un sous-select, contrairement aux deux autres.

drop policy if exists "services_permissions_admin_write"     on public.services_permissions;
drop policy if exists "Allow select for authenticated users" on public.services_permissions;
drop policy if exists "Allow insert for service admins"      on public.services_permissions;
drop policy if exists "Allow update for service admins"      on public.services_permissions;
drop policy if exists "Allow delete for service admins"      on public.services_permissions;

create policy "services_permissions_select"
on public.services_permissions
for select
to authenticated
using (true);

create policy "services_permissions_insert"
on public.services_permissions
for insert
to authenticated
with check (
    (select check_is_super_admin_global())
    or (select user_is_global_admin())
);

create policy "services_permissions_update"
on public.services_permissions
for update
to authenticated
using (
    check_is_service_admin(service_id)
    or (select user_is_global_admin())
)
with check (
    check_is_service_admin(service_id)
    or (select user_is_global_admin())
);

create policy "services_permissions_delete"
on public.services_permissions
for delete
to authenticated
using (
    check_is_service_admin(service_id)
    or (select user_is_global_admin())
);
