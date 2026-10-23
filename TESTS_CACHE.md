# 🧪 Système de Cache de Tests Distribué

Ce projet utilise un **système de cache de tests intelligent** qui permet d'exécuter les tests sur votre PC puissant, et de les skip sur le VPS si déjà validés.

## 🎯 Principe

```
[Commit local] → [Tests sur PC] → [Push + cache] → [VPS skip tests si déjà OK]
```

### Avantages
- ⚡ **Gain de temps** : Tests exécutés une seule fois (sur le PC le plus puissant)
- 💰 **Économie de ressources** : Le VPS ne lance les tests que si nécessaire
- 🚀 **Feedback rapide** : Détection des erreurs avant le push

---

## 🔧 Installation (première fois)

### 1. Installer les hooks Git
```bash
./scripts/setup-hooks.sh
```

Cela configure le hook `pre-push` qui exécutera automatiquement les tests avant chaque `git push`.

### 2. (Optionnel) Configurer la synchronisation automatique

Pour synchroniser automatiquement le cache avec le VPS :

```bash
# Configurer l'accès SSH au VPS (une seule fois)
ssh-copy-id root@nokk-project.example

# Le hook pre-push synchronisera automatiquement le cache
```

---

## 📖 Utilisation

### Workflow normal
```bash
git add .
git commit -m "feat: nouvelle fonctionnalité"
git push origin preprod
```

**Ce qui se passe :**
1. Le hook `pre-push` détecte le push
2. Il vérifie si les tests ont déjà été exécutés pour ce commit
3. Si non → Exécution des tests sur ton PC
4. Si succès → Sauvegarde du résultat + synchronisation vers VPS
5. Le push continue normalement
6. Sur le VPS, le CI détecte le cache et **skip les tests**

### Bypass temporaire (si nécessaire)
```bash
# Skip le hook pre-push (déconseillé)
git push --no-verify
```

### Synchronisation manuelle du cache
```bash
# Pousser manuellement le cache vers le VPS
./scripts/sync-test-cache.sh
```

---

## 🧹 Nettoyage du cache local

```bash
# Supprimer le cache local de tests
rm -rf .git/test-cache

# Sur le VPS, nettoyer les vieux caches (> 7 jours)
ssh root@nokk-project.example 'find /root/github_webhook/cache/test-cache -type f -mtime +7 -delete'
```

---

## 🔍 Vérification du statut

### Voir les caches locaux
```bash
ls -lh .git/test-cache/
```

### Voir les caches sur le VPS
```bash
ssh root@nokk-project.example 'ls -lh /root/github_webhook/cache/test-cache/'
```

---

## 🐛 Dépannage

### Les tests ne se lancent plus localement
```bash
# Vérifier que le hook est bien installé
ls -la .git/hooks/pre-push
# ou
ls -la .githooks/pre-push

# Réinstaller les hooks
./scripts/setup-hooks.sh
```

### Le VPS lance toujours les tests malgré le cache
```bash
# Vérifier que le cache est bien synchronisé
./scripts/sync-test-cache.sh

# Vérifier le commit hash actuel
git rev-parse HEAD

# Vérifier si le cache existe sur le VPS
ssh root@nokk-project.example 'ls /root/github_webhook/cache/test-cache/'
```

---

## ⚙️ Configuration avancée

### Variables d'environnement disponibles

```bash
# Activer/désactiver la synchronisation automatique
export PUSH_TEST_CACHE=true  # false pour désactiver

# Changer l'hôte distant
export REMOTE_HOST=user@your-server.com

# Changer le chemin distant
export REMOTE_PATH=/custom/path/test-cache
```

---

## 📊 Statistiques de gain de temps

**Avant** (sans cache) :
```
Setup : 28s
Build : 15s
Tests : 12s ← VPS lent
Deploy : 5s
Total : 60s
```

**Après** (avec cache) :
```
Setup : skip (cache lockfile) → 2s
Build : 15s
Tests : skip (cache tests) → 1s
Deploy : 5s
Total : 23s
```

**Gain : ~37 secondes par build** (62% plus rapide) 🚀

---

## 🤝 Contribution

Si tu travailles en équipe, chaque développeur doit :
1. Installer les hooks : `./scripts/setup-hooks.sh`
2. Configurer son accès SSH au VPS (optionnel)

Le cache est partagé entre tous les développeurs via le VPS.
