-- Fermeture des policies RLS inconditionnelles (`using (true)` / `with check (true)`).
--
-- Signalé par le linter Supabase (`rls_policy_always_true`) sur 18 policies
-- d'écriture. Contrairement aux lots précédents, ce n'est pas de la
-- performance : ces policies laissent tout compte authentifié écrire
-- n'importe quelle ligne, sans lien avec son auteur ni ses permissions.
-- `results` était même ouverte en UPDATE au rôle `public`, donc à `anon`.
--
-- Principe suivi : ne rien inventer. Chaque table reprend la règle déjà en
-- vigueur sur elle-même ou sur sa voisine immédiate —
--   * `balles` et `deliveries_gestion` → le prédicat de `balles_update`,
--     seule policy de la famille stock qui était déjà correcte ;
--   * `bibliotheque_brief` → le modèle de `bibliotheque_questions_reponses` ;
--   * `sorting_reports` → le `user_id = uid()` de ses propres policies
--     SELECT et UPDATE.
--
-- Les colonnes `owner`, `created_by`, `send_by`, `owner_user` sont typées
-- `string` côté types générés, sans garantie qu'elles portent un UUID plutôt
-- qu'un libellé : aucune policy ci-dessous ne s'appuie dessus. Seule
-- `sorting_reports.user_id` est utilisée, parce que ses policies existantes la
-- comparent déjà à `uid()`.
--
-- NON TRAITÉ ICI, délibérément :
--   * `notification_insert` reste en `with check (true)`. Le resserrer sur
--     `user_id = auth.uid()` casserait `sendProjectNotifications`, qui écrit
--     depuis le client des notifications DESTINÉES À D'AUTRES utilisateurs.
--     La sortie propre est une fonction `security definer` côté base, appelée
--     en RPC — refactor applicatif, pas migration RLS. En l'état, un compte
--     authentifié peut adresser une fausse notification à un collègue :
--     nuisance interne, aucune lecture de données d'autrui (le SELECT est
--     déjà borné à `user_id = uid()`).
--   * l'écriture de `ai_watch_reports` par le rôle de service
--     `content_generation` reste inconditionnelle : c'est le rôle qui produit
--     les rapports. Le linter continuera de la signaler.

-- ============================================================
-- balles — alignement sur `balles_update`, déjà correcte
-- ============================================================

drop policy if exists "balles_insert" on public.balles;
drop policy if exists "balles_delete" on public.balles;

create policy "balles_insert"
on public.balles
for insert
to authenticated
with check (
    has_permission('stock.view')
    and (select auth_session_is_aal2())
);

create policy "balles_delete"
on public.balles
for delete
to authenticated
using (
    has_permission('stock.view')
    and (select auth_session_is_aal2())
);

-- ============================================================
-- deliveries_gestion — même famille métier, même règle
-- ============================================================

drop policy if exists "Enable insert for authenticated users only" on public.deliveries_gestion;
drop policy if exists "Enable update for authenticated users only" on public.deliveries_gestion;
drop policy if exists "Enable delete for authenticated users only" on public.deliveries_gestion;

create policy "deliveries_gestion_insert"
on public.deliveries_gestion
for insert
to authenticated
with check (
    has_permission('stock.view')
    and (select auth_session_is_aal2())
);

create policy "deliveries_gestion_update"
on public.deliveries_gestion
for update
to authenticated
using (
    has_permission('stock.view')
    and (select auth_session_is_aal2())
)
with check (
    has_permission('stock.view')
    and (select auth_session_is_aal2())
);

create policy "deliveries_gestion_delete"
on public.deliveries_gestion
for delete
to authenticated
using (
    has_permission('stock.view')
    and (select auth_session_is_aal2())
);

-- ============================================================
-- sorting_reports — on ne dépose plus un rapport au nom d'autrui
-- ============================================================

drop policy if exists "Enable insert for authenticated users only" on public.sorting_reports;

create policy "sorting_reports_insert"
on public.sorting_reports
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- ============================================================
-- Journaux — activity_log et category_price_history
-- ============================================================
-- Aucun code applicatif n'y insère : ils sont alimentés par les triggers
-- `log_*`, tous `security definer`, donc non soumis à la RLS. La policy
-- d'insertion ne servait qu'à laisser une porte ouverte — elle permettait
-- surtout d'écrire une entrée de journal au nom de n'importe qui, ce qui
-- ruine la valeur probante de l'audit. Elle est conservée mais bornée à
-- l'utilisateur courant, plutôt que supprimée : `log_changes` est le seul
-- trigger `security invoker` du lot et sa table cible n'est pas versionnée.

drop policy if exists "auth_insert_activity_log" on public.activity_log;

create policy "auth_insert_activity_log"
on public.activity_log
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "auth_insert_price_history" on public.category_price_history;

