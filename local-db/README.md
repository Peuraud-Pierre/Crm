# Base de données locale — Nokk_project

Supabase complet en local (Postgres, Auth, Storage, Realtime, Studio) via
Docker, rempli de **données fictives**. Aucune connexion à la prod.

> Premier lancement pas à pas (installation, connexion, dépannage) :
> [`LANCEMENT.md`](../LANCEMENT.md). Ce fichier-ci décrit le fonctionnement de
> la base elle-même.

## Prérequis

- Docker Desktop lancé
- `pnpm install` (installe aussi le CLI `supabase` en devDependency)

## Lancer

```bash
pnpm db:start     # démarre la stack (1er lancement : télécharge les images)
pnpm dev:local    # front sur http://localhost:8082, branché sur la base locale
```

- Studio (explorer les tables) : http://127.0.0.1:54323
- Mails envoyés par l'auth (reset mot de passe…) : http://127.0.0.1:54324

Autres commandes : `pnpm db:reset` (remet schéma + données fictives à zéro),
`pnpm db:stop`.

## Comptes de test

Mot de passe commun : **`Nokk2026!`**

| Email                          | Rôle       | Service      |
| ------------------------------ | ---------- | ------------ |
| `admin@nokk-project.test`      | SuperAdmin | Direction    |
| `manager@nokk-project.test`    | Admin      | Direction    |
| `commercial@nokk-project.test` | Market     | Marketing    |
| `compta@nokk-project.test`     | Compta     | Comptabilité |
| `entrepot@nokk-project.test`   | Employé    | IT           |
| `rh@nokk-project.test`         | Employé    | RH           |

Chaque compte a la double authentification (TOTP) déjà activée, exigée par la
RLS du stock, des magasins et du packing. Au moment où l'app demande le code :

```bash
pnpm db:otp       # affiche le code à 6 chiffres courant
```

(ou ajouter le secret `JBSWY3DPEHPK3PXP` dans une app d'authentification.)

## Ce qu'il y a dedans

- `supabase/config.toml` : config locale (MFA TOTP activé, URLs du front).
- `supabase/migrations/20250101000000_baseline.sql` : schéma complet (tables,
  vues, fonctions, RLS, buckets, référentiels). **Généré**, ne pas éditer.
- `supabase/seed.sql` : utilisateurs, permissions, clients CRM, leads, devis,
  agenda, tâches, tickets, projets, arrivages, magasins, balles handpick,
  annonces, changelog, notifications.
- `supabase/seed/*.sql` : démos existantes du repo (commandes boutiques, salle
  de tri, wiki).
- `../.env.localdb` : variables du front en mode local (clés de démo publiques
  de `supabase start`, services externes neutralisés, clé Turnstile de test).

## Pourquoi une baseline plutôt que `supabase/migrations` ?

Une partie du schéma de prod a été créée à la main dans le dashboard et n'a
jamais été versionnée : rejouer `supabase/migrations` sur une base vide échoue
dès la première migration. `scripts/local-db/regen.sh` reconstruit donc le
schéma en rejouant les migrations, en complétant les tables manquantes depuis
`src/integrations/supabase/types.ts` et en ajoutant quelques fonctions jamais
versionnées (`scripts/local-db/prelude.sql`), puis fige le résultat dans la
baseline.

Relancer `bash scripts/local-db/regen.sh` (stack démarrée) quand
`supabase/migrations` ou `types.ts` évoluent.

## Limites connues

- Les types des colonnes créées depuis `types.ts` sont **devinés** (le TS ne
  distingue pas `uuid`/`text`/`timestamptz`). Si une page renvoie une erreur
  « invalid input syntax for type uuid », ajouter la colonne dans `OVERRIDES` de
  `scripts/local-db/fill_missing.py` puis relancer `regen.sh`.
- Une vingtaine d'anciennes migrations restent ignorées (SQL invalide appliqué à
  la main en prod, secrets requis, tables legacy supprimées depuis) : liste
  affichée par `regen.sh`.
- Les services externes (API Go : agenda Apple/Outlook, Matomo, PAKE, packing,
  newsletter, n8n) ne tournent pas en local : les écrans qui en dépendent
  affichent une erreur de chargement, le reste de l'app fonctionne.
- Les triggers et jobs `pg_cron` créés à la main en prod n'existent pas en local.
