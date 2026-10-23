# 🏗️ Architecture du système CI/CD

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                       GitHub                                      │
│  ┌──────────┐                                                    │
│  │  Commit  │  ──(webhook)──>  VPS                               │
│  └──────────┘                                                    │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    github_webhook (Go)                           │
│  Port: 8088                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  1. Reçoit webhook GitHub                                │   │
│  │  2. Clone/Update repo                                    │   │
│  │  3. Parse ci.yaml                                        │   │
│  │  4. Exécute chaque step dans Docker                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Docker Runner                                │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │  Step: setup │ -> │ Step: build  │ -> │ Step: test   │    │
│  │  node:20     │    │  node:20     │    │  node:20     │    │
│  └──────────────┘    └──────────────┘    └──────────────┘    │
│                                                │                │
│                                                ▼                │
│                                         ┌──────────────┐       │
│                                         │ Step: deploy │       │
│                                         │  alpine:3.20 │       │
│                                         └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📂 Structure des dossiers (VPS)

```
/root/github_webhook/
├── main.go                      # Serveur webhook Go
├── handler.go                   # Handlers HTTP
├── struct.go                    # Structures de données
├── ws.go                        # WebSocket pour logs live
├── .global_env                  # Variables d'environnement globales
├── repos/                       # Repos clonés
│   └── nokk-dev/
│       └── Nokk_project/     # Repo local
│           ├── ci.yaml          # Pipeline de build
│           ├── node_modules/    # Dépendances (persistantes)
│           └── dist/            # Build output
├── cache/                       # Cache persistant entre builds
│   ├── node/                    # Cache npm (monté sur /root/.npm)
│   │   ├── _cacache/            # Cache npm interne
│   │   └── _npx/                # Cache npx
│   └── test-cache/              # Cache de résultats de tests
│       ├── abc123.success       # Marker de tests validés (commit hash)
│       └── def456.success
├── logs/                        # Logs de builds
│   ├── 20260211-091609.log
│   └── 20260211-102345.log
└── deploy_logs/                 # Historique des déploiements
    └── nokk-dev/
        └── Nokk_project/
            ├── Nokk_project-20260211-091620.log
            └── Nokk_project-20260211-102350.log
```

---

## 🐳 Montages Docker (Nokk_project)

### Montages automatiques ([main.go:171-193](main.go#L171-L193))

```go
// Montages de base pour tous les steps
-v {absWorkdir}:/workspace          // Repo local
-v /root/github_webhook/cache/node:/cache     // Cache partagé
-v /root/github_webhook/cache/node:/root/.npm // Cache npm

// Montages spécifiques Nokk_project
-v /var/www/html/preprod:/var/www/html/preprod:rw  // Dossier de déploiement
```

### Vue dans le conteneur

```
Conteneur Docker (step: setup)
├── /workspace/              → /root/github_webhook/repos/nokk-dev/Nokk_project
├── /cache/                  → /root/github_webhook/cache/node
├── /root/.npm/              → /root/github_webhook/cache/node (cache npm automatique)
└── /var/www/html/preprod/   → /var/www/html/preprod (dossier de déploiement)
```

---

## ⚡ Système de cache intelligent

### 1. Cache node_modules (pnpm-lock.yaml)

```yaml
# ci.yaml - Step: setup
LOCK_HASH=$(md5sum pnpm-lock.yaml | cut -d' ' -f1)
CACHE_MARKER="/cache/.last-install-${LOCK_HASH}"

if [ -f "$CACHE_MARKER" ]; then
  echo "✅ Cache npm valide, skip installation"
  exit 0
fi
```

**Fonctionnement** :
- Hash le `pnpm-lock.yaml` (ex: `abc123def456`)
- Vérifie si `/cache/.last-install-abc123def456` existe
- Si oui → **Skip l'installation** (gain ~30s)
- Si non → `pnpm install --frozen-lockfile` (store dans `/cache/pnpm-store`) + création du marker

### 2. Cache de tests (commit hash)

```yaml
# ci.yaml - Step: test_front
COMMIT_HASH=$(git rev-parse HEAD)
TEST_CACHE_MARKER="/cache/test-cache/${COMMIT_HASH}.success"

if [ -f "$TEST_CACHE_MARKER" ]; then
  echo "✅ Tests déjà validés"
  exit 0
fi
```

**Fonctionnement** :
- Récupère le hash du commit actuel (ex: `61aaa46`)
- Vérifie si `/cache/test-cache/61aaa46.success` existe
- Si oui → **Skip les tests** (gain ~12s)
- Si non → Exécution des tests + création du marker

---

## 🔄 Workflow complet

### Sur ton PC (développement)

