-- Crypted messaging test tables

create table if not exists public.cryptedmessage (
    id bigserial not null,
    chat_id text not null,
    sender_id uuid not null,
    recipient_id uuid not null,
    ciphertext_b64 text null,
    iv_b64 text null,
    content_encrypted text null,
    meta jsonb null default '{}'::jsonb,
    created_at timestamp with time zone not null default now(),
    read boolean null,
    constraint cryptedmessage_pkey primary key (id)
);

create table if not exists public.cryptedmessage_userkeys (
    user_id uuid not null,
    device_id text not null,
    encrypted_privkey text not null,
    iv text not null,
    kdf jsonb not null default '{}'::jsonb,
    pubkey jsonb not null default '{}'::jsonb,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    constraint cryptedmessage_userkeys_pkey primary key (user_id, device_id)
);

alter table public.cryptedmessage
    add column if not exists chat_id text not null,
    add column if not exists sender_id uuid not null,
    add column if not exists recipient_id uuid not null,
    add column if not exists ciphertext_b64 text,
    add column if not exists iv_b64 text,
    add column if not exists content_encrypted text,
    add column if not exists meta jsonb default '{}'::jsonb,
    add column if not exists created_at timestamp with time zone default now(),
    add column if not exists read boolean;

alter table public.cryptedmessage_userkeys
    add column if not exists user_id uuid not null,
    add column if not exists device_id text not null,
    add column if not exists encrypted_privkey text not null,
    add column if not exists iv text not null,
    add column if not exists kdf jsonb default '{}'::jsonb,
    add column if not exists pubkey jsonb default '{}'::jsonb,
    add column if not exists created_at timestamp with time zone default now(),
    add column if not exists updated_at timestamp with time zone default now();

-- Constraints ----------------------------------------------------------------

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'cryptedmessage_sender_id_fkey'
    ) then
        alter table public.cryptedmessage
            add constraint cryptedmessage_sender_id_fkey
            foreign key (sender_id) references profiles (user_id);
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'cryptedmessage_recipient_id_fkey'
    ) then
        alter table public.cryptedmessage
            add constraint cryptedmessage_recipient_id_fkey
            foreign key (recipient_id) references profiles (user_id);
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'cryptedmessage_userkeys_user_id_fkey'
    ) then
        alter table public.cryptedmessage_userkeys
            add constraint cryptedmessage_userkeys_user_id_fkey
            foreign key (user_id) references profiles (user_id);
    end if;
end;
$$;

-- Trigger to keep updated_at fresh -------------------------------------------

drop trigger if exists cryptedmessage_userkeys_touch on public.cryptedmessage_userkeys;

create trigger cryptedmessage_userkeys_touch
    before update on public.cryptedmessage_userkeys
    for each row
    execute function touch_updated_at();

-- Indexes --------------------------------------------------------------------

create index if not exists idx_cryptedmessage_chat_id
    on public.cryptedmessage using btree (chat_id);

create index if not exists idx_cryptedmessage_sender_id
    on public.cryptedmessage using btree (sender_id);

create index if not exists idx_cryptedmessage_recipient_id
    on public.cryptedmessage using btree (recipient_id);

create index if not exists idx_cryptedmessage_created_at
    on public.cryptedmessage using btree (created_at);

create index if not exists idx_cryptedmessage_userkeys_user_id
    on public.cryptedmessage_userkeys using btree (user_id);

-- Realtime publication -------------------------------------------------------

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'cryptedmessage'
    ) then
        alter publication supabase_realtime add table public.cryptedmessage;
    end if;
end;
$$;

-- RLS ------------------------------------------------------------------------

alter table public.cryptedmessage enable row level security;
alter table public.cryptedmessage_userkeys enable row level security;

-- Policies for cryptedmessage

do $$
begin
    if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'cryptedmessage'
          and policyname = 'Users can view crypted messages'
    ) then
        drop policy "Users can view crypted messages" on public.cryptedmessage;
    end if;
end;
$$;

create policy "Users can view crypted messages"
    on public.cryptedmessage
    for select
    using (auth.uid() = sender_id or auth.uid() = recipient_id);

do $$
begin
    if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'cryptedmessage'
          and policyname = 'Users can send crypted messages'
    ) then
        drop policy "Users can send crypted messages" on public.cryptedmessage;
    end if;
end;
$$;

create policy "Users can send crypted messages"
    on public.cryptedmessage
    for insert
    with check (auth.uid() = sender_id);

do $$
begin
    if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'cryptedmessage'
          and policyname = 'Users can update crypted messages'
    ) then
        drop policy "Users can update crypted messages" on public.cryptedmessage;
    end if;
end;
$$;

create policy "Users can update crypted messages"
    on public.cryptedmessage
    for update
    using (auth.uid() = sender_id or auth.uid() = recipient_id)
    with check (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Policies for cryptedmessage_userkeys

do $$
begin
    if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'cryptedmessage_userkeys'
          and policyname = 'Users can manage crypted keys'
    ) then
        drop policy "Users can manage crypted keys" on public.cryptedmessage_userkeys;
    end if;
end;
$$;

create policy "Users can manage crypted keys"
    on public.cryptedmessage_userkeys
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Public read of keys for testing

do $$
begin
    if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'cryptedmessage_userkeys'
          and policyname = 'Users can read crypted public keys'
    ) then
        drop policy "Users can read crypted public keys" on public.cryptedmessage_userkeys;
    end if;
end;
$$;

create policy "Users can read crypted public keys"
    on public.cryptedmessage_userkeys
    for select
    using (true);