create policy "auth_insert_price_history"
on public.category_price_history
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- ============================================================
-- results — écriture retirée
-- ============================================================
-- Aucun fichier de `src/` ne référence cette table, et son UPDATE était
-- accordé au rôle `public` (donc à `anon`) avec `using (true)`. La lecture
-- est conservée ; l'écriture, si elle a lieu, passe par un service en
-- `service_role`, qui contourne la RLS et n'a donc pas besoin de policy.

drop policy if exists "results_insert" on public.results;
drop policy if exists "results_update" on public.results;
drop policy if exists "results_delete" on public.results;

-- ============================================================
-- bibliotheque_brief — modèle de bibliotheque_questions_reponses
-- ============================================================

drop policy if exists "Authenticated users — brief" on public.bibliotheque_brief;

create policy "bibliotheque.view can read brief"
on public.bibliotheque_brief
for select
to authenticated
using (true);

create policy "bibliotheque.manage can insert brief"
on public.bibliotheque_brief
for insert
to authenticated
with check (user_has_permission((select auth.uid()), 'bibliotheque.manage'));

create policy "bibliotheque.manage can update brief"
on public.bibliotheque_brief
for update
to authenticated
using (user_has_permission((select auth.uid()), 'bibliotheque.manage'))
with check (user_has_permission((select auth.uid()), 'bibliotheque.manage'));

create policy "bibliotheque.manage can delete brief"
on public.bibliotheque_brief
for delete
to authenticated
using (user_has_permission((select auth.uid()), 'bibliotheque.manage'));

-- ============================================================
-- ai_watch_reports — séparation service / humains
-- ============================================================
-- Le `for all (true)` couvrait d'un seul tenant le rôle de service qui
-- produit les rapports et les comptes humains qui les consultent. Séparé :
-- lecture sur `veille.view`, écriture humaine sur `veille.admin`, production
-- laissée au rôle `content_generation`.

drop policy if exists "Insert" on public.ai_watch_reports;

create policy "ai_watch_reports_service_write"
on public.ai_watch_reports
for all
to content_generation
using (true)
with check (true);

create policy "ai_watch_reports_select"
on public.ai_watch_reports
for select
to authenticated
using (user_has_permission((select auth.uid()), 'veille.view'));

create policy "ai_watch_reports_insert"
on public.ai_watch_reports
for insert
to authenticated
with check (user_has_permission((select auth.uid()), 'veille.admin'));

create policy "ai_watch_reports_update"
on public.ai_watch_reports
for update
to authenticated
using (user_has_permission((select auth.uid()), 'veille.admin'))
with check (user_has_permission((select auth.uid()), 'veille.admin'));

create policy "ai_watch_reports_delete"
on public.ai_watch_reports
for delete
to authenticated
using (user_has_permission((select auth.uid()), 'veille.admin'));

-- ============================================================
-- Tickets — les trois tables passent sous `tickets.view`
-- ============================================================
-- `updateTicket` ne filtre ni sur `created_by` ni sur `assigned_to` : la
-- feature est conçue comme un support interne où l'on reprend le ticket d'un
-- autre. Le resserrer sur l'auteur casserait ce fonctionnement. La règle
-- retenue est donc la permission qui garde déjà la route (`tickets.view`,
-- `router.tsx`) : le comportement de tous ceux qui utilisent la feature est
-- inchangé, et les comptes qui n'y ont pas accès ne peuvent plus écrire.

drop policy if exists "Enable insert for authenticated users only" on public.ticket_table;
drop policy if exists "ticket_table_update"                        on public.ticket_table;

create policy "ticket_table_insert"
on public.ticket_table
for insert
to authenticated
with check (user_has_permission((select auth.uid()), 'tickets.view'));

create policy "ticket_table_update"
on public.ticket_table
for update
to authenticated
using (user_has_permission((select auth.uid()), 'tickets.view'))
with check (user_has_permission((select auth.uid()), 'tickets.view'));

drop policy if exists "Enable insert for authenticated users only" on public.ticket_message;
drop policy if exists "Enable update for authenticated users only" on public.ticket_message;

create policy "ticket_message_insert"
on public.ticket_message
for insert
to authenticated
with check (user_has_permission((select auth.uid()), 'tickets.view'));

create policy "ticket_message_update"
on public.ticket_message
for update
to authenticated
using (user_has_permission((select auth.uid()), 'tickets.view'))
with check (user_has_permission((select auth.uid()), 'tickets.view'));

drop policy if exists "Enable insert for authenticated users only" on public.ticket_chat_table;
drop policy if exists "Enable update for authenticated users only" on public.ticket_chat_table;

create policy "ticket_chat_table_insert"
on public.ticket_chat_table
for insert
to authenticated
with check (user_has_permission((select auth.uid()), 'tickets.view'));

create policy "ticket_chat_table_update"
on public.ticket_chat_table
for update
to authenticated
using (user_has_permission((select auth.uid()), 'tickets.view'))
with check (user_has_permission((select auth.uid()), 'tickets.view'));
