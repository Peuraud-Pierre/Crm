-- =====================================================================
-- Nokk_project — données FICTIVES pour la base locale.
-- Rejoué à chaque `pnpm db:reset`. Aucune donnée réelle.
--
-- Comptes (mot de passe commun : Nokk2026!) — voir local-db/README.md :
--   admin@nokk-project.test       SuperAdmin   Direction
--   manager@nokk-project.test     Admin        Direction
--   commercial@nokk-project.test  Market       Marketing
--   compta@nokk-project.test      Compta       Comptabilité
--   entrepot@nokk-project.test    Employé      IT
--   rh@nokk-project.test          Employé      RH
-- Chaque compte a un facteur TOTP vérifié (secret JBSWY3DPEHPK3PXP) :
-- `pnpm db:otp` affiche le code courant.
-- =====================================================================

set search_path = public, extensions;

-- ---------------------------------------------------------------------
-- Utilisateurs (auth.users → trigger handle_new_user → profiles)
-- ---------------------------------------------------------------------
create temporary table seed_users (n int, id uuid, email text, full_name text, role text, service text, phone text);
insert into seed_users values
    (1, '00000000-0000-4000-8000-000000000001', 'admin@nokk-project.test',      'Alex Martin',     'SuperAdmin', 'Direction',    '06 10 00 00 01'),
    (2, '00000000-0000-4000-8000-000000000002', 'manager@nokk-project.test',    'Camille Laurent', 'Admin',      'Direction',    '06 10 00 00 02'),
    (3, '00000000-0000-4000-8000-000000000003', 'commercial@nokk-project.test', 'Hugo Bernard',    'Market',     'Marketing',    '06 10 00 00 03'),
    (4, '00000000-0000-4000-8000-000000000004', 'compta@nokk-project.test',     'Léa Moreau',      'Compta',     'Comptabilité', '06 10 00 00 04'),
    (5, '00000000-0000-4000-8000-000000000005', 'entrepot@nokk-project.test',   'Nathan Petit',    'Employé',    'IT',           '06 10 00 00 05'),
    (6, '00000000-0000-4000-8000-000000000006', 'rh@nokk-project.test',         'Inès Garcia',     'Employé',    'RH',           '06 10 00 00 06');

insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
       crypt('Nokk2026!', gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}',
       jsonb_build_object('full_name', full_name, 'role', role),
       now() - interval '200 days', now(), '', '', '', ''
from seed_users;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 'email', now(), now(), now()
from seed_users;

-- TOTP vérifié, secret connu (dev local uniquement).
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
select gen_random_uuid(), id, 'Nokk_project local', 'totp', 'verified', now(), now(), 'JBSWY3DPEHPK3PXP'
from seed_users;

update public.profiles p
set role_id = r.id, service_id = s.id, status = 'active', phone = u.phone,
    privacy_accepted_at = now(), privacy_accepted_version = '1.0'
from seed_users u
join public.roles r on r.nom = case u.role when 'SuperAdmin' then 'SuperAdmin' else u.role end
join public.services s on s.nom = u.service
where p.user_id = u.id;

-- ---------------------------------------------------------------------
-- Permissions : SuperAdmin et Admin ont tout, les autres un sous-ensemble.
-- ---------------------------------------------------------------------
-- Codes lus par le front (router, guards) mais créés à la main en prod.
insert into public.permissions (code, label, category)
select c, c, split_part(c, '.', 1)
from unnest(array[
    'content.manage', 'content.view', 'crm.view', 'dashboard.view', 'journalsell.view', 'leads_stats.view',
    'manager.console', 'manager.view', 'matomo.view', 'messages.view', 'ping_pong.view', 'profile.view',
    'projects.view', 'reports.view', 'roles_services.view', 'stock.arrivage.export', 'stock.arrivage.newsletter.admin',
    'stock.arrivage.newsletter.view', 'stock.view', 'tickets.view', 'users.create', 'users.delete', 'users.update',
    'users.view', 'veille.admin', 'veille.view'
]) c
where not exists (select 1 from public.permissions p where p.code = c);

