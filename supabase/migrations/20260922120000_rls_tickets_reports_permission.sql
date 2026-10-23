-- Tickets — l'écriture est rendue à la page Support (`/reports`).
--
-- `20260907190000_rls_close_always_true_policies.sql` a fermé les six policies
-- d'écriture des tables ticket sur `tickets.view`, au motif que c'est « la
-- permission qui garde déjà la route (`router.tsx`) ». Il y en a deux : outre
-- `/tickets` (menu Admin, `tickets.view`), `/reports` (menu « Support »,
-- `reports.view`) monte le MÊME formulaire de création (`TicketCreationSheet`)
-- et la MÊME sheet de détail — donc `ticket_table` en insert/update,
-- `ticket_chat_table` à l'ouverture du chat et `ticket_message` à chaque
-- réponse.
--
-- Conséquence en production : tout compte qui a `reports.view` sans
-- `tickets.view` — c'est-à-dire l'usage normal de la feature, ouvrir un ticket
-- au support — reçoit `42501 new row violates row-level security policy for
-- table "ticket_table"` au moment d'enregistrer.
--
-- Les six prédicats passent donc à « l'une des deux permissions de route ».
-- L'update reste volontairement non borné à l'auteur, pour la raison déjà
-- donnée en 20260907190000 : la feature est un support interne où l'on reprend
-- le ticket d'un autre.

drop policy if exists "ticket_table_insert" on public.ticket_table;
drop policy if exists "ticket_table_update" on public.ticket_table;

create policy "ticket_table_insert"
on public.ticket_table
for insert
to authenticated
with check (
    user_has_permission((select auth.uid()), 'tickets.view')
    or user_has_permission((select auth.uid()), 'reports.view')
);

create policy "ticket_table_update"
on public.ticket_table
for update
to authenticated
using (
    user_has_permission((select auth.uid()), 'tickets.view')
    or user_has_permission((select auth.uid()), 'reports.view')
)
with check (
    user_has_permission((select auth.uid()), 'tickets.view')
    or user_has_permission((select auth.uid()), 'reports.view')
);

drop policy if exists "ticket_message_insert" on public.ticket_message;
drop policy if exists "ticket_message_update" on public.ticket_message;

create policy "ticket_message_insert"
on public.ticket_message
for insert
to authenticated
with check (
    user_has_permission((select auth.uid()), 'tickets.view')
    or user_has_permission((select auth.uid()), 'reports.view')
);

create policy "ticket_message_update"
on public.ticket_message
for update
to authenticated
using (
    user_has_permission((select auth.uid()), 'tickets.view')
    or user_has_permission((select auth.uid()), 'reports.view')
)
with check (
    user_has_permission((select auth.uid()), 'tickets.view')
    or user_has_permission((select auth.uid()), 'reports.view')
);

drop policy if exists "ticket_chat_table_insert" on public.ticket_chat_table;
drop policy if exists "ticket_chat_table_update" on public.ticket_chat_table;

create policy "ticket_chat_table_insert"
on public.ticket_chat_table
for insert
to authenticated
with check (
    user_has_permission((select auth.uid()), 'tickets.view')
    or user_has_permission((select auth.uid()), 'reports.view')
);

create policy "ticket_chat_table_update"
on public.ticket_chat_table
for update
to authenticated
using (
    user_has_permission((select auth.uid()), 'tickets.view')
    or user_has_permission((select auth.uid()), 'reports.view')
)
with check (
    user_has_permission((select auth.uid()), 'tickets.view')
    or user_has_permission((select auth.uid()), 'reports.view')
);
