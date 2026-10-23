"""Assemble la migration de base de local-db/ à partir des dumps de regen.sh.

usage: assemble_baseline.py <workdir> <fichier de sortie>
"""
import re, sys

W, out = sys.argv[1], sys.argv[2]


def read(name):
    return open(f"{W}/{name}", encoding="utf-8").read()


# Données posées par les migrations qu'on ne garde pas : profils orphelins de
# démo, prénoms réels (analytics), journaux.
SKIP = {"profiles", "analytics_export_collaborators", "activity_log_handpick", "pg_net_watchdog_state"}
kept = []
for block in re.split(r"(?m)^(?=INSERT INTO )", read("data_public.sql")):
    m = re.match(r'INSERT INTO "public"\."([^"]+)"', block)
    if m and m.group(1) not in SKIP:
        kept.append(re.split(r"\n\n", block, maxsplit=1)[0].rstrip() + "\n")

buckets = re.sub(r", t\) on conflict", ", true) on conflict", read("buckets.sql"))
buckets = re.sub(r", f\) on conflict", ", false) on conflict", buckets)
triggers = read("auth_triggers.sql")
triggers = triggers.replace("FUNCTION handle_new_user", "FUNCTION public.handle_new_user")
triggers = triggers.replace("FUNCTION sync_last_login", "FUNCTION public.sync_last_login")

SEP = "-- ---------------------------------------------------------------------\n"
sql = f"""-- =====================================================================
-- Nokk_project — schéma de base pour Supabase LOCAL (dev uniquement).
--
-- Généré par scripts/local-db/regen.sh : rejeu de supabase/migrations +
-- complément depuis src/integrations/supabase/types.ts pour les tables créées
-- à la main dans le dashboard de prod (jamais versionnées). Ne pas éditer à la
-- main, ne pas appliquer en prod.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

do $$ begin create role content_generation nologin; exception when duplicate_object then null; end $$;

{read("schema_public.sql")}
SET search_path = public, extensions;

{SEP}-- Triggers sur auth.users
{SEP}{triggers}
{SEP}-- Storage : buckets + policies
{SEP}{buckets}{read("storage_policies.sql")}
{SEP}-- Données de référence (rôles, services, permissions, référentiels)
{SEP}SET session_replication_role = replica;

{chr(10).join(kept)}
SET session_replication_role = origin;
"""
open(out, "w", encoding="utf-8").write(sql)
print(f"{out}: {len(kept)} blocs de données")
