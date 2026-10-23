-- Switch to single public key per user

alter table public.cryptedmessage_userkeys rename to cryptedmessage_userkeys_devices;

create table if not exists public.cryptedmessage_userkeys (
    user_id uuid primary key references profiles (user_id),
    pubkey jsonb not null default '{}'::jsonb,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
);

insert into public.cryptedmessage_userkeys (user_id, pubkey, created_at, updated_at)
select distinct on (user_id)
    user_id,
    pubkey,
    created_at,
    updated_at
from public.cryptedmessage_userkeys_devices
order by user_id, updated_at desc;

drop trigger if exists cryptedmessage_userkeys_touch on public.cryptedmessage_userkeys_devices;

create trigger cryptedmessage_userkeys_touch
    before update on public.cryptedmessage_userkeys
    for each row
    execute function touch_updated_at();

alter table public.cryptedmessage_userkeys enable row level security;

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

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'cryptedmessage_userkeys'
    ) then
        alter publication supabase_realtime add table public.cryptedmessage_userkeys;
    end if;
end;
$$;
