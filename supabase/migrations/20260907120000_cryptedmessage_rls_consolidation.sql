-- Consolidation des policies RLS de `public.cryptedmessage`.
--
-- ÉTAT AVANT : quatre jeux de policies coexistaient, dont deux créés hors
-- migration (via le dashboard Supabase) et donc absents du dépôt :
--   * `crypted_select` / `crypted_insert` / `crypted_update` (dashboard, non
--     tracées ici — `crypted_update` était en plus attachée au mauvais rôle) ;
--   * `group_members_can_read_group_messages` /
--     `group_members_can_insert_group_messages`
--     (20260302000000_cryptedmessage_groups.sql).
--
-- Cette migration les remplace par un jeu unique `cryptedmessage_<action>`,
-- cadré sur le rôle `authenticated`, et remet la définition sous contrôle de
-- version — c'est le seul point de vérité pour la RLS de cette table.
--
-- Notes :
--   * `(select auth.uid())` plutôt que `auth.uid()` : le planner évalue
--     l'appel une seule fois par requête au lieu d'une fois par ligne.
--   * INSERT ne vérifie plus l'appartenance au groupe (`cmg_is_member`) :
--     seule l'identité de l'émetteur est contrôlée. La lecture reste, elle,
--     bien restreinte aux membres.
--   * DELETE devient explicite (émetteur uniquement) ; sans policy DELETE,
--     RLS refusait toute suppression.

-- ===== INSERT =====
drop policy if exists "group_members_can_insert_group_messages" on public.cryptedmessage;
drop policy if exists "crypted_insert" on public.cryptedmessage;
drop policy if exists "cryptedmessage_insert" on public.cryptedmessage;

create policy "cryptedmessage_insert"
on public.cryptedmessage
for insert
to authenticated
with check (
  (select auth.uid()) = sender_id
);

-- ===== SELECT =====
drop policy if exists "crypted_select" on public.cryptedmessage;
drop policy if exists "group_members_can_read_group_messages" on public.cryptedmessage;
drop policy if exists "cryptedmessage_select" on public.cryptedmessage;

create policy "cryptedmessage_select"
on public.cryptedmessage
for select
to authenticated
using (
  (select auth.uid()) = sender_id
  or (select auth.uid()) = recipient_id
  or (
    chat_id like 'group:%'
    and cmg_is_member(
      (replace(chat_id, 'group:', ''))::uuid,
      (select auth.uid())
    )
  )
);

-- ===== UPDATE : juste le rôle à corriger =====
drop policy if exists "crypted_update" on public.cryptedmessage;
drop policy if exists "cryptedmessage_update" on public.cryptedmessage;

create policy "cryptedmessage_update"
on public.cryptedmessage
for update
to authenticated
using (
  (select auth.uid()) = sender_id
  or (select auth.uid()) = recipient_id
)
with check (
  (select auth.uid()) = sender_id
  or (select auth.uid()) = recipient_id
);

-- ===== DELETE =====
drop policy if exists "crypted_delete" on public.cryptedmessage;
drop policy if exists "cryptedmessage_delete" on public.cryptedmessage;

create policy "cryptedmessage_delete"
on public.cryptedmessage
for delete
to authenticated
using ((select auth.uid()) = sender_id);
