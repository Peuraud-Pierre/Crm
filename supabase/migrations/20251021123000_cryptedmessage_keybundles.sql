-- Encrypted key bundle sync (passphrase-protected)

create table if not exists public.cryptedmessage_keybundles (
    user_id uuid primary key references profiles (user_id),
    bundle jsonb not null default '{}'::jsonb,
    updated_at timestamp with time zone not null default now()
);

alter table public.cryptedmessage_keybundles
    add column if not exists user_id uuid primary key references profiles (user_id),
    add column if not exists bundle jsonb not null default '{}'::jsonb,
    add column if not exists updated_at timestamp with time zone not null default now();

drop trigger if exists cryptedmessage_keybundles_touch on public.cryptedmessage_keybundles;

create trigger cryptedmessage_keybundles_touch
    before update on public.cryptedmessage_keybundles
    for each row
    execute function touch_updated_at();

alter table public.cryptedmessage_keybundles enable row level security;

do $$
begin
    if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'cryptedmessage_keybundles'
          and policyname = 'Users can manage crypted key bundles'
    ) then
        drop policy "Users can manage crypted key bundles" on public.cryptedmessage_keybundles;
    end if;
end;
$$;

create policy "Users can manage crypted key bundles"
    on public.cryptedmessage_keybundles
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
