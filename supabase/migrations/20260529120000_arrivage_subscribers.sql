-- Table des abonnés à la newsletter arrivage.
-- Le service détermine la censure de l'Excel envoyé (cf. hiddenByService côté Go).
-- L'abonnement se fait via POST /arrivage/newsletter/subscribe avec un code d'invitation.

create table if not exists arrivage_subscribers (
    id            uuid primary key default gen_random_uuid(),
    email         text unique not null,
    service       text not null default 'default',
    active        boolean not null default true,
    subscribed_at timestamptz not null default now()
);

-- Index pour les requêtes fréquentes (abonnés actifs)
create index if not exists arrivage_subscribers_active_idx
    on arrivage_subscribers (active)
    where active = true;

-- Le backend Go se connecte via PUBLIC_DATABASE_URL_NOREPLY (connexion directe Postgres,
-- hors PostgREST). RLS non requis pour les accès Go, mais activé pour Supabase Studio.
alter table arrivage_subscribers enable row level security;

-- Seul le rôle service_role (backend) peut lire et modifier la table.
create policy "service_role full access"
    on arrivage_subscribers
    for all
    to service_role
    using (true)
    with check (true);
