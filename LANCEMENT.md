# Lancer Nokk_project en local

Ce guide part d'une machine vierge et va jusqu'à l'application ouverte dans le
navigateur, connectée à une base de données locale remplie de **données
fictives**. Rien ne touche la production.

Durée : ~10 minutes la première fois (téléchargement des images Docker), puis
moins d'une minute.

---

## 1. Ce qu'il faut installer

| Outil              | Version                     | Vérifier avec      |
| ------------------ | --------------------------- | ------------------ |
| **Node.js**        | 26 (voir `.nvmrc`)          | `node -v`          |
| **pnpm**           | 12 (`packageManager`)       | `pnpm -v`          |
| **Docker Desktop** | récent, **lancé**           | `docker info`      |

Installation rapide (macOS, avec Homebrew) :

```bash
brew install nvm && nvm install 26 && nvm use 26   # ou https://nodejs.org
corepack enable                                    # active pnpm à la bonne version
brew install --cask docker                         # puis ouvrir Docker Desktop
```

Sous Windows : WSL2 + Docker Desktop, puis les mêmes commandes dans le terminal
WSL. Sous Linux : Docker Engine suffit.

> Le CLI Supabase n'est **pas** à installer à part : il est dans les
> dépendances du projet (`pnpm exec supabase …`).

---

## 2. Installer le projet

```bash
git clone <url-du-depot> nokk-project
cd nokk-project
pnpm install
```

---

## 3. Démarrer la base de données locale

Docker Desktop doit être ouvert.

```bash
pnpm db:start
```

La première fois, le CLI télécharge les images Supabase (~2 Go) puis crée la
base : schéma complet + données fictives. À la fin, il affiche les URLs :

| Service                         | URL                       |
| ------------------------------- | ------------------------- |
| API Supabase                    | http://127.0.0.1:54321    |
| Studio (explorer les tables)    | http://127.0.0.1:54323    |
| Boîte mail de test (Mailpit)    | http://127.0.0.1:54324    |
| Postgres direct                 | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

---

## 4. Démarrer l'application

```bash
pnpm dev:local
```

Ouvrir **http://localhost:8082**.

`dev:local` charge `.env.localdb` : le front parle à la base locale et tous les
services externes (API Go, PAKE, n8n, newsletter…) sont désactivés. La commande
`pnpm dev` classique, elle, utilise `.env` (les vrais serveurs) — ne pas la
confondre.

---

## 5. Se connecter

1. Email **`admin@nokk-project.test`**, mot de passe **`Nokk2026!`**.
2. L'application demande un **code à 6 chiffres** (double authentification,
   obligatoire pour le stock, les magasins et le packing). Dans un second
   terminal :

   ```bash
   pnpm db:otp
   # Code TOTP : 482913  (valide encore 17s)
   ```

   Saisir le code avant qu'il expire (30 s). Alternative : ajouter le secret
   `JBSWY3DPEHPK3PXP` dans Google Authenticator, 1Password, etc.

Tous les comptes de test (même mot de passe, même secret TOTP) :

| Email                          | Rôle       | Ce qu'il voit                         |
| ------------------------------ | ---------- | ------------------------------------- |
| `admin@nokk-project.test`      | SuperAdmin | tout                                  |
| `manager@nokk-project.test`    | Admin      | tout                                  |
| `commercial@nokk-project.test` | Market     | CRM, newsletter, wiki, bibliothèque   |
| `compta@nokk-project.test`     | Compta     | CRM et écrans en lecture              |
| `entrepot@nokk-project.test`   | Employé    | stock, handpick, magasins, wiki       |
| `rh@nokk-project.test`         | Employé    | idem                                  |

---

## 6. Ce qu'il y a dans la base

Toutes les données sont inventées :

- **CRM** : ~60 clients, 25 leads, 24 devis (avec lignes), agenda sur 3
  semaines, 30 tâches, historique d'activité ;
- **Stock** : 12 arrivages (tous statuts), catégories et fournisseurs, 80
  balles handpick placées sur le plan de l'entrepôt, commandes boutiques,
  ~40 fiches de salle de tri ;
- **Magasins** (3), **projets** (2 équipes, 3 sprints, 18 tâches), **tickets**,
  **wiki** (~20 articles), **annonces**, **changelog**, **notifications**.

---

## 7. Commandes du quotidien

| Commande          | Effet                                                         |
| ----------------- | ------------------------------------------------------------- |
| `pnpm db:start`   | démarre la base (à refaire après un redémarrage de Docker)    |
| `pnpm dev:local`  | lance le front sur la base locale                             |
| `pnpm db:otp`     | affiche le code de double authentification                    |
| `pnpm db:reset`   | **efface tout** et remet schéma + données fictives à neuf     |
| `pnpm db:stop`    | arrête la base (les données sont conservées)                  |

---

## 8. En cas de problème

| Symptôme                                                       | Cause / solution                                                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `Cannot connect to the Docker daemon`                          | Docker Desktop n'est pas lancé. L'ouvrir, attendre la baleine fixe, relancer `pnpm db:start`.                         |
| `port 54321 already in use`                                    | Une autre stack Supabase tourne : `pnpm exec supabase stop --all`, puis `pnpm db:start`.                             |
| Port 8082 occupé                                               | Un autre `pnpm dev` tourne déjà : l'arrêter (Ctrl+C) ou fermer l'onglet terminal.                                    |
| Le code TOTP est refusé                                        | Code expiré : relancer `pnpm db:otp` et taper vite. Vérifier aussi que l'heure de la machine est synchronisée.      |
| « MFA verification is disabled »                               | La config a changé sans redémarrage : `pnpm db:stop && pnpm db:start`.                                               |
| Page blanche / requêtes bloquées (CSP) dans la console         | Lancé avec `pnpm dev` au lieu de `pnpm dev:local`.                                                                   |
| Erreur de chargement agenda Apple/Outlook, Matomo, newsletter  | Normal : ces écrans appellent l'API Go, qui ne tourne pas en local.                                                  |
| « invalid input syntax for type uuid » dans une page           | Type de colonne mal deviné dans la base locale : voir `local-db/README.md` § Limites.                               |
| Données abîmées après des tests                                | `pnpm db:reset`.                                                                                                     |

---

## 9. Pour aller plus loin

- `local-db/README.md` : fonctionnement de la base locale, régénération du
  schéma (`scripts/local-db/regen.sh`) quand `supabase/migrations` ou
  `src/integrations/supabase/types.ts` évoluent.
- `CLAUDE.md` et `docs/` : règles d'architecture avant de coder.
- Avant de commiter : `pnpm lint` et `pnpm typecheck` doivent passer.
