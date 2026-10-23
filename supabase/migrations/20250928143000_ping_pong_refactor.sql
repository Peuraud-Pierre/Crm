-- Ping pong overhaul: tournaments, matches, leaderboard support

-- Relax match participant constraints -------------------------------------------------
alter table public.matches
    alter column player1_id drop not null,
    alter column player2_id drop not null;

-- Additional metadata for brackets ----------------------------------------------------
alter table public.matches
    add column if not exists round_number integer not null default 1,
    add column if not exists match_index integer not null default 0,
    add column if not exists player1_source_match_id uuid,
    add column if not exists player2_source_match_id uuid,
    add column if not exists score_details jsonb;

do $$
declare
    invalid_count integer;
begin
    if not exists (
        select 1 from pg_constraint where conname = 'matches_tournament_id_fkey'
    ) then
        select count(*)
        into invalid_count
        from public.matches m
        left join public.tournaments t on t.id = m.tournament_id
        where m.tournament_id is null or t.id is null;

        if coalesce(invalid_count, 0) = 0 then
            alter table public.matches
                add constraint matches_tournament_id_fkey
                    foreign key (tournament_id) references public.tournaments (id)
                    on delete cascade;
        else
            raise notice 'Skipping FK matches_tournament_id_fkey (% rows without tournament: %)',
                invalid_count > 0, invalid_count;
        end if;
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'matches_player1_source_match_id_fkey'
    ) then
        alter table public.matches
            add constraint matches_player1_source_match_id_fkey
                foreign key (player1_source_match_id) references public.matches (id)
                on delete set null;
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'matches_player2_source_match_id_fkey'
    ) then
        alter table public.matches
            add constraint matches_player2_source_match_id_fkey
                foreign key (player2_source_match_id) references public.matches (id)
                on delete set null;
    end if;
end;
$$;

-- Tournament rules -------------------------------------------------------------------
alter table public.tournaments
    add column if not exists points_per_game integer not null default 11,
    add column if not exists games_per_set integer not null default 3,
    add column if not exists sets_to_win integer not null default 2;

-- Tournament participants --------------------------------------------------------------
create table if not exists public.tournament_participants (
    id uuid not null default gen_random_uuid() primary key,
    tournament_id uuid not null references public.tournaments(id) on delete cascade,
    player_id uuid not null references public.profiles(user_id) on delete cascade,
    seed integer not null,
    created_at timestamp with time zone not null default now()
);

alter table public.tournament_participants enable row level security;

-- Indexes -----------------------------------------------------------------------------
create index if not exists idx_matches_tournament_round
    on public.matches (tournament_id, round_number, match_index);

create index if not exists idx_matches_source_matches
    on public.matches (player1_source_match_id, player2_source_match_id);

create index if not exists idx_tournament_participants_tournament
    on public.tournament_participants (tournament_id, seed);

-- Update ELO trigger to ignore placeholder matches ------------------------------------
create or replace function public.apply_elo_on_match()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  k_factor integer := 32;
  r1 float;
  r2 float;
  e1 float;
  e2 float;
  s1 float;
  s2 float;
  new_r1 integer;
  new_r2 integer;
  p1 record;
  p2 record;
  winner uuid;
