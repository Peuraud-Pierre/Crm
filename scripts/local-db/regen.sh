#!/bin/bash
# Régénère local-db/supabase/migrations/20250101000000_baseline.sql.
#
# À relancer quand supabase/migrations ou src/integrations/supabase/types.ts
# évoluent. Prérequis : la stack locale tourne (`pnpm db:start`).
# Usage : bash scripts/local-db/regen.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
W="$(mktemp -d)"
DB=postgresql://postgres:postgres@127.0.0.1:54322/postgres
OUT="$REPO/local-db/supabase/migrations/20250101000000_baseline.sql"
cd "$REPO"

# 1. Base vide : même project_id que local-db (mêmes conteneurs), sans migration ni seed.
mkdir -p "$W/empty/supabase/migrations"
printf 'project_id = "nokk_project_local"\n[db.seed]\nenabled = false\n' > "$W/empty/supabase/config.toml"
pnpm exec supabase --workdir "$W/empty" db reset >/dev/null

# 2. Rejeu des migrations + complément depuis types.ts.
python3 -I "$HERE/parse_types.py" src/integrations/supabase/types.ts > "$W/schema.json"
grep -rhoiE "create table (if not exists )?(public\.)?\"?[A-Za-z_0-9]+" supabase/migrations \
    | sed -E 's/.*[ .]"?//' | sort -u > "$W/mig_tables.txt"
bash "$HERE/replay_migrations.sh" "$REPO" "$W"
echo "Migrations ignorées (historique invalide, secrets, legacy) : $W/failed_reasons.txt"

# 3. Dumps.
pnpm exec supabase --workdir "$W/empty" db dump --local --schema public -f "$W/schema_public.sql" >/dev/null
pnpm exec supabase --workdir "$W/empty" db dump --local --data-only --schema public -f "$W/data_public.sql" >/dev/null 2>&1
psql "$DB" -Atc "select pg_get_triggerdef(oid)||';' from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal" > "$W/auth_triggers.sql"
psql "$DB" -Atc "select format('insert into storage.buckets (id, name, public) values (%L, %L, %s) on conflict (id) do nothing;', id, name, public) from storage.buckets" > "$W/buckets.sql"
psql "$DB" -Atc "select format('create policy %I on storage.objects as %s for %s to %s%s%s;', policyname, permissive, cmd, array_to_string(roles, ', '), coalesce(' using ('||qual||')',''), coalesce(' with check ('||with_check||')','')) from pg_policies where schemaname='storage' and tablename='objects'" > "$W/storage_policies.sql"

# 4. Contrôle des types devinés, puis assemblage.
echo "Écarts de type migration/base (vérifier les uuid <-> text) :"
python3 -I "$HERE/typecheck.py" "$DB" | grep -E "uuid|text" | grep -vE "=(text|varchar) db=(text|varchar)" || true
python3 -I "$HERE/assemble_baseline.py" "$W" "$OUT"

# 5. Base locale remise dans son état normal (baseline + seed).
pnpm exec supabase --workdir local-db db reset >/dev/null
echo "OK — baseline régénérée, base locale réinitialisée."