delete from public.roles_permissions where role_id not in (select id from public.roles);
insert into public.roles_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.nom in ('SuperAdmin', 'Admin')
   or p.code in ('dashboard.view', 'profile.view', 'messages.view', 'tickets.view', 'projects.view')
   or(r.nom = 'Market' and (p.code like 'crm.%' or p.code like 'newsletter%' or p.code in ('communication.view', 'wiki.view', 'bibliotheque.view', 'bibliotheque.manage')))
   or (r.nom = 'Compta' and (p.code like '%.view' or p.code like 'crm.%'))
   or (r.nom = 'Employé' and (p.code like 'stock%.view' or p.code like 'stock_handpick.%' or p.code in ('wiki.view', 'magasin.view', 'availability.manage')))
on conflict do nothing;

-- ---------------------------------------------------------------------
-- CRM : fournisseurs, types de produit, clients, leads
-- ---------------------------------------------------------------------
insert into public."Fournisseur_crm" (name) values
    ('Textil Recycling Nord'), ('Vintage Source BV'), ('Second Wave Ltd'), ('Fripes du Sud'), ('ReWear Polska');
insert into public."Type_product_CRM" (name) values
    ('Balle crème'), ('Balle premium'), ('Vrac au kilo'), ('Vestes en jean'), ('Sportswear 90s'), ('Cuir');

create temporary table seed_noms (i int, prenom text, nom text, ville text, societe text);
insert into seed_noms
select g,
       (array['Julien','Sarah','Thomas','Manon','Lucas','Chloé','Maxime','Emma','Antoine','Clara','Romain','Zoé','Kevin','Jade','Nicolas','Lina','Bastien','Louise','Yanis','Anaïs'])[1 + (g - 1) % 20],
       (array['Roux','Fournier','Girard','Bonnet','Dupuis','Lambert','Fontaine','Rousseau','Vincent','Muller','Lefèvre','Faure','André','Mercier','Blanc','Guérin','Boyer','Garnier','Chevalier','François'])[1 + (g * 7) % 20],
       (array['Paris','Lyon','Marseille','Lille','Bordeaux','Nantes','Toulouse','Rennes','Strasbourg','Montpellier','Bruxelles','Genève'])[1 + (g * 3) % 12],
       (array['Friperie','Vintage Store','Second Life','Le Grenier','Retro Shop','Kilo Corner','Old School','Mode Circulaire'])[1 + g % 8]
from generate_series(1, 40) g;