begin
  if NEW.status <> 'completed' or NEW.elo_applied = true then
    return NEW;
  end if;

  if NEW.player1_id is null or NEW.player2_id is null then
    return NEW;
  end if;

  if COALESCE(NEW.player1_score, 0) > COALESCE(NEW.player2_score, 0) then
    winner := NEW.player1_id;
  elsif COALESCE(NEW.player2_score, 0) > COALESCE(NEW.player1_score, 0) then
    winner := NEW.player2_id;
  else
    -- draws are not supported, leave unchanged
    return NEW;
  end if;

  select * into p1 from public.ping_pong_players where user_id = NEW.player1_id limit 1;
  select * into p2 from public.ping_pong_players where user_id = NEW.player2_id limit 1;

  if p1 is null or p2 is null then
    return NEW;
  end if;

  r1 := power(10, p1.elo_rating / 400.0);
  r2 := power(10, p2.elo_rating / 400.0);
  e1 := r1 / (r1 + r2);
  e2 := r2 / (r1 + r2);

  s1 := case when winner = NEW.player1_id then 1 else 0 end;
  s2 := case when winner = NEW.player2_id then 1 else 0 end;

  new_r1 := round(p1.elo_rating + k_factor * (s1 - e1));
  new_r2 := round(p2.elo_rating + k_factor * (s2 - e2));

  update public.ping_pong_players
    set elo_rating = new_r1,
        wins = wins + (case when s1 = 1 then 1 else 0 end),
        losses = losses + (case when s1 = 0 then 1 else 0 end),
        updated_at = now()
    where id = p1.id;

  update public.ping_pong_players
    set elo_rating = new_r2,
        wins = wins + (case when s2 = 1 then 1 else 0 end),
        losses = losses + (case when s2 = 0 then 1 else 0 end),
        updated_at = now()
    where id = p2.id;

  NEW.elo_applied := true;
  NEW.played_at := coalesce(NEW.played_at, now());
  return NEW;
end;
$$;

-- RLS policies -----------------------------------------------------------------------
drop policy if exists "Players can create matches" on public.matches;
drop policy if exists "Players can update their matches" on public.matches;

create policy "Tournament members manage matches"
  on public.matches
  for insert
  with check (
    auth.uid() = (select created_by from public.tournaments where id = tournament_id)
  );

create policy "Tournament members update matches"
  on public.matches
  for update
  using (
    auth.uid() = (select created_by from public.tournaments where id = tournament_id)
      or auth.uid() = player1_id
      or auth.uid() = player2_id
  )
  with check (
    auth.uid() = (select created_by from public.tournaments where id = tournament_id)
      or auth.uid() = player1_id
      or auth.uid() = player2_id
  );

drop policy if exists "Everyone can view tournament participants" on public.tournament_participants;
drop policy if exists "Tournament owner manages participants" on public.tournament_participants;
drop policy if exists "Tournament owner updates participants" on public.tournament_participants;
drop policy if exists "Tournament owner removes participants" on public.tournament_participants;

create policy "Everyone can view tournament participants"
  on public.tournament_participants
  for select
  using (true);

create policy "Tournament owner manages participants"
  on public.tournament_participants
  for insert
  with check (
    auth.uid() = (select created_by from public.tournaments where id = tournament_id)
  );

create policy "Tournament owner updates participants"
  on public.tournament_participants
  for update
  using (
    auth.uid() = (select created_by from public.tournaments where id = tournament_id)
  )
  with check (
    auth.uid() = (select created_by from public.tournaments where id = tournament_id)
  );

create policy "Tournament owner removes participants"
  on public.tournament_participants
  for delete
  using (
    auth.uid() = (select created_by from public.tournaments where id = tournament_id)
  );

drop policy if exists "Tournament creators can update their tournaments" on public.tournaments;
do $$
begin
    create policy "Tournament owner manages tournaments"
      on public.tournaments
      for update
      using (auth.uid() = created_by)
      with check (auth.uid() = created_by);
exception
    when duplicate_object then
        null;
end;
$$;

do $$
begin
    create policy "Tournament owner deletes tournaments"
      on public.tournaments
      for delete
      using (auth.uid() = created_by);
exception
    when duplicate_object then
        null;
end;
$$;

-- Realtime ---------------------------------------------------------------------------
alter table public.tournament_participants replica identity full;

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'matches'
    ) then
        alter publication supabase_realtime add table public.matches;
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'tournaments'
    ) then
        alter publication supabase_realtime add table public.tournaments;
    end if;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'tournament_participants'
    ) then
        alter publication supabase_realtime add table public.tournament_participants;
    end if;
end;
$$;
