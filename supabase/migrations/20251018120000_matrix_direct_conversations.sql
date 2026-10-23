-- Matrix direct conversations registry

create table if not exists public.direct_conversations (
    id uuid not null default gen_random_uuid(),
    user_a uuid not null,
    user_b uuid not null,
    user_low uuid generated always as (least(user_a, user_b)) stored,
    user_high uuid generated always as (greatest(user_a, user_b)) stored,
    matrix_room_id text not null,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    constraint direct_conversations_pkey primary key (id)
);

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'direct_conversations_users_different'
    ) then
        alter table public.direct_conversations
            add constraint direct_conversations_users_different
            check (user_a <> user_b);
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'direct_conversations_user_a_fkey'
    ) then
        alter table public.direct_conversations
            add constraint direct_conversations_user_a_fkey
            foreign key (user_a) references profiles (user_id)
            on delete cascade;
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'direct_conversations_user_b_fkey'
    ) then
        alter table public.direct_conversations
            add constraint direct_conversations_user_b_fkey
            foreign key (user_b) references profiles (user_id)
            on delete cascade;
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'direct_conversations_user_pair_key'
    ) then
        alter table public.direct_conversations
            add constraint direct_conversations_user_pair_key
            unique (user_low, user_high);
    end if;
end;
$$;

create index if not exists direct_conversations_user_pair_idx
    on public.direct_conversations (user_low, user_high);

alter table public.direct_conversations enable row level security;

do $$
begin
    if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'direct_conversations'
          and policyname = 'Users can view their direct conversations'
    ) then
        drop policy "Users can view their direct conversations" on public.direct_conversations;
    end if;
end;
$$;

create policy "Users can view their direct conversations"
    on public.direct_conversations
    for select
    using (auth.uid() = user_a or auth.uid() = user_b);

do $$
begin
    if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'direct_conversations'
          and policyname = 'Users can create direct conversations'
    ) then
        drop policy "Users can create direct conversations" on public.direct_conversations;
    end if;
end;
$$;

create policy "Users can create direct conversations"
    on public.direct_conversations
    for insert
    with check (auth.uid() = user_a or auth.uid() = user_b);

do $$
begin
    if exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = 'direct_conversations'
          and policyname = 'Users can update direct conversations'
    ) then
        drop policy "Users can update direct conversations" on public.direct_conversations;
    end if;
end;
$$;

create policy "Users can update direct conversations"
    on public.direct_conversations
    for update
    using (auth.uid() = user_a or auth.uid() = user_b)
    with check (auth.uid() = user_a or auth.uid() = user_b);