insert into public.client_crm (
    id, nom, societe, mail, telephone, localisation, depense, siret, collum, insta,
    message, prise_en_charge, closers, adresse_facturation, adresse_livraison, "numero_TVA",
    urgency, newsletter, brief, created_at, updated_at
)
select ('10000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
       prenom || ' ' || nom,
       societe || ' ' || ville,
       lower(translate(prenom, 'éèëï', 'eeei')) || '.' || lower(translate(nom, 'éèëç', 'eeec')) || '@client.test',
       '07 ' || lpad((10 + i)::text, 2, '0') || ' ' || lpad((i * 13 % 100)::text, 2, '0') || ' 00 00',
       ville,
       round((random() * 25000)::numeric, 2),
       lpad((123456789 + i)::text, 9, '0') || '00011',
       (i % 9),
       '@' || lower(replace(societe, ' ', '')) || i,
       'Recherche des balles ' || (array['crème','premium','sportswear','jean'])[1 + i % 4] || ' pour la boutique.',
       (now() - (i || ' days')::interval)::text,
       (array['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003']::uuid[])[1 + i % 2],
       i || ' rue des Lilas, ' || ville,
       jsonb_build_object('adresse', i || ' rue des Lilas', 'ville', ville, 'pays', 'France'),
       'FR' || lpad((10000000000 + i)::text, 11, '0'),
       (array['normale','haute','élevée'])[1 + i % 3],
       i % 3 = 0,
       jsonb_build_object('budget', (1 + i % 5) * 1000, 'categories', jsonb_build_array('crème', 'jean')),
       now() - ((i * 5) || ' days')::interval,
       now() - ((i % 10) || ' days')::interval
from seed_noms;

insert into public.leads (id, name, email, phone, message, location, activity, experience, arrivance, budget, distance_km, city_found, urgency, created_at)
select g,
       'Prospect ' || g,
       'prospect' || g || '@lead.test',
       '06 50 ' || lpad(g::text, 2, '0') || ' 00 00',
       'Bonjour, je souhaite ouvrir une friperie et commander mes premières balles.',
       (array['Paris','Lyon','Nantes','Lille','Bordeaux'])[1 + g % 5],
       (array['Boutique physique','Vente en ligne','Marchés','Dépôt-vente'])[1 + g % 4],
       (array['Débutant','1-3 ans','3 ans et plus'])[1 + g % 3],
       (array['Instagram','Google','Bouche-à-oreille','Salon'])[1 + g % 4],
       (array['< 1 000 €','1 000 - 5 000 €','> 5 000 €'])[1 + g % 3],
       (g * 37 % 600),
       (array['Paris','Lyon','Nantes','Lille','Bordeaux'])[1 + g % 5],
       (array['normale','haute'])[1 + g % 2],
       now() - (g || ' days')::interval
from generate_series(1, 25) g;

insert into public."Client_activite" (client, date, title, content, owner)
select c.id, current_date - (g * 3), (array['Appel','Email','Visite','Relance'])[1 + g % 4],
       'Échange avec le client : intérêt pour une commande de ' || (2 + g % 6) || ' balles.',
       '00000000-0000-4000-8000-000000000003'
from public.client_crm c cross join generate_series(1, 3) g
where c.collum < 6;

-- ---------------------------------------------------------------------
-- Devis + lignes
-- ---------------------------------------------------------------------
insert into public."Devis" (id, by, client, "Tableau_id", poid, "totalHT", "TVA", "totalTVA", "totalTTC", termes, status, paiement, service, "Date_crea", "Date_end", name, "Livraison", "Archive", "Avoir", "Remise", urgence)
select ('20000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
       '00000000-0000-4000-8000-000000000003',
       ('10000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
       ('21000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
       45 * (1 + i % 5) * 10,
       ht, 20, round(ht * 0.2, 2), round(ht * 1.2, 2),
       'Paiement à 30 jours',
       (array['Brouillon','Envoyé','Accepté','Refusé'])[1 + i % 4],
       (array['Virement','Carte','Espèces'])[1 + i % 3],
       'Commerce',
       to_char(current_date - i * 4, 'YYYY-MM-DD'),
       to_char(current_date - i * 4 + 30, 'YYYY-MM-DD'),
       'DEV-2026-' || lpad(i::text, 4, '0'),
       (array['Retrait entrepôt','Livraison transporteur'])[1 + i % 2],
       false, 0, '0', (array['normale','haute','élevée'])[1 + i % 3]
from (select i, round((450 * (1 + i % 5) * 3.2)::numeric, 2) as ht from generate_series(1, 24) i) s;

insert into public.tableau_devis (id, id_tab, number, produit, description, qty, poid, prix, "totalHT", "TVA", mode)
select ('21000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid, i, 1,
       (array['Balle crème','Balle premium','Vestes en jean','Sportswear 90s'])[1 + i % 4],
       'Balle de 45 kg triée', 1 + i % 5, 45 * (1 + i % 5), 3.2, round((450 * (1 + i % 5) * 3.2)::numeric, 2), 20, 'kg'
from generate_series(1, 24) i;

-- ---------------------------------------------------------------------
-- Agenda + tâches CRM
-- ---------------------------------------------------------------------
insert into public."Event_calendar" (id, customer, nom, debut, fin, client, lieu, description, id_client, creator_id, show, why, source, confirmed)
select ('30000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
       (array['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003']::uuid[])[1 + g % 2],
       (array['Visite entrepôt','Rendez-vous client','Appel découverte','Livraison'])[1 + g % 4],
       date_trunc('hour', now()) + ((g - 10) || ' days')::interval + ((9 + g % 8) || ' hours')::interval,
       date_trunc('hour', now()) + ((g - 10) || ' days')::interval + ((10 + g % 8) || ' hours')::interval,
       c.nom, 'Entrepôt Nokk_project', 'Présentation des nouveaux arrivages.', c.id,
       '00000000-0000-4000-8000-000000000003', true,
       (array['Découverte','Commande','Réclamation'])[1 + g % 3], 'crm', g % 2 = 0
from generate_series(1, 20) g
join public.client_crm c on c.id = ('10000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid;

insert into public."Tache_crm" (type, client, content, valide, owner, date, placement, categorie, creator_id)
select (array['Appel','Relance','Email','Devis'])[1 + g % 4],
       ('10000000-0000-4000-8000-' || lpad((1 + g % 40)::text, 12, '0'))::uuid,
       'Relancer le client concernant sa dernière commande.',
       g % 3 = 0,
       (array['00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003']::uuid[])[1 + g % 2],
       current_date + (g - 8),
       'todo', (array['Commercial','Administratif'])[1 + g % 2],
       '00000000-0000-4000-8000-000000000002'
from generate_series(1, 30) g;

-- ---------------------------------------------------------------------
-- Tickets support
-- ---------------------------------------------------------------------
insert into public.tickets (user_id, assigned_to, service, subject, description, status, created_at)
select (select id from seed_users where n = 1 + g % 6),
       '00000000-0000-4000-8000-000000000005',
       (array['Tech','Commerce','Informatique','RH'])[1 + g % 4],
       (array['Imprimante étiquettes HS','Accès CRM','Demande de congés','Scanner bloqué','Nouveau poste'])[1 + g % 5],
       'Description détaillée du problème rencontré (donnée fictive).',
       (array['Envoyé','Reçu','Traité','Terminé'])[1 + g % 4],
       now() - (g || ' days')::interval
from generate_series(1, 15) g;

-- ---------------------------------------------------------------------
-- Projets (équipes, sprints, tâches)
-- ---------------------------------------------------------------------
insert into public.project_teams (id, name, description, owner_id) values
    ('40000000-0000-4000-8000-000000000001', 'Refonte site e-commerce', 'Nouvelle boutique en ligne B2B', '00000000-0000-4000-8000-000000000001'),
    ('40000000-0000-4000-8000-000000000002', 'Optimisation entrepôt', 'Réorganisation des zones de stockage', '00000000-0000-4000-8000-000000000002');
insert into public.project_team_members (team_id, user_id, role)
select t, u.id, case when u.n <= 2 then 'admin' else 'member' end
from unnest(array['40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002']::uuid[]) t
cross join seed_users u
on conflict do nothing;
insert into public.project_sprints (id, team_id, name, goal, status, start_date, end_date, created_by) values
    ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'Sprint 1', 'Maquettes et catalogue', 'completed', now() - interval '28 days', now() - interval '14 days', '00000000-0000-4000-8000-000000000001'),
    ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'Sprint 2', 'Tunnel de commande', 'active', now() - interval '14 days', now(), '00000000-0000-4000-8000-000000000001'),
    ('41000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', 'Sprint A', 'Plan des zones', 'active', now() - interval '7 days', now() + interval '7 days', '00000000-0000-4000-8000-000000000002');
insert into public.project_tasks (sprint_id, title, description, status, assignee_id, created_by, position, due_date, priority)
select (array['41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000003']::uuid[])[1 + g % 3],
       (array['Maquette page produit','Import catalogue','Paiement CB','Étiquetage zones','Inventaire allée B','Tests de charge'])[1 + g % 6] || ' #' || g,
       'Tâche de démonstration.',
       (array['todo','in_progress','review','done']::project_task_status[])[1 + g % 4],
       (select id from seed_users where n = 1 + g % 6),
       '00000000-0000-4000-8000-000000000001', g,
       now() + ((g % 10) || ' days')::interval,
       (array['Urgent','Haute','Normal','Basse']::"Priorities"[])[1 + g % 4]
from generate_series(1, 18) g;

-- ---------------------------------------------------------------------
-- Stock : arrivages
-- ---------------------------------------------------------------------
insert into public.arrivage_manuel (container_no, status, transport_mode, departure_date, port_arrival_date, total_weight_kg, total_qty, received_date, notes, invoice_no, invoice_date, prev_dechargement_at)
select 'NOKU' || lpad((1000000 + g * 137)::text, 7, '0'),
       (array['planifié','en_transit','déchargé','reçu'])[1 + g % 4],
       (array['Maritime','Routier'])[1 + g % 2],
       current_date - (40 - g * 3), current_date - (10 - g * 2),
       18000 + g * 450, 400 + g * 10,
       case when g % 4 = 3 then current_date - (5 - g) end,
       'Arrivage de démonstration', 'FAC-' || (2600 + g), current_date - (45 - g * 3),
       now() + ((g - 5) || ' days')::interval
from generate_series(1, 12) g;

-- ---------------------------------------------------------------------
-- Magasins / boutiques
-- ---------------------------------------------------------------------
insert into public.magasins (code, nom, adresse, ville, largeur, profondeur, notes, created_by) values
    ('PAR1', 'Nokk_project Paris Oberkampf', '12 rue Oberkampf', 'Paris', 12, 25, 'Boutique pilote', '00000000-0000-4000-8000-000000000001'),
    ('LYO1', 'Nokk_project Lyon Croix-Rousse', '8 boulevard de la Croix-Rousse', 'Lyon', 10, 18, null, '00000000-0000-4000-8000-000000000001'),
    ('LIL1', 'Nokk_project Lille Centre', '3 rue de Béthune', 'Lille', 9, 20, null, '00000000-0000-4000-8000-000000000001');
insert into public.boutiques (nom, code, adresse) values
    ('Boutique Paris', 'PAR', '12 rue Oberkampf, Paris'),
    ('Boutique Lyon', 'LYO', '8 boulevard de la Croix-Rousse, Lyon'),
    ('Boutique Lille', 'LIL', '3 rue de Béthune, Lille')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Communication : annonces, actus, changelog, notifications
-- ---------------------------------------------------------------------
insert into public.annonce (titre, type, description, excerpt, body_markdown, start_date, end_date, pinned, author_id, event_date) values
    ('Bienvenue sur Nokk_project', 'news', 'Votre nouvel outil interne.', 'Votre nouvel outil interne.', '# Bienvenue\n\nCeci est une **base locale** remplie de données fictives.', current_date - 10, current_date + 60, true, '00000000-0000-4000-8000-000000000001', null),
    ('Inventaire annuel', 'event', 'Inventaire complet de l''entrepôt.', 'Inventaire complet le mois prochain.', 'Merci de bloquer la journée.', current_date, current_date + 30, false, '00000000-0000-4000-8000-000000000002', current_date + 25),
    ('Version 3.0 déployée', 'release', 'Nouveau module stock.', 'Nouveau module stock.', 'Découvrez le plan 3D de l''entrepôt.', current_date - 3, current_date + 20, false, '00000000-0000-4000-8000-000000000001', null);

insert into public."News" (title, content, start_date, end_date) values
    ('Nouvel arrivage premium', 'Trois conteneurs arrivent cette semaine.', current_date - 2, current_date + 14),
    ('Fermeture exceptionnelle', 'L''entrepôt sera fermé le 1er novembre.', current_date, current_date + 10);

insert into public.changelog_categories (name, color, icon, position) values
    ('Nouveautés', '#16a34a', 'sparkles', 1), ('Corrections', '#dc2626', 'bug', 2), ('Améliorations', '#2563eb', 'wrench', 3);
insert into public.changelog_versions (id, version, deployment_date, status, summary, created_by) values
    ('50000000-0000-4000-8000-000000000001', '3.0.0', current_date - 3, 'published', 'Module stock et plan 3D', '00000000-0000-4000-8000-000000000001'),
    ('50000000-0000-4000-8000-000000000002', '3.1.0', current_date + 7, 'draft', 'Newsletter clients', '00000000-0000-4000-8000-000000000001');
insert into public.changelog_items (version_id, category_id, title, description, position)
select v, c.id, c.name || ' — élément ' || g, 'Description de démonstration.', g
from unnest(array['50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002']::uuid[]) v
cross join public.changelog_categories c
cross join generate_series(1, 2) g;

insert into public.notification (user_id, type, title, read, url, icon)
select u.id, (array['crm','stock','ticket'])[1 + g % 3],
       (array['Nouveau lead reçu','Arrivage en transit','Ticket mis à jour'])[1 + g % 3],
       g % 2 = 0, '/', 'bell'
from seed_users u cross join generate_series(1, 4) g;

-- ---------------------------------------------------------------------
-- Stock : référentiels (catégories, fournisseurs) — requis par seed/*.sql
-- ---------------------------------------------------------------------
insert into public.categories_gestion (name, tag, unit_price, unit_weight) values
    ('Crème femme', 'CRF', 4.5, 45), ('Crème homme', 'CRH', 4.2, 45), ('Jean', 'JEA', 3.8, 45),
    ('Sportswear', 'SPO', 5.1, 45), ('Vestes cuir', 'CUI', 7.9, 45), ('Pulls laine', 'PUL', 3.5, 45),
    ('Robes vintage', 'ROB', 6.0, 45), ('Vrac', 'VRA', 1.2, 300);
insert into public.fournisseur_gestion (name, siege_localisation, tag) values
    ('Textil Recycling Nord', 'Belgique', 'TRN'), ('Vintage Source BV', 'Pays-Bas', 'VSB'),
    ('Second Wave Ltd', 'Royaume-Uni', 'SWL'), ('Fripes du Sud', 'France', 'FDS'), ('ReWear Polska', 'Pologne', 'RWP');

insert into public.categories_handpick (name, tag, unit_price, unit_weight, created_by)
select name, tag, unit_price, unit_weight, '00000000-0000-4000-8000-000000000001' from public.categories_gestion;
insert into public.fournisseurs_handpick (name, siege_localisation, tag, created_by)
select name, siege_localisation, tag, '00000000-0000-4000-8000-000000000001' from public.fournisseur_gestion;

insert into public.balles_handpick (packing, packing_mode, import_date, fournisseur_id, category_id, raw_name, provenance, status, type, emplacement_id, placed_at, purchase_price, created_by)
select 45, 'balle', current_date - (g % 60),
       (select id from public.fournisseurs_handpick order by name offset (g % 5) limit 1),
       (select id from public.categories_handpick order by name offset (g % 8) limit 1),
       'BALLE-' || lpad(g::text, 4, '0'),
       (array['Belgique','Pays-Bas','Royaume-Uni','France','Pologne'])[1 + g % 5],
       (array['stocked','stocked','stocked','used','delivered'])[1 + g % 5],
       'handpick',
       (select id from public.emplacements_handpick order by code offset (g % 92) limit 1),
       now() - ((g % 30) || ' days')::interval,
       150 + (g % 7) * 25,
       '00000000-0000-4000-8000-000000000005'
from generate_series(1, 80) g;