```bash
# 1. Développement + commit
git add .
git commit -m "feat: nouvelle fonctionnalité"

# 2. Pre-push hook (automatique)
.githooks/pre-push
  ├─ Récupère le commit hash
  ├─ Vérifie le cache local (.git/test-cache/)
  ├─ Exécute les tests (npm run test:front)
  └─ Sauvegarde le résultat + sync vers VPS

# 3. Push vers GitHub
git push origin preprod
```

### Sur le VPS (CI/CD automatique)

```bash
# 1. Webhook reçu
github_webhook reçoit le webhook GitHub
  └─ Déclenche runPipeline()

# 2. Clone/Update du repo
ensureRepoCheckedOut()
  ├─ git fetch origin
  ├─ git checkout -B preprod origin/preprod
  └─ git reset --hard origin/preprod

# 3. Exécution du pipeline

## Step 1: setup (node:20-alpine)
runStep("setup")
  ├─ Montage: /cache, /root/.npm
  ├─ Vérification cache npm (hash lockfile)
  │   └─ Si cache OK → skip installation (2s)
  │   └─ Sinon → npm ci (30s)
  └─ Sauvegarde marker de cache

## Step 2: build (node:20-alpine)
runStep("build")
  ├─ npm run build
  └─ Génère dist/

## Step 3: test_front (node:20-alpine)
runStep("test_front")
  ├─ Vérification cache tests (commit hash)
  │   └─ Si cache OK → skip tests (1s)
  │   └─ Sinon → npm run test:front (12s)
  └─ Sauvegarde marker de tests

## Step 4: deploy (alpine:3.20)
runStep("deploy")
  ├─ Montage: /var/www/html/preprod
  ├─ rm -rf /var/www/html/preprod/*
  ├─ cp -r dist/* /var/www/html/preprod/
  └─ chown -R 33:33 /var/www/html/preprod
```

---

## 📊 Comparaison des performances

### ⏱️ Avant optimisations

```
Step: setup  → npm cache clean + npm ci       → 30s
Step: build  → npm run build                  → 15s
Step: test   → npm run test:front             → 12s
Step: deploy → cp + chown                     → 5s
────────────────────────────────────────────────────
Total:                                          62s
```

### ⚡ Après optimisations (cache chaud)

```
Step: setup  → Cache npm détecté, skip        → 2s
Step: build  → npm run build                  → 15s
Step: test   → Cache tests détecté, skip      → 1s
Step: deploy → cp + chown                     → 5s
────────────────────────────────────────────────────
Total:                                          23s

Gain: 39 secondes (63% plus rapide) 🚀
```

---

## 🔧 Variables d'environnement

### Définies dans le code Go

```go
cacheDir := "/root/github_webhook/cache/node"
envFile := "/root/github_webhook/.global_env"
deployPath := "/var/www/html/preprod"  // pour Nokk_project
```

### Injectées dans les conteneurs

```go
// Montages automatiques
-v {cacheDir}:/cache
-v {cacheDir}:/root/.npm

// Variables d'environnement du step
for key, value := range step.Environment {
  args = append(args, "-e", fmt.Sprintf("%s=%s", key, value))
}
```

---

## 🔒 Sécurité

### Commandes interdites ([main.go:107-111](main.go#L107-L111))

```go
forbidden := []string{
  "rm -rf /", "mkfs", "shutdown", "reboot",
  "dd if=", "mkfs.", "parted", "init 0",
  "mount ", "umount", "chown /", "chmod 777 /",
}
```

### Isolation Docker

```go
"--security-opt", "no-new-privileges:true",
"--cap-drop", "ALL",
"--tmpfs", "/tmp:rw,size=1g,mode=1777",
"--tmpfs", "/root/.cache:rw,size=512m,mode=1777",
```

---

## 🐛 Debugging

### Voir les logs d'un build

```bash
# Sur le VPS
tail -f /root/github_webhook/logs/{buildID}.log

# Via l'interface web
https://ci.nokk-project.example/
```

### Vérifier le cache

```bash
# Cache npm
ls -lh /root/github_webhook/cache/node/

# Cache de tests
ls -lh /root/github_webhook/cache/test-cache/

# Markers de cache npm
ls -lh /root/github_webhook/cache/node/.last-install-*
```

### Nettoyer le cache

```bash
# Supprimer le cache npm (force réinstallation)
rm -rf /root/github_webhook/cache/node/*

# Supprimer les vieux caches de tests (> 7 jours)
find /root/github_webhook/cache/test-cache -type f -mtime +7 -delete
```

---

## 📚 Ressources

- [ci.yaml](ci.yaml) - Configuration du pipeline
- [main.go](../github_webhook/main.go) - Code source du webhook
- [TESTS_CACHE.md](TESTS_CACHE.md) - Documentation du cache de tests
- [QUICKSTART_CACHE.md](QUICKSTART_CACHE.md) - Guide de démarrage rapide
