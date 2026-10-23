#!/bin/bash
# Rejoue supabase/migrations sur une base vide, complète depuis types.ts, jusqu'au point fixe.
# usage: replay_migrations.sh <repo> <workdir>  (appelé par regen.sh)
HERE="$(cd "$(dirname "$0")" && pwd)"; cd "$1"; S="$2"; DB=postgresql://postgres:postgres@127.0.0.1:54322/postgres
apply() { psql "$DB" -q -v ON_ERROR_STOP=1 --single-transaction -f "$1" >/dev/null 2>"$S/err.txt"; }
pass() { : > "$2"; while IFS= read -r f; do apply "$f" || echo "$f" >> "$2"; done < "$1"; }
fill() { python3 -I "$HERE/fill_missing.py" "$S/schema.json" "$DB" tables $1 > "$S/fill.sql"; psql "$DB" -q -f "$S/fill.sql" >/dev/null 2>>"$S/fill_err.txt"; }
psql "$DB" -q -v ON_ERROR_STOP=1 -f "$HERE/prelude.sql" || exit 1
: > "$S/fill_err.txt"
ls supabase/migrations/*.sql > "$S/all.txt"
pass "$S/all.txt" "$S/failed.txt"; echo "pass0 failed: $(wc -l < $S/failed.txt)"
for mode in exclude all; do
  for i in 1 2 3 4 5 6; do
    [ $mode = exclude ] && fill "$S/mig_tables.txt" || fill
    before=$(wc -l < "$S/failed.txt"); cp "$S/failed.txt" "$S/todo.txt"
    pass "$S/todo.txt" "$S/failed.txt"; after=$(wc -l < "$S/failed.txt")
    echo "$mode iter $i: $before -> $after"
    [ "$after" -ge "$before" ] && break
  done
done
# Tables pré-remplies par le filler alors qu'une migration sait les créer : on rejoue la migration.
for round in 1 2; do
  cp "$S/failed.txt" "$S/todo.txt"; : > "$S/failed.txt"
  while IFS= read -r f; do
    apply "$f" && continue
    t=$(grep -m1 -oE 'relation "[A-Za-z_0-9]+" already exists' "$S/err.txt" | cut -d'"' -f2)
    if [ -n "$t" ] && printf '%s\n' "begin;" "drop table public.\"$t\" cascade;" "\\i $f" "commit;" | psql "$DB" -q -v ON_ERROR_STOP=1 >/dev/null 2>&1; then echo "  recreated $t via $(basename $f)"; else echo "$f" >> "$S/failed.txt"; fi
  done < "$S/todo.txt"
  fill
done
pass "$S/all.txt" "$S/final_failed.txt"; echo "final ordered pass (non-idempotent reruns fail normally): $(wc -l < $S/final_failed.txt)"
fill
python3 -I "$HERE/fill_missing.py" "$S/schema.json" "$DB" views > "$S/views.sql"; psql "$DB" -q -f "$S/views.sql" 2>&1 | grep ERROR
python3 -I "$HERE/fill_missing.py" "$S/schema.json" "$DB" funcs > "$S/funcs.txt"; echo "missing funcs: $(wc -l < $S/funcs.txt)"
echo "fill errors: $(grep -c ERROR $S/fill_err.txt)"
for f in $(cat "$S/failed.txt"); do apply "$f"; echo "$(basename $f) :: $(grep -m1 ERROR $S/err.txt | sed 's/^psql:[^E]*//')"; done > "$S/failed_reasons.txt"
