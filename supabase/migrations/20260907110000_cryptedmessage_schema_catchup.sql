-- Rattrapage du schéma de `public.cryptedmessage`.
--
-- Une série de changements avait été appliquée directement via le dashboard
-- Supabase, sans migration : le dépôt ne décrivait plus la table réelle, et un
-- rejeu à blanc des migrations produisait un schéma cassé pour les messages de
-- groupe (`recipient_id not null`), les réponses (`reply_to_id` absent) et la
-- suppression logique (`deleted_at` absent).
--
-- Écarts constatés en base le 07/09/2026 et repris ici :
--   * `recipient_id` nullable — un message de groupe n'a pas de destinataire
--     unique, `useCryptedGroupChat.ts` insère `null` ;
--   * `deleted_at` — suppression logique ;
--   * `reply_to_id` (+ FK auto-référente et index partiel) — message cité ;
--   * clauses `on delete` des FK `sender_id` / `recipient_id`, absentes de
--     20251020130000_cryptedmessage_tables.sql : la suppression d'un profil
--     efface ses envois et anonymise ses réceptions.
--
-- Migration idempotente, sans effet sur une base déjà à jour. Ordonnée AVANT
-- la consolidation RLS du même jour, dont les policies supposent
-- `recipient_id` nullable.

-- ===== Colonnes =====
alter table public.cryptedmessage
    alter column recipient_id drop not null;

alter table public.cryptedmessage
    add column if not exists deleted_at timestamp with time zone,
    add column if not exists reply_to_id bigint;

-- ===== Contraintes =====
-- Recréées plutôt que modifiées : Postgres ne sait pas altérer le `on delete`
-- d'une FK existante.
alter table public.cryptedmessage
    drop constraint if exists cryptedmessage_sender_id_fkey;
alter table public.cryptedmessage
    add constraint cryptedmessage_sender_id_fkey
    foreign key (sender_id) references public.profiles (user_id)
    on delete cascade;

alter table public.cryptedmessage
    drop constraint if exists cryptedmessage_recipient_id_fkey;
alter table public.cryptedmessage
    add constraint cryptedmessage_recipient_id_fkey
    foreign key (recipient_id) references public.profiles (user_id)
    on delete set null;

alter table public.cryptedmessage
    drop constraint if exists cryptedmessage_reply_to_id_fkey;
alter table public.cryptedmessage
    add constraint cryptedmessage_reply_to_id_fkey
    foreign key (reply_to_id) references public.cryptedmessage (id)
    on update cascade on delete set null;

-- ===== Index =====
create index if not exists idx_cryptedmessage_chat_created
    on public.cryptedmessage using btree (chat_id, created_at desc);

create index if not exists idx_cryptedmessage_reply_to
    on public.cryptedmessage using btree (reply_to_id)
    where reply_to_id is not null;
